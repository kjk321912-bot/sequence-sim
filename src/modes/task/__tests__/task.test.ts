import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gradeTask } from '../../../engine'
import { EXAMPLES } from '../../../examples'
import { BUILTIN_TASKS } from '../../../examples/tasks'
import { useEditor } from '../../../store/editorStore'
import { liveResult, useSim } from '../../../store/simStore'
import { useTask } from '../../../store/taskStore'

// requestAnimationFrame을 손으로 돌린다
let frames: FrameRequestCallback[] = []
let now = 0
function runFrames(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) {
    now += step
    const fs = frames
    frames = []
    for (const f of fs) f(now)
  }
}

beforeEach(() => {
  frames = []
  now = 0
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f))
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = []
  })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  useSim.getState().setMode('edit')
  useSim.setState({ speed: 5 })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** 기본 과제를 열고 정답 회로(같은 이름의 예제)로 바꿔 끼운다 */
function openTask(key: string, withAnswer: boolean) {
  const start = BUILTIN_TASKS.find((t) => t.key === key)!.make()
  const answer = EXAMPLES.find((e) => e.key === key)!.make()
  useEditor.getState().setCircuit(withAnswer ? { ...answer, task: start.task } : start)
  useSim.getState().setMode('task')
}

describe('과제 탭', () => {
  it('정답 회로를 재생 채점하면 끝까지 가서 합격', () => {
    openTask('timer', true)
    useTask.getState().startGrading()
    expect(useTask.getState().phase).toBe('playing')
    expect(useSim.getState().driven).toBe(true)
    runFrames(20000)
    const t = useTask.getState()
    expect(t.phase).toBe('done')
    expect(t.grade!.passed).toBe(true)
    expect(t.revealed).toBe(t.grade!.checks.length)
    expect(useSim.getState().driven).toBe(false)
  })

  it('틀린 회로는 처음 틀린 확인점에서 재생이 멈추고, 그 순간의 회로 상태가 화면에 남는다', () => {
    openTask('selfHold', false)
    useTask.getState().startGrading()
    runFrames(20000)
    const t = useTask.getState()
    expect(t.phase).toBe('done')
    expect(t.grade!.passed).toBe(false)
    expect(t.viewCheck).toBe(t.grade!.firstFail)
    expect(t.revealed).toBe(t.grade!.firstFail! + 1)
    expect(useSim.getState().paused).toBe(true)
  })

  it('재생 화면의 상태가 채점 엔진의 결과와 같다 (확인점으로 이동)', () => {
    openTask('exam04', true)
    useTask.getState().gradeNow()
    const g = useTask.getState().grade!
    expect(g.passed).toBe(true)
    const k = 5
    useTask.getState().jumpTo(k)
    expect(liveResult()!.state.time).toBe(g.checks[k]!.time)
  })

  it('회로를 고치면 채점 결과를 지운다', () => {
    openTask('selfHold', true)
    useTask.getState().gradeNow()
    expect(useTask.getState().grade).not.toBeNull()
    useEditor.getState().renameCircuit('바꾼 이름')
    expect(useTask.getState().grade).toBeNull()
  })

  it('정답 회로를 조작해 기록하면 과제가 만들어지고, 그 회로는 합격한다', () => {
    useEditor.getState().setCircuit(EXAMPLES.find((e) => e.key === 'selfHold')!.make())
    useSim.getState().setMode('task')
    const ts = useTask.getState()
    ts.startRecording()
    const sim = useSim.getState()
    sim.act({ type: 'press', tag: 'PB1' })
    sim.advanceExact(300)
    sim.act({ type: 'release', tag: 'PB1' })
    sim.advanceExact(1000)
    sim.act({ type: 'press', tag: 'PB0' })
    sim.act({ type: 'release', tag: 'PB0' })
    expect(useTask.getState().recording).toHaveLength(4)
    useTask.getState().finishRecording()
    expect(useTask.getState().draft).toEqual([
      { do: 'press', tag: 'PB1' },
      { wait: 300 },
      { do: 'release', tag: 'PB1' },
      { wait: 1000 },
      { do: 'press', tag: 'PB0' },
      { do: 'release', tag: 'PB0' },
    ])
    useTask.getState().saveDraft('자기유지 연습', '(1) PB1을 누르면 …')
    const c = useEditor.getState().circuit
    expect(c.task!.title).toBe('자기유지 연습')
    expect(c.task!.description).toContain('부품 번호: GL, PB0, PB1, RL, X')
    expect(gradeTask(c, c.task!).passed).toBe(true)
  })
})
