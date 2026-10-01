// 테스터(회로시험기): 두 점 사이의 전압과 도통을 잰다 (고장진단 실습용)
//
// - 전압: 두 점이 서로 다른 상(P–N, 또는 L1·L2·L3 중 두 상)에 이어져 있으면 220 V, 아니면 0 V.
// - 도통(저항): 전원을 끈 상태에서 잰다. 닫힌 접점·배선만으로 이어지면 0 Ω(도통),
//   코일·램프 같은 부하를 거쳐야 이어지면 "저항 있음", 이어지지 않으면 ∞(끊김).
//   전압이 있는 곳에서 저항을 재면 테스터가 망가지므로 측정하지 않고 알려 준다.
// 단자(핀)·배선 꼭짓점·모선에 대고 잰다. 고장(단선·접촉 불량·코일 소손)이 반영된 회로 그대로 계산한다.

import { busSegment, onSegment, pinsOf, pointKey, polesOf } from './geometry'
import type { Circuit, Point } from './model'
import { terminalKey, type Graph } from './netlist'
import { isPowered, type Potential, type Solution } from './solver'
import { UnionFind } from './unionFind'

/** 테스터 리드를 대는 점 → 회로 노드 (닿는 곳이 없으면 null) */
export function probeNode(circuit: Circuit, graph: Graph, p: Point): number | null {
  const direct = graph.pointIndex.get(pointKey(p))
  if (direct !== undefined) return direct
  // 배선 중간: 그 배선 조각의 노드 (배선은 저항이 없으므로 어느 끝이든 같다)
  for (const e of graph.edges) {
    if (e.kind === 'wire' && onSegment(p, e.from, e.to)) return e.a
  }
  // 모선 위
  for (const c of circuit.components) {
    if (c.kind !== 'bus') continue
    const [a, b] = busSegment(c)
    if (onSegment(p, a, b)) return graph.busNodes.find((n) => n.compId === c.id)?.node ?? null
  }
  return null
}

export type VoltReading = { volts: number; text: string }

/** 부하(코일·램프 등)의 두 단자 쌍. 소손된 코일은 끊어져 있다 */
function loadPairs(circuit: Circuit): [string, string, string][] {
  const burnt = new Set((circuit.faults ?? []).flatMap((f) => (f.kind === 'coilBurnt' ? [f.compId] : [])))
  return circuit.components.flatMap((c): [string, string, string][] => {
    if (c.kind === 'coil') return burnt.has(c.id) ? [] : [[c.id, '1', '2']]
    if (c.kind === 'lamp' || c.kind === 'buzzer' || c.kind === 'fls') return [[c.id, '1', '2']]
    if (c.kind === 'motor') return [
      [c.id, 'U', 'V'],
      [c.id, 'V', 'W'],
    ]
    return []
  })
}

/**
 * 테스터가 읽는 전위: 전원에 바로 이어진 곳은 그 전위.
 * 전원에 바로 이어지지 않은 곳은 전류가 흐르지 않는 부하를 거쳐 닿는 전위를 읽는다
 * (예: 열린 접점 아래쪽은 코일을 거쳐 N 전위 → 열린 접점 양단에 220 V가 걸려 보인다).
 * 서로 다른 전위에 함께 닿으면(부하 사이) 정할 수 없어 null.
 */
