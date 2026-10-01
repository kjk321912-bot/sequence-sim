// 배선 편집 도우미 (순수 함수)
//   - ㄱ자(직교) 경로 만들기
//   - 손가락·펜 위치를 핀·배선·격자점에 맞추기(스냅)
//   - 부품을 옮기거나 돌릴 때 연결된 배선 끝이 따라오게 하기

import { busSegment, onSegment, pinsOf, type Circuit, type Component, type Point, type Wire } from '../engine'

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

/** 겹치는 점과 한 직선 위의 가운데 점을 없앤다 */
export function simplify(points: Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    if (out.length && same(out[out.length - 1]!, p)) continue
    out.push({ x: p.x, y: p.y })
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3) as [Point, Point, Point]
      const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
      if (!collinear) break
      out.splice(out.length - 2, 1)
    }
  }
  return out
}

/** a에서 b까지 ㄱ자 경로. verticalFirst면 세로로 먼저 간다 */
export function lRoute(a: Point, b: Point, verticalFirst: boolean): Point[] {
  const corner = verticalFirst ? { x: a.x, y: b.y } : { x: b.x, y: a.y }
  return simplify([a, corner, b])
}

/** 경로가 끝점이 아닌 곳에서 지나가는 핀 수 (적을수록 좋은 경로) */
function pinsCrossed(circuit: Circuit, route: Point[]): number {
  const first = route[0]!
  const last = route[route.length - 1]!
  let n = 0
  for (const c of circuit.components) {
    for (const p of pinsOf(c)) {
      if (same(p, first) || same(p, last)) continue
      for (let i = 0; i + 1 < route.length; i++) {
        if (onSegment(p, route[i]!, route[i + 1]!)) {
          n++
          break
        }
      }
    }
  }
  return n
}

/**
 * 새 배선 경로를 고른다. 다른 부품 핀 위를 덜 지나가는 ㄱ자 방향을 고르고,
 * 같으면 사용자가 처음 끈 방향(preferVertical)을 따른다.
 */
export function chooseRoute(circuit: Circuit, a: Point, b: Point, preferVertical: boolean): Point[] {
  const first = lRoute(a, b, preferVertical)
  const second = lRoute(a, b, !preferVertical)
  return pinsCrossed(circuit, second) < pinsCrossed(circuit, first) ? second : first
}

export type SnapKind = 'pin' | 'wire' | 'bus' | 'grid'

export interface Snap {
  point: Point
  kind: SnapKind
  /** pin: 부품 id, wire: 배선 id, bus: 모선 id */
  refId?: string
}

/** 점 p에서 선분 a-b 위의 가장 가까운 격자점 */
function nearestGridOnSegment(p: Point, a: Point, b: Point): Point {
  const x = Math.round(Math.min(Math.max(p.x, Math.min(a.x, b.x)), Math.max(a.x, b.x)))
  const y = Math.round(Math.min(Math.max(p.y, Math.min(a.y, b.y)), Math.max(a.y, b.y)))
  return a.x === b.x ? { x: a.x, y } : { x, y: a.y }
}

/**
 * 격자 좌표(실수) p를 가까운 연결 대상에 맞춘다.
 * 우선순위: 핀 → 배선 → 모선 → 격자점. radius는 격자 칸 단위.
 */
export function snapPoint(circuit: Circuit, p: Point, radius: number, ignoreWireId?: string): Snap {
  let best: Snap | null = null
  let bestD = radius
  for (const c of circuit.components) {
    for (const pin of pinsOf(c)) {
      const d = Math.hypot(pin.x - p.x, pin.y - p.y)
      if (d <= bestD) {
        bestD = d
        best = { point: { x: pin.x, y: pin.y }, kind: 'pin', refId: c.id }
      }
    }
  }
  if (best) return best

  bestD = radius * 0.8
  for (const w of circuit.wires) {
    if (w.id === ignoreWireId) continue
    for (let i = 0; i + 1 < w.points.length; i++) {
      const q = nearestGridOnSegment(p, w.points[i]!, w.points[i + 1]!)
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d <= bestD) {
        bestD = d
        best = { point: q, kind: 'wire', refId: w.id }
      }
    }
  }
  if (best) return best

  for (const c of circuit.components) {
    if (c.kind !== 'bus') continue
    const [a, b] = busSegment(c)
    const q = nearestGridOnSegment(p, a, b)
    const d = Math.hypot(q.x - p.x, q.y - p.y)
    if (d <= bestD) {
      bestD = d
      best = { point: q, kind: 'bus', refId: c.id }
    }
  }
  return best ?? { point: { x: Math.round(p.x), y: Math.round(p.y) }, kind: 'grid' }
}

/**
 * 부품 before가 after로 바뀔 때(이동·회전) 그 핀에 끝이 닿아 있던 배선을 따라오게 한다.
 * 가운데 꼭짓점은 그대로 두고 끝점만 옮기며, 직교가 깨지면 꺾인 점을 하나 넣는다.
 * base 회로의 배선을 기준으로 계산하므로, 끌기 중에는 끌기 시작 때의 회로를 넘긴다.
 */
