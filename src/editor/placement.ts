// 팔레트를 톡 쳐서 놓을 때 다른 부품과 겹치지 않는 빈 자리 찾기
import { busSegment, rotate, type Circuit, type Component, type Point } from '../engine'
import { symbolOf } from '../symbols/defs'

/** 부품 기호 영역의 중심 (격자 좌표, 회전 반영) */
export function componentCenter(c: Component): Point {
  const { box } = symbolOf(c)
  const local = rotate({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }, c.rot)
  return { x: c.x + local.x, y: c.y + local.y }
}

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 부품이 차지하는 영역 (격자 좌표, 회전 반영) */
export function componentRect(c: Component): Rect {
  if (c.kind === 'bus') {
    const [a, b] = busSegment(c)
    return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y) - 0.5, x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) + 0.5 }
  }
  const { box } = symbolOf(c)
  const p = rotate({ x: box.x0, y: box.y0 }, c.rot)
  const q = rotate({ x: box.x1, y: box.y1 }, c.rot)
  return {
    x0: c.x + Math.min(p.x, q.x),
    y0: c.y + Math.min(p.y, q.y),
    x1: c.x + Math.max(p.x, q.x),
    y1: c.y + Math.max(p.y, q.y),
  }
}

const overlaps = (a: Rect, b: Rect, gap: number) =>
  a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap

/** 배선 선분이 영역을 지나가는가 */
function wireHits(circuit: Circuit, r: Rect): boolean {
  for (const w of circuit.wires) {
    for (let i = 0; i + 1 < w.points.length; i++) {
      const a = w.points[i]!
      const b = w.points[i + 1]!
      const seg = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }
      if (overlaps(seg, r, 0.3)) return true
    }
  }
  return false
}

/**
 * 원하는 중심(at) 가까이에서 부품·배선과 겹치지 않는 자리를 찾아 부품 기준점을 돌려준다.
 * 가까운 곳부터 나선형으로 찾고, 못 찾으면 원래 자리.
 */
export function findFreeSpot(circuit: Circuit, draft: Component, at: Point): Point {
  const center = componentCenter({ ...draft, x: 0, y: 0 })
  const base = { x: Math.round(at.x - center.x), y: Math.round(at.y - center.y) }
  const others = circuit.components.map(componentRect)
  const free = (x: number, y: number) => {
    const r = componentRect({ ...draft, x, y })
    return !others.some((o) => overlaps(o, r, 0.5)) && !wireHits(circuit, r)
  }
  for (let radius = 0; radius <= 30; radius += 1) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue // 둘레만
        if (free(base.x + dx, base.y + dy)) return { x: base.x + dx, y: base.y + dy }
      }
    }
  }
  return base
}
