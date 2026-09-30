import { beforeEach, describe, expect, it } from 'vitest'
import { CircuitBuilder, initialState, type Circuit, type Component } from '../../../engine'
import { useEditor } from '../../../store/editorStore'
import { liveResult, useSim } from '../../../store/simStore'
import { showcaseCircuit } from '../../../examples/showcase'
import { objJosa, operationOf, powerHintText } from '../operate'
import { labelsOf, rotorsOf, visualsOf } from '../visuals'

const TOP = 0
const BOTTOM = 24

/** 자기유지 회로: PB0(b) → PB1(a) ∥ X1-a → X1,  X1-a → RL,  X1-a → T1(1초),  T1-a → GL,  PB9 → 단락 */
function selfHold(): Circuit {
  const b = new CircuitBuilder()
  b.bus('P', 0, TOP, 30)
  b.bus('N', 0, BOTTOM, 30)
  const rung = b.rung(2, TOP, BOTTOM, [
    (x, y) => b.contact(x, y, 'pb', 'b', 'PB0'),
    (x, y) => b.contact(x, y, 'pb', 'a', 'PB1'),
    (x, y) => b.coil(x, y, 'relay', 'X1'),
  ])
  const t = rung[1]!.top
  b.contact(4, t, 'relay', 'a', 'X1')
  b.wire([2, t], [4, t])
  b.wire([4, t + 3], [2, t + 3])
  b.rung(8, TOP, BOTTOM, [(x, y) => b.contact(x, y, 'relay', 'a', 'X1'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(12, TOP, BOTTOM, [(x, y) => b.contact(x, y, 'relay', 'a', 'X1'), (x, y) => b.coil(x, y, 'timer', 'T1', 1000)])
  b.rung(16, TOP, BOTTOM, [(x, y) => b.contact(x, y, 'timer', 'a', 'T1'), (x, y) => b.lamp(x, y, 'GL')])
  b.rung(20, TOP, BOTTOM, [(x, y) => b.contact(x, y, 'pb', 'a', 'PB9')])
  return b.build('자기유지')
}

const sim = () => useSim.getState()
const find = (pred: (c: Component) => boolean) => useEditor.getState().circuit.components.find(pred)!
const lamp = (tag: string) => find((c) => c.kind === 'lamp' && c.tag === tag)
const lit = (tag: string) => !!sim().result!.solution.energized[lamp(tag).id]

beforeEach(() => {
  sim().setMode('edit')
  useEditor.getState().setCircuit(selfHold())
  useSim.setState({ speed: 1, paused: false })
  sim().setMode('run')
})

describe('실행 모드 스토어', () => {
  it('실행 모드로 들어가면 처음 상태에서 계산하고, 편집 모드로 나오면 결과를 지운다', () => {
    expect(sim().result).not.toBeNull()
    expect(lit('RL')).toBe(false)
    sim().setMode('edit')
    expect(sim().result).toBeNull()
    expect(liveResult()).toBeNull()
  })

  it('버튼 조작으로 자기유지가 걸리고 정지 버튼으로 풀린다', () => {
    sim().act({ type: 'press', tag: 'PB1' })
    sim().act({ type: 'release', tag: 'PB1' })
    expect(lit('RL')).toBe(true)
    sim().act({ type: 'press', tag: 'PB0' })
    sim().act({ type: 'release', tag: 'PB0' })
    expect(lit('RL')).toBe(false)
  })

  it('실제 시간 × 배속만큼 타이머가 진행한다', () => {
    sim().act({ type: 'press', tag: 'PB1' })
    for (let i = 0; i < 9; i++) sim().advance(100)
    expect(lit('GL')).toBe(false)
    sim().advance(100)
    expect(lit('GL')).toBe(true)

    sim().reset()
    sim().setSpeed(5)
    sim().act({ type: 'press', tag: 'PB1' })
    sim().advance(100) // ×5 → 500ms
    expect(lit('GL')).toBe(false)
    sim().advance(100)
    expect(lit('GL')).toBe(true)
  })

  it('일시정지 중에는 시간이 흐르지 않지만 버튼 조작은 바로 반영된다', () => {
    sim().setPaused(true)
    sim().act({ type: 'press', tag: 'PB1' })
    expect(lit('RL')).toBe(true)
    for (let i = 0; i < 20; i++) sim().advance(100)
    expect(lit('GL')).toBe(false)
    expect(liveResult()!.state.time).toBe(0)
  })

  it('한 프레임이 아주 길어도(다른 앱에 다녀옴) 최대 100ms만 진행한다', () => {
    sim().advance(60_000)
    expect(liveResult()!.state.time).toBe(100)
  })

  it('단락이 생기면 시뮬레이션을 멈춘다', () => {
    sim().act({ type: 'press', tag: 'PB9' })
    expect(sim().result!.solution.shorts).toEqual([['N', 'P']])
    expect(sim().paused).toBe(true)
    sim().act({ type: 'release', tag: 'PB9' })
    expect(sim().result!.solution.shorts).toEqual([])
  })

  it('보이는 상태가 그대로면 result 객체를 바꾸지 않는다 (불필요한 다시 그리기 방지)', () => {
    sim().act({ type: 'press', tag: 'PB1' })
    const before = sim().result
    sim().advance(50)
    expect(sim().result).toBe(before)
  })

  it('실행 중 회로를 고쳐도 조작 상태를 유지한 채 다시 계산한다', () => {
    sim().act({ type: 'press', tag: 'PB1' })
    sim().act({ type: 'release', tag: 'PB1' })
    const timer = find((c) => c.kind === 'coil' && c.device === 'timer')
    useEditor.getState().updateComponent(timer.id, { preset: 200 })
    expect(lit('RL')).toBe(true)
    sim().advance(100)
    sim().advance(100)
    expect(lit('GL')).toBe(true)
  })
})

describe('부품 조작', () => {
  const s = initialState()
  const base = { id: 'c', x: 0, y: 0, rot: 0 as const }

  it('푸시버튼은 누르는 동안만, 셀렉터·리밋·MCCB는 톡 칠 때마다 전환', () => {
    expect(operationOf({ ...base, kind: 'contact', device: 'pb', type: 'a', tag: 'PB1' }, s)).toEqual({ kind: 'momentary', tag: 'PB1' })
    for (const device of ['selector', 'limit', 'fls'] as const) {
      expect(operationOf({ ...base, kind: 'contact', device, type: 'b', tag: 'S' }, s)).toEqual({
        kind: 'tap',
        action: { type: 'toggle', tag: 'S' },
      })
    }
    expect(operationOf({ ...base, kind: 'mccb', tag: 'MCCB' }, s)).toEqual({ kind: 'tap', action: { type: 'toggle', tag: 'MCCB' } })
  })

  it('릴레이·타이머 접점과 램프는 손으로 조작할 수 없다', () => {
    expect(operationOf({ ...base, kind: 'contact', device: 'relay', type: 'a', tag: 'X1' }, s)).toBeNull()
    expect(operationOf({ ...base, kind: 'contact', device: 'timer', type: 'a', tag: 'T1' }, s)).toBeNull()
    expect(operationOf({ ...base, kind: 'lamp', color: 'RL', tag: 'RL' }, s)).toBeNull()
  })

  it('보호계전기는 톡 치면 트립, 트립된 상태에서 다시 치면 리셋', () => {
    const thr: Component = { ...base, kind: 'thrHeater', tag: 'THR', tripTime: 3000 }
    expect(operationOf(thr, s)).toEqual({ kind: 'tap', action: { type: 'thrTrip', tag: 'THR' } })
    const tripped = { ...s, thr: { THR: { tripped: true, heat: 0 } } }
    expect(operationOf(thr, tripped)).toEqual({ kind: 'tap', action: { type: 'thrReset', tag: 'THR' } })
    expect(operationOf({ ...base, kind: 'contact', device: 'thr', type: 'b', tag: 'THR' }, tripped)).toEqual({
      kind: 'tap',
      action: { type: 'thrReset', tag: 'THR' },
    })
  })

  it('퓨즈는 용단됐을 때만 톡 쳐서 교체', () => {
    const fuse: Component = { ...base, kind: 'fuse', tag: 'F1' }
    expect(operationOf(fuse, s)).toBeNull()
    expect(operationOf(fuse, { ...s, blownFuses: { c: true } })).toEqual({ kind: 'tap', action: { type: 'fuseReplace' } })
  })
})

describe('화면 표시', () => {
  it('접점 막대·코일·램프 모양이 실행 결과를 따른다', () => {
    sim().act({ type: 'press', tag: 'PB1' })
    const v = visualsOf(useEditor.getState().circuit, sim().result!)
    const pb1 = find((c) => c.kind === 'contact' && c.tag === 'PB1')
    const pb0 = find((c) => c.kind === 'contact' && c.tag === 'PB0')
    const x1 = find((c) => c.kind === 'coil' && c.tag === 'X1')
    expect(v[pb1.id]).toEqual({ active: true, conducting: true })
    expect(v[pb0.id]).toEqual({ active: false, conducting: true })
    expect(v[x1.id]).toEqual({ energized: true, warn: false })
    expect(v[lamp('RL').id]).toEqual({ energized: true })
  })

  it('전동기 회전 방향을 글자와 날개로 보여 준다', () => {
    const b = new CircuitBuilder()
    b.bus('R', 0, 0, 10)
    b.bus('S', 0, 1, 10)
    b.bus('T', 0, 2, 10)
    const m = b.add({ kind: 'motor', x: 2, y: 6, tag: 'M1' })
    b.wire([2, 0], [2, 6])
    b.wire([4, 1], [4, 6])
    b.wire([6, 2], [6, 6])
    useEditor.getState().setCircuit(b.build())
    sim().reset()
    const circuit = useEditor.getState().circuit
    expect(labelsOf(circuit, sim().result!).find((l) => l.key === m)?.text).toBe('정회전')
    expect(rotorsOf(circuit, sim().result!)).toMatchObject([{ id: m, dir: 1 }])
  })
})

describe('조작 전원 없음 안내', () => {
  it('예제 회로에서 MCCB를 켜기 전에 PB를 누르면 MCCB를 먼저 켜라고 알린다', () => {
    sim().setMode('edit')
    useEditor.getState().setCircuit(showcaseCircuit())
    sim().setMode('run')
    useEditor.setState({ toast: null })
    const pb1 = find((c) => c.kind === 'contact' && c.tag === 'PB1')
    sim().act({ type: 'press', tag: 'PB1' }, pb1.id)
    expect(useEditor.getState().toast?.text).toBe('조작 전원이 없습니다 — MCCB를 먼저 켜세요')
    sim().act({ type: 'release', tag: 'PB1' }, pb1.id)

    useEditor.setState({ toast: null })
    const mccb = find((c) => c.kind === 'mccb')
    sim().act({ type: 'toggle', tag: 'MCCB' }, mccb.id)
    sim().act({ type: 'press', tag: 'PB1' }, pb1.id)
    expect(useEditor.getState().toast).toBeNull()
  })

  it('안내 문구의 조사를 부품 이름 소리에 맞춘다', () => {
    expect(objJosa('MCCB')).toBe('MCCB를')
    expect(objJosa('F1')).toBe('F1을')
    expect(objJosa('F2')).toBe('F2를')
    expect(objJosa('EOCR')).toBe('EOCR을')
    expect(objJosa('차단기')).toBe('차단기를')
    expect(powerHintText([{ kind: 'fuseBlown', tags: ['F1'] }])).toBe('조작 전원이 없습니다 — 용단된 퓨즈 F1을 톡 쳐서 교체하세요')
    expect(powerHintText([])).toBeNull()
  })
})