function meterPotential(circuit: Circuit, graph: Graph, sol: Solution, n: number | null): Potential {
  if (n === null) return null
  const direct = sol.nodePotential[n]!
  if (direct) return direct
  const adj = new Map<number, number[]>()
  for (const [id, p1, p2] of loadPairs(circuit)) {
    const x = graph.terminals.get(terminalKey(id, p1))
    const y = graph.terminals.get(terminalKey(id, p2))
    if (x === undefined || y === undefined) continue
    const gx = sol.group[x]!
    const gy = sol.group[y]!
    if (!adj.has(gx)) adj.set(gx, [])
    if (!adj.has(gy)) adj.set(gy, [])
    adj.get(gx)!.push(gy)
    adj.get(gy)!.push(gx)
  }
  const groupPotential = new Map<number, Potential>()
  sol.group.forEach((g, i) => {
    if (sol.nodePotential[i]) groupPotential.set(g, sol.nodePotential[i]!)
  })
  const start = sol.group[n]!
  const seen = new Set([start])
  const queue = [start]
  const found = new Set<Potential>()
  while (queue.length) {
    const g = queue.shift()!
    for (const h of adj.get(g) ?? []) {
      if (seen.has(h)) continue
      seen.add(h)
      const p = groupPotential.get(h)
      if (p) found.add(p) // 전원에 닿은 곳에서는 더 나아가지 않는다
      else queue.push(h)
    }
  }
  return found.size === 1 ? [...found][0]! : null
}

/** 전압 측정 */
export function measureVoltage(circuit: Circuit, graph: Graph, sol: Solution, a: number | null, b: number | null): VoltReading {
  const pa = meterPotential(circuit, graph, sol, a)
  const pb = meterPotential(circuit, graph, sol, b)
  if (pa === 'short' || pb === 'short') return { volts: 0, text: '0 V (단락)' }
  const v = isPowered(pa, pb) ? 220 : 0
  return { volts: v, text: `${v} V` }
}

export type OhmResult = 'zero' | 'load' | 'open' | 'live'
export type OhmReading = { result: OhmResult; text: string }

/** 도통(저항) 측정 */
export function measureResistance(circuit: Circuit, graph: Graph, sol: Solution, a: number | null, b: number | null): OhmReading {
  if (a === null || b === null) return { result: 'open', text: '∞ Ω (끊김)' }
  if (sol.nodePotential[a] || sol.nodePotential[b]) {
    return { result: 'live', text: '전압이 있습니다 — 전원(MCCB)을 끄고 도통을 재세요' }
  }
  const node = (id: string, pin: string) => graph.terminals.get(terminalKey(id, pin))

  // 1) 배선·모선·닫힌 접점만으로 묶기 (0 Ω)
  const wires = new UnionFind(graph.nodeCount)
  for (const e of graph.edges) wires.union(e.a, e.b)
  for (const c of circuit.components) {
    const states = sol.closed[c.id]
    polesOf(c).forEach(([p1, p2], i) => {
      const x = node(c.id, p1)
      const y = node(c.id, p2)
      if (states?.[i] && x !== undefined && y !== undefined) wires.union(x, y)
    })
  }
  if (wires.find(a) === wires.find(b)) return { result: 'zero', text: '0 Ω (도통)' }

  // 2) 부하(코일·램프·부저·전동기 권선)까지 이어서 묶기 (저항 있음). 소손된 코일은 끊어져 있다
  const loads = new UnionFind(graph.nodeCount)
  for (let i = 0; i < graph.nodeCount; i++) loads.union(i, wires.find(i))
  for (const [id, p1, p2] of loadPairs(circuit)) {
    const x = node(id, p1)
    const y = node(id, p2)
    if (x !== undefined && y !== undefined) loads.union(x, y)
  }
  if (loads.find(a) === loads.find(b)) return { result: 'load', text: '저항 있음 (코일·램프 등 부하를 거쳐 이어짐)' }
  return { result: 'open', text: '∞ Ω (끊김)' }
}

/** 리드를 댈 수 있는 점인가 (단자·배선 꼭짓점·배선 위·모선 위) */
export function isProbePoint(circuit: Circuit, p: Point): boolean {
  if (circuit.components.some((c) => pinsOf(c).some((q) => q.x === p.x && q.y === p.y))) return true
  if (circuit.wires.some((w) => w.points.some((q, i) => (i > 0 && onSegment(p, w.points[i - 1]!, q)) || (q.x === p.x && q.y === p.y)))) return true
  return circuit.components.some((c) => c.kind === 'bus' && onSegment(p, ...busSegment(c)))
}
