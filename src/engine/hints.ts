// 조작 안내: 버튼을 눌렀는데 아무 일도 일어나지 않는 흔한 원인을 찾는다.
//
// 조작한 부품의 단자에 전압이 전혀 없으면(무전압) 누르거나 돌려도 회로가 동작하지 않는다.
// 이때 "전원 쪽" 원인(차단기 꺼짐·퓨즈 용단·보호계전기 트립)을 바로잡았다고 가정하고 다시 계산해서
// 전압이 들어오면 그것이 원인이다. 앞쪽 접점이 열려 있어서 무전압인 것은 정상 동작이므로 안내하지 않는다.

import { pinsOf } from './geometry'
import type { Circuit } from './model'
import { terminalKey, type Graph } from './netlist'
import { step, type StepResult } from './scan'

export type PowerCause =
  | { kind: 'noSource' } // 회로에 전원 모선이 하나도 없음
  | { kind: 'mccbOff'; tags: string[] } // 배선용 차단기가 꺼져 있음
  | { kind: 'fuseBlown'; tags: string[] } // 퓨즈 용단
  | { kind: 'tripped'; tags: string[] } // THR·EOCR 트립

/** 부품의 단자 중 하나라도 전압(어느 전위든)이 있는가 */
function hasVoltage(graph: Graph, r: StepResult, compId: string, pins: string[]): boolean {
  return pins.some((p) => {
    const n = graph.terminals.get(terminalKey(compId, p))
    return n !== undefined && r.solution.nodePotential[n] !== null
  })
}

/**
 * 조작한 부품(compId)에 전압이 없는 원인. 전압이 있거나 원인이 전원 쪽이 아니면 빈 배열.
 * 여러 원인이 겹치면 모두 돌려준다.
 */
export function missingPower(circuit: Circuit, graph: Graph, current: StepResult, compId: string): PowerCause[] {
  const comp = circuit.components.find((c) => c.id === compId)
  if (!comp) return []
  const pins = pinsOf(comp).map((p) => p.name)
  if (!pins.length || hasVoltage(graph, current, compId, pins)) return []
  if (!circuit.components.some((c) => c.kind === 'bus')) return [{ kind: 'noSource' }]

  const s = current.state
  const uniq = (xs: string[]) => [...new Set(xs)]
  const mccbOff = uniq(circuit.components.flatMap((c) => (c.kind === 'mccb' && !s.inputs[c.tag] ? [c.tag] : [])))
  const fuseBlown = uniq(circuit.components.flatMap((c) => (c.kind === 'fuse' && s.blownFuses[c.id] ? [c.tag] : [])))
  const tripped = Object.keys(s.thr).filter((t) => s.thr[t]?.tripped)
  if (!mccbOff.length && !fuseBlown.length && !tripped.length) return []

  // 전원 쪽을 모두 정상으로 돌려놓은 가상 상태
  const fixed = {
    ...s,
    inputs: { ...s.inputs, ...Object.fromEntries(mccbOff.map((t) => [t, true])) },
    blownFuses: {},
    thr: Object.fromEntries(Object.entries(s.thr).map(([t, v]) => [t, { ...v, tripped: false }])),
  }
  if (!hasVoltage(graph, step(circuit, graph, fixed, 0), compId, pins)) return []

  const causes: PowerCause[] = []
  if (mccbOff.length) causes.push({ kind: 'mccbOff', tags: mccbOff })
  if (fuseBlown.length) causes.push({ kind: 'fuseBlown', tags: fuseBlown })
  if (tripped.length) causes.push({ kind: 'tripped', tags: tripped })
  return causes
}
