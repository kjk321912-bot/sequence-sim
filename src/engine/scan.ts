// PLC 스캔 루프
//
// 한 번의 step(dt)에서:
//   1. 시간 진행: 여자 중인 타이머의 누적 시간을 늘린다.
//   2. 입력·코일·타이머·카운터 상태로 모든 접점의 개폐를 정한다.
//   3. 통전 계산으로 새 코일 상태를 구한다.
//   4. 코일 상태가 바뀌었으면 접점에 반영하고 2로 돌아간다. 바뀌지 않으면 안정.
// 모든 코일은 한 반복 안에서 "동시에" 갱신되므로 부품 배치 순서와 결과가 무관하다.
// MAX_ITERATIONS 안에 안정되지 않으면 발진(릴레이가 계속 붙었다 떨어짐)으로 판정한다.

import type { Circuit, Component, ContactDevice } from './model'
import { buildGraph, type Graph } from './netlist'
import { solve, type Solution } from './solver'
import { applyAction, initialState, powerKey, resetKey, type Action, type SimState } from './state'

export const MAX_ITERATIONS = 32

export interface StepResult {
  state: SimState
  solution: Solution
  /** 발진 중인 코일 tag 목록 (없으면 빈 배열) */
  oscillating: string[]
  iterations: number
}

/** 회로에서 자주 찾는 정보를 미리 모아 둔다 */
interface Index {
  timerPreset: Map<string, number>
  counterPreset: Map<string, number>
  flickerPreset: Map<string, number>
  faultOpen: Set<string>
  faultWelded: Set<string>
}

function buildIndex(circuit: Circuit): Index {
  const timerPreset = new Map<string, number>()
  const counterPreset = new Map<string, number>()
  const flickerPreset = new Map<string, number>()
  for (const c of circuit.components) {
    if (c.kind !== 'coil') continue
    if (c.device === 'timer') timerPreset.set(c.tag, c.preset ?? 0)
    if (c.device === 'counter') counterPreset.set(c.tag, c.preset ?? 1)
    if (c.device === 'flicker') flickerPreset.set(c.tag, Math.max(50, c.preset ?? 1000))
  }
  const faults = circuit.faults ?? []
  return {
    timerPreset,
    counterPreset,
    flickerPreset,
    faultOpen: new Set(faults.flatMap((f) => (f.kind === 'contactOpen' ? [f.compId] : []))),
    faultWelded: new Set(faults.flatMap((f) => (f.kind === 'contactWelded' ? [f.compId] : []))),
  }
}

function counterDone(ix: Index, s: SimState, tag: string): boolean {
  return (s.counters[tag]?.count ?? 0) >= (ix.counterPreset.get(tag) ?? 1)
}

/** 접점을 움직이는 장치가 "동작" 상태인가 (a접점이면 닫힘, b접점이면 열림) */
function deviceActive(ix: Index, s: SimState, device: ContactDevice, tag: string): boolean {
  switch (device) {
    case 'pb':
    case 'selector':
    case 'limit':
      return !!s.inputs[tag]
    case 'relay':
    case 'mc':
      return !!s.coils[tag]
    case 'timer':
      return !!s.timers[tag]?.done
    case 'timerInst':
      return !!s.coils[tag]
    case 'counter':
      return counterDone(ix, s, tag)
    case 'flicker':
      return !!s.flickers[tag]?.on
    case 'thr':
    case 'eocr':
      return !!s.thr[tag]?.tripped
    case 'fls':
      // 플로트레스: 전원이 들어와 있고 수위를 감지했을 때만 동작
      return !!s.coils[powerKey(tag)] && !!s.inputs[tag]
  }
}

/** 도체 부품의 극별 닫힘 여부 (고장 반영) */
function poleStates(ix: Index, s: SimState, c: Component): boolean[] {
  let states: boolean[]
  switch (c.kind) {
    case 'contact': {
      const active = deviceActive(ix, s, c.device, c.tag)
      states = [c.type === 'a' ? active : !active]
      break
    }
    case 'mccb':
      states = Array(3).fill(!!s.inputs[c.tag])
      break
    case 'mcMain':
      states = Array(3).fill(!!s.coils[c.tag])
      break
    case 'thrHeater':
      states = [true, true, true]
      break
    case 'fuse':
      states = [!s.blownFuses[c.id]]
      break
    default:
      return []
  }
  if (ix.faultOpen.has(c.id)) return states.map(() => false)
  if (ix.faultWelded.has(c.id)) return states.map(() => true)
  return states
}

