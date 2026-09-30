// 실행 모드 상태 (Zustand)
//
// 엔진은 dt만 받는 순수 함수이므로, 실제 시간·배속·일시정지는 여기서 dt로 바꿔 넘긴다.
// 매 프레임 계산 결과(live)는 반응형 상태에 넣지 않고, 화면에 보이는 것이 바뀔 때만
// result를 갱신한다 (60fps로 캔버스 전체를 다시 그리지 않도록).
import { create } from 'zustand'
import { applyAction, buildGraph, initialState, missingPower, step, type Action, type Circuit, type Graph, type StepResult } from '../engine'
import { isInputAction, powerHintText } from '../modes/run/operate'
import { useEditor } from './editorStore'

export type Mode = 'edit' | 'run'
export type Speed = 1 | 5

/** 한 번에 진행하는 최대 시뮬레이션 시간(ms): 타이머 정밀도 */
const SUB_STEP_MS = 20
/** 한 프레임에 반영하는 최대 실제 시간(ms): 다른 앱에 갔다 와도 몰아서 계산하지 않게 */
const MAX_FRAME_MS = 100

export interface SimStore {
  mode: Mode
  paused: boolean
  speed: Speed
  /** 화면 표시용 결과 (보이는 상태가 바뀔 때만 새 객체) */
  result: StepResult | null

  setMode: (m: Mode) => void
  setPaused: (p: boolean) => void
  setSpeed: (s: Speed) => void
  /** 모든 입력·코일·타이머를 처음 상태로 */
  reset: () => void
  /**
   * 버튼 누름 등 조작 → 즉시 안정 상태까지 계산.
   * compId(조작한 부품)를 넘기면 그 부품에 전압이 없을 때 원인(차단기·퓨즈·트립)을 알려 준다.
   */
  act: (a: Action, compId?: string | null) => void
  /** 실제 경과 시간(ms)만큼 진행 (일시정지·배속 반영) */
  advance: (realMs: number) => void
}

// 매 프레임 바뀌는 값 (반응형 아님)
let live: StepResult | null = null
let graph: Graph | null = null
let graphOf: Circuit | null = null
let shownKey = ''

/** 애니메이션 레이어가 매 프레임 읽는 최신 결과 */
export const liveResult = () => live

function currentGraph(circuit: Circuit): Graph {
  if (!graph || graphOf !== circuit) {
    graph = buildGraph(circuit)
    graphOf = circuit
  }
  return graph
}

/** 화면에 보이는 상태만 뽑은 비교용 문자열 (타이머 경과 시간처럼 매번 바뀌는 값은 뺀다) */
function visualKey(r: StepResult): string {
  const s = r.state
  const sol = r.solution
  return JSON.stringify([
    s.inputs,
    s.coils,
    Object.entries(s.timers).map(([k, t]) => [k, t.done]),
    Object.entries(s.counters).map(([k, c]) => [k, c.count]),
    Object.entries(s.flickers).map(([k, f]) => [k, f.on]),
    Object.entries(s.thr).map(([k, t]) => [k, t.tripped]),
    s.blownFuses,
    sol.energized,
    sol.conducting,
    sol.motors,
    sol.segments.map((g) => g.state[0]! + g.dir),
    sol.shorts,
    sol.seriesLoads,
    r.oscillating,
  ])
}

/** 회로 한 번 계산: 이전 상태 → 새 live */
function run(prevState: StepResult['state'], dt: number) {
  const circuit = useEditor.getState().circuit
  live = step(circuit, currentGraph(circuit), prevState, dt)
}

/** live를 화면에 알리고, 새로 생긴 사건(단락·용단·트립)을 안내한다 */
function publish(prev: StepResult | null) {
  if (!live) return
  const key = visualKey(live)
  if (key === shownKey) return
  shownKey = key
  // 단락: 시뮬레이션을 멈추고 원인을 찾게 한다
  const newShort = live.solution.shorts.length > 0 && !prev?.solution.shorts.length
  announce(prev, live)
  useSim.setState(newShort ? { result: live, paused: true } : { result: live })
}

function restart() {
  shownKey = ''
  run(initialState(), 0)
  publish(null)
}

export const useSim = create<SimStore>((set, get) => ({
  mode: 'edit',
  paused: false,
  speed: 1,
  result: null,

  setMode: (mode) => {
    if (mode === get().mode) return
    if (mode === 'run') {
      const ed = useEditor.getState()
      ed.select(null)
      ed.setTool('select')
      ed.setDraftWire(null)
      set({ mode, paused: false })
      restart()
    } else {
      live = null
      shownKey = ''
      set({ mode, result: null })
    }
  },
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed }),
  reset: () => {
    if (get().mode !== 'run') return
    set({ paused: false })
    restart()
  },

  act: (a, compId) => {
    if (!live) return
    const prev = live
    if (compId) hintNoPower(live, a, compId)
    run(applyAction(live.state, a), 0)
    publish(prev)
  },

  advance: (realMs) => {
    const { paused, speed } = get()
    if (!live || paused || realMs <= 0) return
    const prev = live
    let left = Math.min(realMs, MAX_FRAME_MS) * speed
    while (left > 0) {
      const dt = Math.min(SUB_STEP_MS, left)
      run(live.state, dt)
      left -= dt
      if (live.solution.shorts.length) break
    }
    publish(prev)
  },
}))

/** 퓨즈 용단·보호계전기 트립처럼 한 번 일어나는 사건을 알림으로 */
function announce(prev: StepResult | null, next: StepResult) {
  if (!prev) return
  const ed = useEditor.getState()
  const blown = ed.circuit.components.filter((c) => c.kind === 'fuse' && next.state.blownFuses[c.id] && !prev.state.blownFuses[c.id])
  if (blown.length) {
    const names = blown.map((c) => ('tag' in c ? c.tag : '')).join(', ')
    ed.showToast(`퓨즈 ${names} 용단 — 단락 전류가 흘렀습니다. 원인을 고친 뒤 퓨즈를 톡 쳐서 교체하세요`, 'error')
    return
  }
  const tripped = Object.keys(next.state.thr).filter((t) => next.state.thr[t]?.tripped && !prev.state.thr[t]?.tripped)
  if (tripped.length) ed.showToast(`${tripped.join(', ')} 트립 — 보호계전기를 톡 쳐서 리셋하세요`, 'error')
}

// 실행 중 회로를 고치면(길게 눌러 속성 변경, 되돌리기 등) 지금 상태를 유지한 채 다시 계산
useEditor.subscribe((s, prev) => {
  if (s.circuit === prev.circuit || !live) return
  const before = live
  run(live.state, 0)
  publish(before)
})

/** 전압이 없는 입력 장치를 조작하면 원인을 알려 준다 ("MCCB를 먼저 켜세요" 등) */
function hintNoPower(current: StepResult, a: Action, compId: string) {
  const ed = useEditor.getState()
  const comp = ed.circuit.components.find((c) => c.id === compId)
  if (!comp || !isInputAction(comp, a)) return
  const text = powerHintText(missingPower(ed.circuit, currentGraph(ed.circuit), current, compId))
  if (text) ed.showToast(text, 'error')
}
