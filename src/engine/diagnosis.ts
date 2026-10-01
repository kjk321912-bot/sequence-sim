// 고장진단: 고장 이름 붙이기, 학생이 지목한 고장 맞추기, 무작위 고장 심기

import { pinsOf } from './geometry'
import type { Circuit, Component, Fault } from './model'
import { buildGraph } from './netlist'

/** 고장 종류 이름 */
export const FAULT_KIND_TEXT: Record<Fault['kind'], string> = {
  wireOpen: '단선',
  contactOpen: '접촉 불량',
  contactWelded: '융착',
  coilBurnt: '코일 소손',
}

/** 부품 이름 (예: "PB1 a접점", "T 한시 a접점", "SS 수동(M) 접점", "MC1 코일") */
export function componentLabel(c: Component): string {
  if (c.kind === 'contact') {
    if (c.device === 'selector') return `${c.tag} ${c.type === 'a' ? '자동(A)' : '수동(M)'} 접점`
    const kind = c.device === 'timer' ? '한시 ' : c.device === 'timerInst' ? '순시 ' : ''
    return `${c.tag} ${kind}${c.type}접점`
  }
  if (c.kind === 'coil') return c.device === 'eocr' ? `${c.tag} 전원` : `${c.tag} 코일`
  if ('tag' in c) return c.tag
  return c.kind
}

/** 배선 이름: 양 끝에 닿은 부품으로 (예: "배선 (T 한시 a접점 ↔ GL)") */
export function wireLabel(circuit: Circuit, wireId: string): string {
  const w = circuit.wires.find((x) => x.id === wireId)
  if (!w) return '배선'
  const ends = [w.points[0]!, w.points[w.points.length - 1]!].map((p) => {
    const c = circuit.components.find((k) => k.kind !== 'bus' && pinsOf(k).some((q) => q.x === p.x && q.y === p.y))
    return c ? componentLabel(c) : null
  })
  const named = ends.filter((x): x is string => !!x)
  return named.length ? `배선 (${named.join(' ↔ ')})` : '배선'
}

export function faultLabel(circuit: Circuit, f: Fault): string {
  if (f.kind === 'wireOpen') return `${wireLabel(circuit, f.wireId)} ${FAULT_KIND_TEXT.wireOpen}`
  const c = circuit.components.find((k) => k.id === f.compId)
  return `${c ? componentLabel(c) : '부품'} ${FAULT_KIND_TEXT[f.kind]}`
}

/** 대상에 심을 수 있는 고장 종류 */
export function faultKindsFor(circuit: Circuit, targetId: string): Fault['kind'][] {
  if (circuit.wires.some((w) => w.id === targetId)) return ['wireOpen']
  const c = circuit.components.find((k) => k.id === targetId)
  if (!c) return []
  if (c.kind === 'contact') return ['contactOpen', 'contactWelded']
  if (c.kind === 'coil' && c.device !== 'eocr') return ['coilBurnt']
  return []
}

export function makeFault(kind: Fault['kind'], targetId: string): Fault {
  return kind === 'wireOpen' ? { kind, wireId: targetId } : { kind, compId: targetId }
}

const targetOf = (f: Fault) => (f.kind === 'wireOpen' ? f.wireId : f.compId)

/** 학생이 지목한 고장이 실제 고장인가: 맞으면 그 고장, 아니면 null */
export function matchFault(circuit: Circuit, targetId: string, kind: Fault['kind']): Fault | null {
  return (circuit.faults ?? []).find((f) => f.kind === kind && targetOf(f) === targetId) ?? null
}

/**
 * 무작위 고장: 조작회로의 접점(접촉 불량), 코일(소손), 배선(단선) 중에서 고른다.
 * 주회로(모선·차단기·주접점·히터·전동기·퓨즈)만 잇는 배선은 고르지 않는다.
 * rand는 0 이상 1 미만의 난수 함수 (테스트에서 고정할 수 있게 밖에서 받는다).
 */
export function randomFaults(circuit: Circuit, count: number, rand: () => number): Fault[] {
  const MAIN = new Set(['bus', 'mccb', 'mcMain', 'thrHeater', 'motor', 'fuse', 'terminalBlock', 'ground'])
  const control = new Set(circuit.components.filter((c) => !MAIN.has(c.kind)).map((c) => c.id))
  const graph = buildGraph({ ...circuit, faults: [] })
  const controlNets = new Set<number>()
  for (const [key, node] of graph.terminals) if (control.has(key.slice(0, key.lastIndexOf(':')))) controlNets.add(graph.staticNet[node]!)
  const controlWires = new Set<string>()
  for (const e of graph.edges) if (e.kind === 'wire' && controlNets.has(graph.staticNet[e.a]!)) controlWires.add(e.wireId)

  const existing = new Set((circuit.faults ?? []).map(targetOf))
  const candidates: Fault[] = [
    ...circuit.components.flatMap((c): Fault[] =>
      c.kind === 'contact' ? [{ kind: 'contactOpen', compId: c.id }] : c.kind === 'coil' && c.device !== 'eocr' ? [{ kind: 'coilBurnt', compId: c.id }] : [],
    ),
    ...[...controlWires].map((wireId): Fault => ({ kind: 'wireOpen', wireId })),
  ].filter((f) => !existing.has(targetOf(f)))

  const picked: Fault[] = []
  while (picked.length < count && candidates.length) {
    const i = Math.floor(rand() * candidates.length)
    picked.push(candidates.splice(i, 1)[0]!)
  }
  return picked
}
