// 과제: 시나리오 만들기와 채점
//
// 과제는 "입력 시나리오"와 "시점마다 기대 출력"으로 이루어진다.
//   1. 교사의 정답 회로를 시나리오대로 돌려 확인점마다 출력(램프·부저·전동기)을 기록한다 → makeTask
//   2. 학생 회로를 같은 시나리오대로 돌려 확인점마다 출력을 비교한다 → gradeTask
// 시간은 TASK_STEP_MS 간격으로 진행한다 (실행 모드 화면 재생과 같은 간격이라 결과가 똑같다).

import type { Circuit, Component, Expectation, OutputKind, OutputValue, Task, TaskAction, TaskStep } from './model'
import { buildGraph, type Graph } from './netlist'
import { operate, step, type StepResult } from './scan'
import { initialState } from './state'

/** 시나리오 진행 간격(ms) */
export const TASK_STEP_MS = 20

/** 시나리오 작성용 한 줄: 조작 또는 기다림. click은 누름 → 뗌 */
export type ScriptItem =
  | { do: 'press' | 'release' | 'toggle' | 'click' | 'trip' | 'reset'; tag: string }
  | { wait: number }

/** 회로의 출력 상태 (같은 번호가 여러 개면 하나라도 켜지면 켜짐) */
export function readOutputs(circuit: Circuit, r: StepResult): Expectation[] {
  const out = new Map<string, Expectation>()
  for (const c of circuit.components) {
    if (c.kind === 'lamp' || c.kind === 'buzzer') {
      const on = !!r.solution.energized[c.id]
      const prev = out.get(c.tag)
      out.set(c.tag, { tag: c.tag, kind: c.kind, value: on || prev?.value === 'on' ? 'on' : 'off' })
    } else if (c.kind === 'motor') {
      const run = r.solution.motors[c.id] ?? 'stop'
      const prev = out.get(c.tag)
      out.set(c.tag, { tag: c.tag, kind: 'motor', value: prev && prev.value !== 'stop' ? prev.value : run })
    }
  }
  const order: Record<OutputKind, number> = { motor: 0, lamp: 1, buzzer: 2 }
  return [...out.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.tag.localeCompare(b.tag))
}

/** 시나리오를 과제 단계로 펼친다: 조작·기다림마다 확인점을 둔다 (확인점 내용은 아직 비어 있음) */
function expand(script: ScriptItem[]): TaskStep[] {
  const steps: TaskStep[] = []
  const act = (action: TaskAction) => steps.push({ kind: 'action', action }, { kind: 'check', expect: [] })
  for (const s of script) {
    if ('wait' in s) {
      steps.push({ kind: 'wait', ms: Math.max(TASK_STEP_MS, Math.round(s.wait / TASK_STEP_MS) * TASK_STEP_MS) }, { kind: 'check', expect: [] })
    } else if (s.do === 'click') {
      act({ type: 'press', tag: s.tag })
      act({ type: 'release', tag: s.tag })
    } else if (s.do === 'trip') act({ type: 'thrTrip', tag: s.tag })
    else if (s.do === 'reset') act({ type: 'thrReset', tag: s.tag })
    else act({ type: s.do, tag: s.tag })
  }
  return steps
}

/** 시나리오를 처음부터 돌리며 단계마다 콜백 (확인점에서 결과를 읽는다) */
function simulate(circuit: Circuit, graph: Graph, steps: TaskStep[], onStep: (i: number, r: StepResult) => void) {
  let r = step(circuit, graph, initialState(), 0)
  steps.forEach((s, i) => {
    if (s.kind === 'action') r = operate(circuit, graph, r.state, s.action)
    else if (s.kind === 'wait') {
      for (let left = s.ms; left > 0; left -= TASK_STEP_MS) r = step(circuit, graph, r.state, Math.min(TASK_STEP_MS, left))
    }
    onStep(i, r)
  })
}

/** 정답 회로로 과제를 만든다: 확인점마다 정답 회로의 출력을 기대 출력으로 기록 */
export function makeTask(answer: Circuit, meta: { title: string; description: string }, script: ScriptItem[]): Task {
  const steps = expand(script)
  simulate(answer, buildGraph(answer), steps, (i, r) => {
    const s = steps[i]!
    if (s.kind === 'check') s.expect = readOutputs(answer, r)
  })
  return { ...meta, steps }
}

/** 기록한 조작(시뮬레이션 시각과 함께)을 시나리오로: 조작 사이 시간은 기다림이 된다 */
export function scriptFromRecording(events: { time: number; action: TaskAction }[], endTime: number): ScriptItem[] {
  const script: ScriptItem[] = []
  let t = 0
  const wait = (until: number) => {
    const ms = Math.round((until - t) / 100) * 100
    if (ms >= 100) script.push({ wait: ms })
    t = until
  }
  for (const e of events) {
    wait(e.time)
    const a = e.action
    script.push({ do: a.type === 'thrTrip' ? 'trip' : a.type === 'thrReset' ? 'reset' : a.type, tag: a.tag })
  }
  wait(endTime)
  return script
}

export interface CheckItem {
  tag: string
  kind: OutputKind
  expected: OutputValue
  /** 'none' = 학생 회로에 그 부품이 없음 */
  actual: OutputValue | 'none'
  ok: boolean
}

export interface CheckResult {
  /** 과제 단계 번호 */
  step: number
  /** 시나리오 시작부터의 시각(ms) */
  time: number
  items: CheckItem[]
  /** 단락·발진 등 출력 외의 문제 */
  notes: string[]
  ok: boolean
}

