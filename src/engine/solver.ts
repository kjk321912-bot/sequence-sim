// 통전 계산: 현재 접점 개폐 상태에서 어떤 부하가 여자되고 어떤 배선에 전류가 흐르는지 구한다.
//
// 1. 배선·모선으로 이어진 넷을, 닫힌 접점(도체)으로 다시 묶어 "등전위 그룹"을 만든다.
// 2. 그룹에 연결된 모선의 전위(P/N/R/S/T)가 그 그룹의 전위다.
//    서로 다른 전위의 모선이 한 그룹에 들어오면 단락이다.
// 3. 부하(코일·램프·부저)는 두 단자의 전위가 같은 계통(P-N 또는 R/S/T 중 두 상)의
//    서로 다른 전위일 때 여자된다. 조작회로 전원을 주회로 R-T에서 따오는 도면도 동작한다.
// 4. 3상 모터는 U·V·W가 R·S·T에 하나씩 연결되면 회전하고, 상 순서로 정/역이 정해진다.

import { edgeBlocks } from './blocks'
import { polesOf } from './geometry'
import type { Circuit, Component, Phase, Point } from './model'
import { terminalKey, type Graph } from './netlist'
import { UnionFind } from './unionFind'

/** 그룹 전위. null = 어떤 전원에도 연결되지 않음, 'short' = 단락 */
export type Potential = Phase | 'short' | null

export type WireState = 'dead' | 'live' | 'flow' | 'short'

export interface WireSegment {
  wireId: string
  from: Point
  to: Point
  state: WireState
  /** 전류 방향: 1 = from→to, -1 = to→from, 0 = 알 수 없음 */
  dir: -1 | 0 | 1
  potential: Potential
}

export type MotorRun = 'stop' | 'fwd' | 'rev' | 'singlePhase'

export interface Solution {
  /** 노드별 전위 */
  nodePotential: Potential[]
  /** 노드별 등전위 그룹 번호 */
  group: number[]
  /** 도체 부품의 극별 닫힘 여부 */
  closed: Record<string, boolean[]>
  /** 도체 부품에 전류가 흐르는지 (접점 통전 표시용) */
  conducting: Record<string, boolean>
  /** 단락 전류가 지나가는 도체 부품 (퓨즈 용단 판정용) */
  shortThrough: Record<string, boolean>
  /** 부하(코일·램프·부저) 여자 여부 */
  energized: Record<string, boolean>
  motors: Record<string, MotorRun>
  segments: WireSegment[]
  /** 단락된 그룹마다 섞인 전위 목록 */
  shorts: Phase[][]
  /** 직렬로 연결돼 동작하지 않는 부하 (안내 경고용) */
  seriesLoads: string[]
}

const SYSTEM: Record<Phase, 'PN' | 'RST'> = { P: 'PN', N: 'PN', R: 'RST', S: 'RST', T: 'RST' }
const PHASE_ORDER: Record<string, number> = { R: 0, S: 1, T: 2 }

/** 두 단자 전위로 부하가 여자되는가 */
export function isPowered(a: Potential, b: Potential): boolean {
  if (!a || !b || a === 'short' || b === 'short' || a === b) return false
  return SYSTEM[a] === SYSTEM[b]
}

/** 부하 단자 목록 (코일 소손 고장이면 부하에서 제외 = 단선과 같음) */
function loadPins(c: Component, burnt: Set<string>): string[] {
  switch (c.kind) {
    case 'coil':
      return burnt.has(c.id) ? [] : ['1', '2']
    case 'lamp':
    case 'buzzer':
    case 'fls':
      return ['1', '2']
    case 'motor':
      return ['U', 'V', 'W']
    default:
      return []
  }
}