export function followWires(wires: Wire[], before: Component, after: Component): Wire[] {
  const oldPins = pinsOf(before)
  const newPins = pinsOf(after)
  const moved = (p: Point): Point | null => {
    const i = oldPins.findIndex((q) => same(q, p))
    return i >= 0 ? { x: newPins[i]!.x, y: newPins[i]!.y } : null
  }

  return wires.map((w) => {
    const first = w.points[0]!
    const last = w.points[w.points.length - 1]!
    const nf = moved(first)
    const nl = moved(last)
    if (!nf && !nl) return w
    // 양 끝이 모두 이 부품에 붙어 있으면 배선 전체를 같이 옮긴다
    if (nf && nl && nf.x - first.x === nl.x - last.x && nf.y - first.y === nl.y - last.y) {
      const dx = nf.x - first.x
      const dy = nf.y - first.y
      return { ...w, points: w.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    }
    let pts = w.points.map((p) => ({ ...p }))
    if (nl) pts = moveEnd(pts, nl)
    if (nf) pts = moveEnd(pts.reverse(), nf).reverse()
    return { ...w, points: simplify(pts) }
  })
}

/**
 * 배선 없이 다른 부품 핀이나 모선에 바로 붙어 있던 핀을 옮길 때, 끊어지지 않도록 이어 줄 배선.
 * 이미 그 자리에서 배선이 시작·끝나는 경우는 followWires가 처리하므로 제외한다.
 */
export function bridgeWires(circuit: Circuit, before: Component, after: Component): Wire[] {
  const oldPins = pinsOf(before)
  const newPins = pinsOf(after)
  const wireEnds = circuit.wires.flatMap((w) => [w.points[0]!, w.points[w.points.length - 1]!])
  const bridges: Wire[] = []
  oldPins.forEach((p, i) => {
    const q = newPins[i]!
    if (same(p, q) || wireEnds.some((e) => same(e, p))) return
    const touchesOther = circuit.components.some((c) => {
      if (c.id === before.id) return false
      if (c.kind === 'bus') {
        const [a, b] = busSegment(c)
        return onSegment(p, a, b)
      }
      return pinsOf(c).some((o) => same(o, p))
    })
    if (!touchesOther) return
    // 원래 핀이 세로로 이어져 있던 경우가 대부분이므로 세로 먼저
    bridges.push({ id: `w${before.id}_${p.name}`, points: lRoute({ x: p.x, y: p.y }, { x: q.x, y: q.y }, true) })
  })
  return bridges
}

/**
 * 2단자 부품을 배선 위에 겹쳐 놓으면 그 배선을 두 단자 사이에서 끊어 부품을 끼운다.
 * (끊지 않으면 배선이 두 단자 위를 지나가기만 해서 부품을 건너뛴다 — netlist 연결 규칙)
 * 배선이 부품 축을 따라 두 단자를 모두 지나가고, 적어도 한 단자는 선분 중간에 있을 때만 끊는다.
 * 앞쪽 조각은 원래 id를, 뒤쪽 조각은 newId()를 쓴다.
 */
export function insertIntoWires(wires: Wire[], comp: Component, newId: () => string): Wire[] {
  const pins = pinsOf(comp)
  if (pins.length !== 2 || comp.kind === 'terminalBlock') return wires
  const p1: Point = pins[0]!
  const p2: Point = pins[1]!
  const out: Wire[] = []
  for (const w of wires) {
    const i = w.points.findIndex((a, k) => {
      const b = w.points[k + 1]
      if (!b || !onSegment(p1, a, b) || !onSegment(p2, a, b)) return false
      const interior = (p: Point) => !same(p, a) && !same(p, b)
      return interior(p1) || interior(p2)
    })
    if (i < 0) {
      out.push(w)
      continue
    }
    const a = w.points[i]!
    const dist = (p: Point) => Math.abs(p.x - a.x) + Math.abs(p.y - a.y)
    const [near, far] = dist(p1) <= dist(p2) ? [p1, p2] : [p2, p1]
    const head = simplify([...w.points.slice(0, i + 1), near])
    const tail = simplify([far, ...w.points.slice(i + 1)])
    if (head.length >= 2) out.push({ ...w, points: head })
    if (tail.length >= 2) out.push({ id: head.length >= 2 ? newId() : w.id, points: tail })
  }
  return out
}

/** 마지막 점을 to로 옮긴다. 원래 마지막 구간의 방향(세로/가로)을 유지하도록 꺾인 점을 넣는다 */
function moveEnd(pts: Point[], to: Point): Point[] {
  if (pts.length < 2) return [to]
  const prev = pts[pts.length - 2]!
  const oldEnd = pts[pts.length - 1]!
  const body = pts.slice(0, -1)
  if (prev.x === to.x || prev.y === to.y) return [...body, to]
  const lastWasVertical = prev.x === oldEnd.x
  const corner = lastWasVertical ? { x: to.x, y: prev.y } : { x: prev.x, y: to.y }
  return [...body, corner, to]
}