/** 통전 결과에서 코일 상태를 읽는다 (같은 tag 코일이 여러 개면 하나라도 여자되면 여자) */
function coilsFrom(circuit: Circuit, sol: Solution): Record<string, boolean> {
  const coils: Record<string, boolean> = {}
  for (const c of circuit.components) {
    let key: string
    if (c.kind === 'fls') key = powerKey(c.tag)
    else if (c.kind !== 'coil') continue
    else if (c.device === 'counterReset') key = resetKey(c.tag)
    else if (c.device === 'eocr') key = powerKey(c.tag)
    else key = c.tag
    coils[key] = !!coils[key] || !!sol.energized[c.id]
  }
  return coils
}

function sameCoils(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if (!!a[k] !== !!b[k]) return false
  return true
}

/** 새 코일 상태를 반영: 타이머 복귀, 카운터 계수·리셋 */
function applyCoils(ix: Index, s: SimState, coils: Record<string, boolean>): SimState {
  const timers = { ...s.timers }
  for (const [tag, preset] of ix.timerPreset) {
    if (!coils[tag]) {
      // ON 딜레이: 코일이 소자되면 즉시 복귀
      timers[tag] = { elapsed: 0, done: false }
    } else if (preset <= 0) {
      timers[tag] = { elapsed: timers[tag]?.elapsed ?? 0, done: true }
    }
  }
  const counters = { ...s.counters }
  for (const tag of ix.counterPreset.keys()) {
    const prev = counters[tag] ?? { count: 0, input: false }
    const input = !!coils[tag]
    let count = prev.count
    if (coils[resetKey(tag)]) count = 0 // 리셋 입력 중에는 계수하지 않음
    else if (input && !prev.input) count++ // 계수 입력의 상승 에지마다 +1
    counters[tag] = { count, input }
  }
  const flickers = { ...s.flickers }
  for (const tag of ix.flickerPreset.keys()) {
    if (!coils[tag]) flickers[tag] = { elapsed: 0, on: false }
    else if (!s.coils[tag]) flickers[tag] = { elapsed: 0, on: true } // 여자되는 순간 a접점부터 동작
  }
  return { ...s, coils, timers, counters, flickers }
}

/** 시간 진행: 여자 중인 타이머 누적 */
function advanceTimers(ix: Index, s: SimState, dt: number): SimState {
  if (dt <= 0) return s
  const timers = { ...s.timers }
  for (const [tag, preset] of ix.timerPreset) {
    if (!s.coils[tag]) continue
    const elapsed = (timers[tag]?.elapsed ?? 0) + dt
    timers[tag] = { elapsed, done: elapsed >= preset }
  }
  const flickers = { ...s.flickers }
  for (const [tag, period] of ix.flickerPreset) {
    if (!s.coils[tag]) continue
    const elapsed = (flickers[tag]?.elapsed ?? 0) + dt
    // 설정 시간마다 출력 반전: [0, period) 동작, [period, 2·period) 복귀 …
    flickers[tag] = { elapsed, on: Math.floor(elapsed / period) % 2 === 0 }
  }
  return { ...s, time: s.time + dt, timers, flickers }
}

/**
 * 열동계전기 가열: 과부하 운전 또는 결상 상태인 모터에 배선으로 직결된 THR 히터가 가열되고,
 * tripTime 동안 지속되면 트립한다. 원인이 사라지면 식는다(누적 시간 0).
 */
