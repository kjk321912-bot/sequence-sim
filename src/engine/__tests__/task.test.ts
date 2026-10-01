import { describe, expect, it } from 'vitest'
import { parseCircuit, stringifyCircuit } from '../serialize'
import { gradeTask, makeTask, partsSummary, scriptFromRecording, starterCircuit, type ScriptItem } from '../task'
import { a, bc, BOTTOM, controlBoard, TOP } from './helpers'

/** 자기유지 회로 (hold=false면 자기유지 접점을 빠뜨린 학생 회로) + 3초 타이머 → GL */
function selfHold(hold = true) {
  const b = controlBoard()
  const [, start] = b.rung(2, TOP, BOTTOM, [bc(b, 'pb', 'PB0'), a(b, 'pb', 'PB1'), (x, y) => b.coil(x, y, 'relay', 'X')])
  if (hold) {
    b.contact(4, start!.top, 'relay', 'a', 'X')
    b.wire([2, start!.top], [4, start!.top])
    b.wire([4, start!.top + 3], [2, start!.top + 3])
  }
  b.rung(8, TOP, BOTTOM, [a(b, 'relay', 'X'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(12, TOP, BOTTOM, [a(b, 'relay', 'X'), (x, y) => b.coil(x, y, 'timer', 'T', 3000)])
  b.rung(16, TOP, BOTTOM, [a(b, 'timer', 'T'), (x, y) => b.lamp(x, y, 'GL')])
  return b.build('자기유지')
}

const script: ScriptItem[] = [{ do: 'click', tag: 'PB1' }, { wait: 3000 }, { do: 'click', tag: 'PB0' }]

describe('과제 만들기·채점', () => {
  it('정답 회로로 확인점마다 기대 출력을 기록한다', () => {
    const task = makeTask(selfHold(), { title: '자기유지', description: '' }, script)
    const checks = task.steps.filter((s) => s.kind === 'check')
    // 누름·뗌·기다림·누름·뗌 → 확인점 5개
    expect(checks).toHaveLength(5)
    const after = (i: number) => (checks[i]!.kind === 'check' ? checks[i]!.expect : [])
    expect(after(1)).toEqual([
      { tag: 'GL', kind: 'lamp', value: 'off' },
      { tag: 'RL', kind: 'lamp', value: 'on' },
    ])
    expect(after(2).find((e) => e.tag === 'GL')!.value).toBe('on')
  })

  it('정답 회로는 합격', () => {
    const task = makeTask(selfHold(), { title: '', description: '' }, script)
    const g = gradeTask(selfHold(), task)
    expect(g.passed).toBe(true)
    expect(g.firstFail).toBeNull()
  })

  it('자기유지를 빠뜨리면 PB1을 뗀 시점에서 불합격, 틀린 출력과 시각을 알려 준다', () => {
    const task = makeTask(selfHold(), { title: '', description: '' }, script)
    const g = gradeTask(selfHold(false), task)
    expect(g.passed).toBe(false)
    const fail = g.checks[g.firstFail!]!
    expect(fail.time).toBe(0)
    expect(fail.items.find((x) => !x.ok)).toEqual({ tag: 'RL', kind: 'lamp', expected: 'on', actual: 'off', ok: false })
  })

  it('조작할 버튼이 없거나 출력 부품이 없으면 알려 준다', () => {
    const task = makeTask(selfHold(), { title: '', description: '' }, script)
    const b = controlBoard()
    b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB5'), (x, y) => b.lamp(x, y, 'RL')])
    const g = gradeTask(b.build(), task)
    expect(g.problems).toEqual(['조작할 PB1이(가) 회로에 없습니다 (번호를 확인하세요)', '조작할 PB0이(가) 회로에 없습니다 (번호를 확인하세요)'])
    expect(g.checks[0]!.items.find((x) => x.tag === 'GL')!.actual).toBe('none')
  })

  it('단락이 생기면 그 확인점은 불합격', () => {
    const task = makeTask(selfHold(), { title: '', description: '' }, script)
    const c = selfHold()
    // PB1 아래쪽을 N에 바로 이어 단락
    c.wires.push({ id: 'short', points: [{ x: 2, y: 4 }, { x: 0, y: 4 }, { x: 0, y: BOTTOM }] })
    const g = gradeTask(c, task)
    expect(g.checks[g.firstFail!]!.notes).toContain('단락')
  })

  it('기록한 조작을 시나리오로 바꾼다 (조작 사이 시간은 100ms 단위 기다림)', () => {
    const s = scriptFromRecording(
      [
        { time: 520, action: { type: 'press', tag: 'PB1' } },
        { time: 640, action: { type: 'release', tag: 'PB1' } },
        { time: 3700, action: { type: 'thrTrip', tag: 'THR' } },
      ],
      5000,
    )
    expect(s).toEqual([
      { wait: 500 },
      { do: 'press', tag: 'PB1' },
      { wait: 100 },
      { do: 'release', tag: 'PB1' },
      { wait: 3100 },
      { do: 'trip', tag: 'THR' },
      { wait: 1300 },
    ])
  })

  it('시작 회로에는 모선만 남고, 부품 안내에 번호와 설정값이 나온다', () => {
    const answer = selfHold()
    const start = starterCircuit(answer)
    expect(start.components.map((c) => c.kind)).toEqual(['bus', 'bus'])
    expect(start.wires).toEqual([])
    expect(partsSummary(answer)).toBe('부품 번호: GL, PB0, PB1, RL, T, X\n설정값: 타이머 T 3초')
  })

  it('과제가 든 회로를 파일로 저장했다 불러와도 과제가 남는다', () => {
    const c = { ...starterCircuit(selfHold()), task: makeTask(selfHold(), { title: '자기유지', description: '설명' }, script) }
    const back = parseCircuit(stringifyCircuit(c))
    expect(back.ok && back.circuit.task).toEqual(c.task)
    expect(parseCircuit(JSON.stringify({ ...c, task: { title: 1 } })).ok).toBe(false)
  })
})