export function solve(circuit: Circuit, graph: Graph, closedOf: (c: Component) => boolean[]): Solution {
  const burnt = new Set((circuit.faults ?? []).flatMap((f) => (f.kind === 'coilBurnt' ? [f.compId] : [])))
  const node = (compId: string, pin: string) => graph.terminals.get(terminalKey(compId, pin))

  // 1) 등전위 그룹
  const uf = new UnionFind(graph.nodeCount)
  for (const e of graph.edges) uf.union(e.a, e.b)

  const closed: Record<string, boolean[]> = {}
  /** 닫힌 극: 흐름 계산용 간선 */
  const poleEdges: { compId: string; a: number; b: number }[] = []
  for (const c of circuit.components) {
    const poles = polesOf(c)
    if (!poles.length) continue
    const states = closedOf(c)
    closed[c.id] = states
    poles.forEach(([p1, p2], i) => {
      const a = node(c.id, p1)
      const b = node(c.id, p2)
      if (states[i] && a !== undefined && b !== undefined) {
        uf.union(a, b)
        poleEdges.push({ compId: c.id, a, b })
      }
    })
  }

  const group = Array.from({ length: graph.nodeCount }, (_, i) => uf.find(i))

  // 2) 그룹 전위
  const groupPhases = new Map<number, Set<Phase>>()
  for (const bn of graph.busNodes) {
    const g = group[bn.node]!
    if (!groupPhases.has(g)) groupPhases.set(g, new Set())
    groupPhases.get(g)!.add(bn.phase)
  }
  const groupPotential = (g: number): Potential => {
    const ps = groupPhases.get(g)
    if (!ps) return null
    return ps.size === 1 ? [...ps][0]! : 'short'
  }
  const nodePotential = group.map(groupPotential)
  const pot = (n: number | undefined): Potential => (n === undefined ? null : nodePotential[n]!)

  const shorts: Phase[][] = []
  for (const ps of groupPhases.values()) if (ps.size > 1) shorts.push([...ps].sort())

  // 3) 부하 여자, 4) 모터
  const energized: Record<string, boolean> = {}
  const motors: Record<string, MotorRun> = {}
  /** 전류가 흘러 들어가는 부하 단자 노드 */
  const sinkNodes: number[] = []
  for (const c of circuit.components) {
    const pins = loadPins(c, burnt)
    if (c.kind === 'motor') {
      const nodes = pins.map((p) => node(c.id, p))
      const ps = nodes.map(pot)
      const phases = new Set(ps.filter((p): p is Phase => !!p && p !== 'short' && SYSTEM[p] === 'RST'))
      let run: MotorRun = 'stop'
      if (phases.size === 3) {
        const [u, v, w] = ps.map((p) => PHASE_ORDER[p as string]!) as [number, number, number]
        run = (v - u + 3) % 3 === 1 && (w - v + 3) % 3 === 1 ? 'fwd' : 'rev'
      } else if (phases.size === 2) {
        run = 'singlePhase'
      }
      motors[c.id] = run
      if (run !== 'stop') {
        nodes.forEach((n, i) => {
          const p = ps[i]
          if (n !== undefined && p && p !== 'short' && SYSTEM[p] === 'RST') sinkNodes.push(n)
        })
      }
    } else if (pins.length === 2) {
      const a = node(c.id, '1')
      const b = node(c.id, '2')
      const on = isPowered(pot(a), pot(b))
      energized[c.id] = on
      if (on) sinkNodes.push(a!, b!)
    } else if (c.kind === 'coil') {
      energized[c.id] = false // 소손된 코일
    }
  }

  // 부하 직렬 연결 감지: 전원에 닿지 않은 한 그룹에 부하 두 개가 매달려 있고,
  // 두 부하의 바깥쪽 단자가 서로 다른 전위(P와 N 등)이면 직렬 연결이다.
  // 교재에서는 부하를 직렬로 연결하지 않으므로 동작시키지 않고 경고만 한다.
  const floating = new Map<number, { id: string; outer: Potential }[]>()
  for (const c of circuit.components) {
    if (c.kind === 'motor' || loadPins(c, burnt).length !== 2) continue
    const a = node(c.id, '1')
    const b = node(c.id, '2')
    if (a === undefined || b === undefined) continue
    for (const [inner, outer] of [
      [a, b],
      [b, a],
    ] as const) {
      const po = pot(outer)
      if (pot(inner) !== null || !po || po === 'short') continue
      const g = group[inner]!
      if (!floating.has(g)) floating.set(g, [])
      floating.get(g)!.push({ id: c.id, outer: po })
    }
  }
  const series = new Set<string>()
  for (const loads of floating.values()) {
    for (const x of loads) {
      if (loads.some((y) => y.id !== x.id && isPowered(x.outer, y.outer))) series.add(x.id)
    }
  }
  const seriesLoads = circuit.components.filter((c) => series.has(c.id)).map((c) => c.id)

  // 5) 전류 경로: 그룹마다 전원(S)과 부하 단자(K)를 가상 간선으로 이어 블록 분해
  type E = readonly [number, number]
  const flowEdges: E[] = [...graph.edges.map((e) => [e.a, e.b] as const), ...poleEdges.map((e) => [e.a, e.b] as const)]
  let nodeCount = graph.nodeCount
  const virtual: { edge: number; src: number; potential: Potential; invert: boolean }[] = []

  const busesByGroup = new Map<number, { phase: Phase; node: number }[]>()
  for (const bn of graph.busNodes) {
    const g = group[bn.node]!
    if (!busesByGroup.has(g)) busesByGroup.set(g, [])
    busesByGroup.get(g)!.push(bn)
  }
  const sinksByGroup = new Map<number, number[]>()
  for (const n of sinkNodes) {
    const g = group[n]!
    if (!sinksByGroup.has(g)) sinksByGroup.set(g, [])
    sinksByGroup.get(g)!.push(n)
  }

  for (const [g, buses] of busesByGroup) {
    const p = groupPotential(g)
    const src = nodeCount++
    const dst = nodeCount++
    if (p === 'short') {
      // 단락: 첫 번째 전위의 모선들 ↔ 나머지 전위의 모선들 사이 경로
      const first = [...groupPhases.get(g)!].sort()[0]
      for (const b of buses) flowEdges.push(b.phase === first ? [src, b.node] : [dst, b.node])
    } else {
      const sinks = sinksByGroup.get(g)
      if (!sinks) continue
      for (const b of buses) flowEdges.push([src, b.node])
      for (const s of sinks) flowEdges.push([dst, s])
    }
    virtual.push({ edge: flowEdges.length, src, potential: p, invert: p === 'N' })
    flowEdges.push([src, dst])
  }

  const blocks = edgeBlocks(nodeCount, flowEdges)
  const edgeState: (WireState | undefined)[] = new Array(flowEdges.length)
  const edgeDir: (-1 | 0 | 1)[] = new Array(flowEdges.length).fill(0)

  for (const v of virtual) {
    const blk = blocks[v.edge]
    const members = new Set<number>()
    blocks.forEach((b, i) => {
      if (b === blk && i !== v.edge) members.add(i)
    })
    // 전원 쪽에서의 거리로 전류 방향 결정 (N 쪽 그룹은 N으로 흘러 들어가므로 반대)
    const adj = new Map<number, { to: number; e: number }[]>()
    for (const i of members) {
      const [a, b] = flowEdges[i]!
      if (!adj.has(a)) adj.set(a, [])
      if (!adj.has(b)) adj.set(b, [])
      adj.get(a)!.push({ to: b, e: i })
      adj.get(b)!.push({ to: a, e: i })
    }
    const dist = new Map<number, number>([[v.src, 0]])
    const queue = [v.src]
    while (queue.length) {
      const u = queue.shift()!
      for (const { to } of adj.get(u) ?? []) {
        if (!dist.has(to)) {
          dist.set(to, dist.get(u)! + 1)
          queue.push(to)
        }
      }
    }
    for (const i of members) {
      const [a, b] = flowEdges[i]!
      edgeState[i] = v.potential === 'short' ? 'short' : 'flow'
      const da = dist.get(a) ?? 0
      const db = dist.get(b) ?? 0
      let d: -1 | 0 | 1 = da < db ? 1 : da > db ? -1 : 0
      if (v.invert) d = (-d as -1 | 0 | 1)
      edgeDir[i] = d
    }
  }

  const segments: WireSegment[] = []
  graph.edges.forEach((e, i) => {
    if (e.kind !== 'wire') return
    const p = nodePotential[e.a]!
    segments.push({
      wireId: e.wireId,
      from: e.from,
      to: e.to,
      state: edgeState[i] ?? (p ? 'live' : 'dead'),
      dir: edgeDir[i]!,
      potential: p,
    })
  })

  const conducting: Record<string, boolean> = {}
  const shortThrough: Record<string, boolean> = {}
  poleEdges.forEach((pe, i) => {
    const st = edgeState[graph.edges.length + i]
    if (st) conducting[pe.compId] = true
    if (st === 'short') shortThrough[pe.compId] = true
  })

  return { nodePotential, group, closed, conducting, shortThrough, energized, motors, segments, shorts, seriesLoads }
}