export interface Grade {
  passed: boolean
  checks: CheckResult[]
  /** 처음 틀린 확인점 (checks의 번호), 없으면 null */
  firstFail: number | null
  /** 조작해야 하는데 회로에 없는 입력 장치 등 */
  problems: string[]
  /** 단계마다 시작 시각(ms) */
  stepTimes: number[]
}

/** 조작 대상이 회로에 있는가 */
function hasInput(circuit: Circuit, a: TaskAction): boolean {
  const is = (c: Component) => {
    if (!('tag' in c) || c.tag !== a.tag) return false
    if (a.type === 'thrTrip' || a.type === 'thrReset') {
      return c.kind === 'thrHeater' || (c.kind === 'contact' && (c.device === 'thr' || c.device === 'eocr')) || (c.kind === 'coil' && c.device === 'eocr')
    }
    return (
      c.kind === 'mccb' || c.kind === 'fls' || (c.kind === 'contact' && ['pb', 'selector', 'limit', 'fls'].includes(c.device))
    )
  }
  return circuit.components.some(is)
}

/** 학생 회로를 과제 시나리오대로 돌려 채점한다 */
export function gradeTask(circuit: Circuit, task: Task): Grade {
  const graph = buildGraph(circuit)
  const checks: CheckResult[] = []
  const stepTimes: number[] = []
  const problems: string[] = []
  const missing = new Set<string>()
  for (const s of task.steps) {
    if (s.kind === 'action' && !hasInput(circuit, s.action) && !missing.has(s.action.tag)) {
      missing.add(s.action.tag)
      problems.push(`조작할 ${s.action.tag}이(가) 회로에 없습니다 (번호를 확인하세요)`)
    }
  }
  let time = 0
  simulate(circuit, graph, task.steps, (i, r) => {
    stepTimes.push(time)
    time = r.state.time
    const s = task.steps[i]!
    if (s.kind !== 'check') return
    const actual = new Map(readOutputs(circuit, r).map((o) => [o.tag, o.value]))
    const items = s.expect.map((e): CheckItem => {
      const got = actual.get(e.tag) ?? 'none'
      return { tag: e.tag, kind: e.kind, expected: e.value, actual: got, ok: got === e.value }
    })
    const notes: string[] = []
    if (r.solution.shorts.length) notes.push('단락')
    if (r.oscillating.length) notes.push(`발진(${r.oscillating.join(', ')})`)
    checks.push({ step: i, time: r.state.time, items, notes, ok: items.every((x) => x.ok) && !notes.length })
  })
  const fail = checks.findIndex((c) => !c.ok)
  return { passed: fail < 0 && !problems.length, checks, firstFail: fail < 0 ? null : fail, problems, stepTimes }
}

/**
 * 학생에게 나눠 줄 시작 회로: 전원 모선과 주회로(차단기·주접점·보호계전기 히터·전동기·퓨즈)만 남긴다.
 * 배선은 그 부품들끼리만 잇는 것만 남기고, 조작회로 부품이 하나라도 닿는 배선은 지운다.
 */
export function starterCircuit(answer: Circuit): Circuit {
  const KEEP = new Set(['bus', 'mccb', 'mcMain', 'thrHeater', 'motor', 'fuse', 'terminalBlock', 'ground'])
  const kept = new Set(answer.components.filter((c) => KEEP.has(c.kind)).map((c) => c.id))
  const graph = buildGraph(answer)
  const dirtyNets = new Set<number>()
  for (const [key, node] of graph.terminals) {
    const id = key.slice(0, key.lastIndexOf(':'))
    if (!kept.has(id)) dirtyNets.add(graph.staticNet[node]!)
  }
  const dirtyWires = new Set<string>()
  for (const e of graph.edges) {
    if (e.kind === 'wire' && (dirtyNets.has(graph.staticNet[e.a]!) || dirtyNets.has(graph.staticNet[e.b]!))) dirtyWires.add(e.wireId)
  }
  return {
    version: answer.version,
    name: answer.name,
    components: answer.components.filter((c) => kept.has(c.id)),
    wires: answer.wires.filter((w) => !dirtyWires.has(w.id)),
  }
}

/** 과제 설명에 덧붙일 부품 안내: 쓰는 부품 번호와 타이머·플리커·카운터 설정값 */
export function partsSummary(answer: Circuit): string {
  const tags = new Set<string>()
  const settings: string[] = []
  for (const c of answer.components) {
    if ('tag' in c && c.kind !== 'fuse') tags.add(c.tag)
    if (c.kind === 'coil' && c.preset !== undefined) {
      const name = `${c.tag}`
      if (c.device === 'timer') settings.push(`타이머 ${name} ${c.preset / 1000}초`)
      else if (c.device === 'flicker') settings.push(`플리커릴레이 ${name} ${c.preset / 1000}초`)
      else if (c.device === 'counter') settings.push(`카운터 ${name} ${c.preset}회`)
    }
  }
  const lines = [`부품 번호: ${[...tags].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })).join(', ')}`]
  if (settings.length) lines.push(`설정값: ${settings.join(', ')}`)
  return lines.join('\n')
}

/** 단계 하나를 사람이 읽는 말로 */
export function describeStep(s: TaskStep): string {
  switch (s.kind) {
    case 'wait':
      return `${s.ms / 1000}초 기다림`
    case 'check':
      return '확인'
    case 'action': {
      const a = s.action
      const verb = { press: '누름', release: '뗌', toggle: '전환', thrTrip: '트립(과부하)', thrReset: '리셋' }[a.type]
      return `${a.tag} ${verb}`
    }
  }
}

/** 출력 값을 말로 */
export function outputText(v: OutputValue | 'none'): string {
  return { on: '켜짐', off: '꺼짐', fwd: '정회전', rev: '역회전', stop: '정지', singlePhase: '결상', none: '없음' }[v]
}