function updateThermal(circuit: Circuit, graph: Graph, s: SimState, sol: Solution, dt: number): SimState {
  const stressedNets = new Set<number>()
  for (const c of circuit.components) {
    if (c.kind !== 'motor') continue
    const run = sol.motors[c.id]
    const stressed = run === 'singlePhase' || (c.overload && (run === 'fwd' || run === 'rev'))
    if (!stressed) continue
    for (const pin of ['U', 'V', 'W']) {
      const n = graph.terminals.get(`${c.id}:${pin}`)
      if (n !== undefined) stressedNets.add(graph.staticNet[n]!)
    }
  }
  let thr = s.thr
  for (const c of circuit.components) {
    if (c.kind !== 'thrHeater') continue
    const prev = thr[c.tag] ?? { tripped: false, heat: 0 }
    if (prev.tripped) continue
    const hot = ['T1', 'T2', 'T3', 'L1', 'L2', 'L3'].some((pin) => {
      const n = graph.terminals.get(`${c.id}:${pin}`)
      return n !== undefined && stressedNets.has(graph.staticNet[n]!)
    })
    const heat = hot ? prev.heat + dt : 0
    if (heat !== prev.heat) thr = { ...thr, [c.tag]: { tripped: heat >= c.tripTime && hot, heat } }
  }
  return thr === s.thr ? s : { ...s, thr }
}

/** 코일 상태가 바뀌지 않을 때까지 통전 계산을 반복한다 */
function settle(circuit: Circuit, graph: Graph, ix: Index, start: SimState) {
  let s = start
  const closedOf = (c: Component) => poleStates(ix, s, c)
  let solution = solve(circuit, graph, closedOf)
  let iterations = 1
  const changedLate = new Set<string>()
  while (iterations <= MAX_ITERATIONS) {
    const coils = coilsFrom(circuit, solution)
    if (sameCoils(coils, s.coils)) {
      // 한 번도 바뀌지 않은 코일도 false로 채워 둔다
      s = { ...s, coils }
      break
    }
    if (iterations > MAX_ITERATIONS / 2) {
      for (const k of new Set([...Object.keys(coils), ...Object.keys(s.coils)])) {
        if (!!coils[k] !== !!s.coils[k]) changedLate.add(k)
      }
    }
    s = applyCoils(ix, s, coils)
    solution = solve(circuit, graph, closedOf)
    iterations++
  }
  const oscillating = iterations > MAX_ITERATIONS ? [...changedLate].sort() : []
  return { state: s, solution, oscillating, iterations }
}

/** 한 스캔 주기 실행 */
export function step(circuit: Circuit, graph: Graph, prev: SimState, dt: number): StepResult {
  const ix = buildIndex(circuit)
  let result = settle(circuit, graph, ix, advanceTimers(ix, prev, dt))

  // 퓨즈 용단: 단락 전류가 지나간 퓨즈를 끊고 다시 계산한다 (퓨즈가 단락을 차단)
  for (let round = 0; round < 4; round++) {
    const blow = circuit.components.filter(
      (c) => c.kind === 'fuse' && result.solution.shortThrough[c.id] && !result.state.blownFuses[c.id],
    )
    if (!blow.length) break
    const blownFuses = { ...result.state.blownFuses }
    for (const c of blow) blownFuses[c.id] = true
    result = settle(circuit, graph, ix, { ...result.state, blownFuses })
  }

  const state = updateThermal(circuit, graph, result.state, result.solution, dt)
  return { ...result, state }
}

/**
 * 편의용 시뮬레이터: 그래프를 캐시하고 상태를 들고 있다.
 * UI와 테스트에서 쓴다. 내부는 순수 함수(step, applyAction)로만 동작한다.
 */
export class Simulator {
  readonly graph: Graph
  state: SimState
  last: StepResult

  constructor(readonly circuit: Circuit, state: SimState = initialState()) {
    this.graph = buildGraph(circuit)
    this.state = state
    this.last = this.tick(0)
  }

  /** 조작 후 즉시 안정 상태까지 스캔 */
  act(action: Action): StepResult {
    this.state = applyAction(this.state, action)
    return this.tick(0)
  }

  tick(dt: number): StepResult {
    this.last = step(this.circuit, this.graph, this.state, dt)
    this.state = this.last.state
    return this.last
  }

  /** 총 ms 동안 stepMs 간격으로 진행 */
  run(ms: number, stepMs = 10): StepResult {
    let left = ms
    while (left > 0) {
      const dt = Math.min(stepMs, left)
      this.tick(dt)
      left -= dt
    }
    return this.last
  }
}
