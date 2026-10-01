// 넷리스트: 회로 도면(부품 핀 + 배선 + 모선)을 연결 그래프로 바꾼다.
//
// 연결 규칙
// - 같은 격자점에 있는 핀과 배선 꼭짓점(끝점·꺾인 점)은 서로 연결된다.
// - 배선 꼭짓점이 다른 배선의 선분 중간에 놓이면 그 지점에서 연결된다(T 접속).
// - 핀이 배선 선분의 "중간"에 놓인 것만으로는 연결되지 않는다.
//   (세로줄을 따라 그은 배선이 접점 두 단자 위를 지나가며 몰래 단락시키는 것을 막는다)
//   단, 배선이 핀의 리드선과 직각으로 지나가며 그 부품의 다른 핀은 지나지 않으면 연결된다.
//   (가로 배선에 램프 위 단자를 갖다 댄 경우: 도면에서 보이는 그대로 T 접속)
// - 배선끼리 교차만 하고 꼭짓점을 공유하지 않으면 연결되지 않는다.
// - 모선은 선분 전체가 단자다. 모선 위에 놓인 핀·배선 끝은 모두 모선에 연결된다.
// - 단선 고장이 심어진 배선은 도통하지 않는다.
//
// 그래프는 회로 모양이 바뀔 때만 다시 만들고, 접점 개폐는 solver에서 반영한다.

import { busSegment, onSegment, pinsOf, pointKey } from './geometry'
import type { Circuit, Phase, Point } from './model'
import { UnionFind } from './unionFind'

export interface WireEdge {
  kind: 'wire'
  a: number
  b: number
  wireId: string
  from: Point
  to: Point
}

export interface BusEdge {
  kind: 'bus'
  a: number
  b: number
  compId: string
}

export type StaticEdge = WireEdge | BusEdge

export interface BusNode {
  compId: string
  phase: Phase
  node: number
}

export interface Graph {
  nodeCount: number
  /** 노드의 격자 좌표. 모선 노드는 null */
  nodePoints: (Point | null)[]
  pointIndex: Map<string, number>
  busNodes: BusNode[]
  edges: StaticEdge[]
  /** `${compId}:${pinName}` → 노드 번호 */
  terminals: Map<string, number>
  /** 배선·모선만으로 묶은 넷 번호 (접점 상태와 무관) */
  staticNet: number[]
}

export const terminalKey = (compId: string, pin: string) => `${compId}:${pin}`

export function buildGraph(circuit: Circuit): Graph {
  const openWires = new Set(
    (circuit.faults ?? []).flatMap((f) => (f.kind === 'wireOpen' ? [f.wireId] : [])),
  )
  const wires = circuit.wires.filter((w) => !openWires.has(w.id))

  const nodePoints: (Point | null)[] = []
  const pointIndex = new Map<string, number>()
  const addPoint = (p: Point) => {
    const k = pointKey(p)
    let i = pointIndex.get(k)
    if (i === undefined) {
      i = nodePoints.length
      nodePoints.push({ x: p.x, y: p.y })
      pointIndex.set(k, i)
    }
    return i
  }

  // 1) 모든 핀과 배선 꼭짓점을 노드로 등록
  const terminals = new Map<string, number>()
  /** 핀 목록. 리드선은 부품의 세로축 방향이므로 0°·180°면 세로, 90°·270°면 가로 */
  const pins: { p: Point; i: number; compId: string; vertical: boolean }[] = []
  for (const c of circuit.components) {
    for (const pin of pinsOf(c)) {
      const i = addPoint(pin)
      terminals.set(terminalKey(c.id, pin.name), i)
      pins.push({ p: { x: pin.x, y: pin.y }, i, compId: c.id, vertical: c.rot === 0 || c.rot === 180 })
    }
  }
  const pinCount = nodePoints.length
  for (const w of wires) for (const p of w.points) addPoint(p)
  const allPoints = nodePoints.map((p, i) => ({ p: p as Point, i }))
  // 배선을 자르는 점: 배선 꼭짓점만 (핀만 있는 점은 제외)
  const vertexKeys = new Set(wires.flatMap((w) => w.points.map(pointKey)))
  const cutPoints = allPoints.filter(({ p, i }) => i >= pinCount || vertexKeys.has(pointKey(p)))

  const edges: StaticEdge[] = []

  // 2) 배선 선분을 그 위에 놓인 점들로 잘라 간선으로 만든다
  for (const w of wires) {
    for (let s = 0; s + 1 < w.points.length; s++) {
      const a = w.points[s] as Point
      const b = w.points[s + 1] as Point
      // 선분과 직각으로 닿은 핀 (같은 부품의 다른 핀까지 지나가면 부품을 가로지르는 것이므로 제외)
      const vertical = a.x === b.x
      const touching = pins.filter(({ p, vertical: v }) => v !== vertical && onSegment(p, a, b))
      const crossed = new Set(touching.map((t) => t.compId).filter((id, k, all) => all.indexOf(id) !== k))
      const extra = touching.filter(
        (t, k) => !crossed.has(t.compId) && !cutPoints.some((q) => q.i === t.i) && touching.findIndex((u) => u.i === t.i) === k,
      )
      const on = [...cutPoints.filter(({ p }) => onSegment(p, a, b)), ...extra.map(({ p, i }) => ({ p, i }))]
        .sort((u, v) => Math.abs(u.p.x - a.x) + Math.abs(u.p.y - a.y) - (Math.abs(v.p.x - a.x) + Math.abs(v.p.y - a.y)))
      for (let k = 0; k + 1 < on.length; k++) {
        const u = on[k]!
        const v = on[k + 1]!
        edges.push({ kind: 'wire', a: u.i, b: v.i, wireId: w.id, from: u.p, to: v.p })
      }
    }
  }

  // 3) 모선: 모선 하나를 노드 하나로 두고, 모선 위의 점들을 연결
  const busNodes: BusNode[] = []
  for (const c of circuit.components) {
    if (c.kind !== 'bus') continue
    const node = nodePoints.length
    nodePoints.push(null)
    busNodes.push({ compId: c.id, phase: c.phase, node })
    const [a, b] = busSegment(c)
    for (const { p, i } of allPoints) {
      if (onSegment(p, a, b)) edges.push({ kind: 'bus', a: node, b: i, compId: c.id })
    }
  }

  const uf = new UnionFind(nodePoints.length)
  for (const e of edges) uf.union(e.a, e.b)
  const staticNet = nodePoints.map((_, i) => uf.find(i))

  return { nodeCount: nodePoints.length, nodePoints, pointIndex, busNodes, edges, terminals, staticNet }
}
