// 실행 결과 → 화면 표시 정보 (부품 모양, 배선 색, 덧붙이는 글자·애니메이션 위치)
import {
  contactActivity,
  pointKey,
  resetKey,
  rotate,
  type Circuit,
  type Component,
  type Point,
  type StepResult,
  type WireState,
} from '../../engine'
import { COIL_R, MOTOR_C, type SymbolVisual } from '../../symbols/defs'

/** 부품 기준점 + 회전 전 좌표 → 격자 좌표 */
const at = (c: Component, local: Point): Point => {
  const r = rotate(local, c.rot)
  return { x: c.x + r.x, y: c.y + r.y }
}

/** 코일이 발진 목록에 쓰이는 키 */
function coilKey(c: Component): string | null {
  if (c.kind !== 'coil') return null
  return c.device === 'counterReset' ? resetKey(c.tag) : c.tag
}

/** 부품 id → 기호 모양 상태 */
/** plain이면 접점·차단기 등의 "전류가 흐름" 표시를 빼고 모양(열림·닫힘)만 (고장진단) */
export function visualsOf(circuit: Circuit, r: StepResult, plain = false): Record<string, SymbolVisual> {
  const { state: s, solution: sol } = r
  const active = contactActivity(circuit, s)
  const osc = new Set(r.oscillating)
  const out: Record<string, SymbolVisual> = {}
  for (const c of circuit.components) {
    const conducting = !plain && !!sol.conducting[c.id]
    switch (c.kind) {
      case 'contact':
        out[c.id] = { active: !!active[c.id], conducting }
        break
      case 'coil':
        out[c.id] = { energized: !!sol.energized[c.id], warn: osc.has(coilKey(c) ?? '') }
        break
      case 'lamp':
      case 'buzzer':
        out[c.id] = { energized: !!sol.energized[c.id], ...(sol.dim[c.id] ? { dim: true } : {}) }
        break
      case 'fls':
        out[c.id] = { energized: !!sol.energized[c.id] }
        break
      case 'mccb':
        out[c.id] = { active: !!s.inputs[c.tag], conducting }
        break
      case 'mcMain':
        out[c.id] = { active: !!s.coils[c.tag], conducting }
        break
      case 'thrHeater':
        out[c.id] = { conducting, warn: !!s.thr[c.tag]?.tripped }
        break
      case 'fuse':
        out[c.id] = { blown: !!s.blownFuses[c.id], conducting }
        break
      case 'motor':
        out[c.id] = { motor: sol.motors[c.id] ?? 'stop', hideFins: true }
        break
      default:
        break
    }
  }
  return out
}

const RANK: Record<WireState, number> = { dead: 0, live: 1, flow: 2, short: 3 }

/** 배선이 만나는 점마다 가장 "센" 상태 (접속점 ● 색칠용) */
export function pointStates(r: StepResult): Map<string, WireState> {
  const m = new Map<string, WireState>()
  for (const g of r.solution.segments) {
    for (const p of [g.from, g.to]) {
      const k = pointKey(p)
      const cur = m.get(k)
      if (!cur || RANK[g.state] > RANK[cur]) m.set(k, g.state)
    }
  }
  return m
}

export interface Label {
  key: string
  x: number
  y: number
  text: string
  tone: 'info' | 'ok' | 'warn' | 'danger'
}

/** 부품 옆에 붙이는 실행 상태 글자 (카운터 현재값, 전동기 회전 방향, 트립 등) */
export function labelsOf(circuit: Circuit, r: StepResult): Label[] {
  const { state: s, solution: sol } = r
  const out: Label[] = []
  const side = (c: Component, dy: number) => at(c, { x: COIL_R + 0.2, y: 1.5 + dy })
  for (const c of circuit.components) {
    switch (c.kind) {
      case 'coil':
        if (c.device === 'counter') {
          const p = side(c, 0.7)
          out.push({ key: c.id, ...p, text: `현재 ${s.counters[c.tag]?.count ?? 0}`, tone: 'info' })
        }
        break
      case 'fls': {
        const p = side(c, 0.7)
        out.push({ key: c.id, ...p, text: s.inputs[c.tag] ? '수위 감지' : '수위 없음', tone: s.inputs[c.tag] ? 'info' : 'warn' })
        break
      }
      case 'contact':
        if (c.device === 'selector') {
          const p = at(c, { x: 0.9, y: 2.3 })
          out.push({ key: c.id, ...p, text: s.inputs[c.tag] ? '자동' : '수동', tone: 'info' })
        }
        break
      case 'mccb': {
        const p = at(c, { x: 4.9, y: 1.5 })
        out.push({ key: c.id, ...p, text: s.inputs[c.tag] ? 'ON' : 'OFF', tone: s.inputs[c.tag] ? 'ok' : 'warn' })
        break
      }
      case 'thrHeater':
        if (s.thr[c.tag]?.tripped) {
          const p = at(c, { x: 4.9, y: 1.5 })
          out.push({ key: c.id, ...p, text: '트립', tone: 'danger' })
        }
        break
      case 'motor': {
        const run = sol.motors[c.id] ?? 'stop'
        const p = at(c, { x: MOTOR_C.x + MOTOR_C.r + 0.6, y: MOTOR_C.y })
        const text = { stop: '정지', fwd: '정회전', rev: '역회전', singlePhase: '결상' }[run]
        const tone = run === 'singlePhase' ? 'danger' : run === 'stop' ? 'info' : 'ok'
        out.push({ key: c.id, ...p, text, tone })
        break
      }
      default:
        break
    }
  }
  return out
}

/** 애니메이션 레이어: 회전하는 전동기 날개 */
export interface Rotor {
  id: string
  x: number
  y: number
  /** 1 = 시계 방향(정회전), -1 = 반시계(역회전) */
  dir: 1 | -1
}

export function rotorsOf(circuit: Circuit, r: StepResult): Rotor[] {
  return circuit.components.flatMap((c) => {
    if (c.kind !== 'motor') return []
    const run = r.solution.motors[c.id]
    if (run !== 'fwd' && run !== 'rev') return []
    return [{ id: c.id, ...at(c, MOTOR_C), dir: run === 'fwd' ? 1 : -1 } as Rotor]
  })
}

/** 애니메이션 레이어: 여자 중인 타이머 코일 둘레의 진행 표시 */
export interface TimerRing {
  id: string
  tag: string
  preset: number
  x: number
  y: number
}

export function timerRingsOf(circuit: Circuit, r: StepResult): TimerRing[] {
  return circuit.components.flatMap((c) => {
    if (c.kind !== 'coil' || c.device !== 'timer' || !r.solution.energized[c.id]) return []
    return [{ id: c.id, tag: c.tag, preset: c.preset ?? 0, ...at(c, { x: 0, y: 1.5 }) }]
  })
}
