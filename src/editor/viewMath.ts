// 화면 좌표 ↔ 격자 좌표 변환, 화면 맞춤 계산
import { busSegment, rotate, type Circuit, type Point } from '../engine'
import { MAX_SCALE, MIN_SCALE, type View } from '../store/editorStore'
import { symbolOf } from '../symbols/defs'
import { GRID } from '../ui/theme'

/** 캔버스 요소 (팔레트에서 끌어다 놓을 때 위치 계산용) */
let canvasEl: HTMLElement | null = null
export const registerCanvas = (el: HTMLElement | null) => {
  canvasEl = el
}
export const getCanvasRect = () => canvasEl?.getBoundingClientRect() ?? null

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

/** 캔버스 안 픽셀 좌표 → 격자 좌표(실수) */
export function screenToGrid(view: View, sx: number, sy: number): Point {
  return { x: (sx - view.x) / view.scale / GRID, y: (sy - view.y) / view.scale / GRID }
}

/** 화면의 한 점(sx,sy)을 고정한 채 배율을 바꾼다 */
export function zoomAt(view: View, sx: number, sy: number, scale: number): View {
  const s = clampScale(scale)
  const wx = (sx - view.x) / view.scale
  const wy = (sy - view.y) / view.scale
  return { scale: s, x: sx - wx * s, y: sy - wy * s }
}

/** 회로 전체 영역 (격자 좌표) */
export function circuitBounds(c: Circuit) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const add = (p: Point) => {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  for (const comp of c.components) {
    if (comp.kind === 'bus') {
      busSegment(comp).forEach(add)
      continue
    }
    const { box } = symbolOf(comp)
    for (const corner of [
      { x: box.x0, y: box.y0 },
      { x: box.x1, y: box.y1 },
    ]) {
      const r = rotate(corner, comp.rot)
      add({ x: comp.x + r.x, y: comp.y + r.y })
    }
  }
  for (const w of c.wires) w.points.forEach(add)
  if (x0 === Infinity) return null
  return { x0, y0, x1, y1 }
}

/** 회로가 화면에 꽉 차게 보이는 View */
export function fitView(c: Circuit, width: number, height: number, margin = 48): View {
  const b = circuitBounds(c)
  if (!b) return { x: width / 2, y: height / 2, scale: 1 }
  const w = (b.x1 - b.x0 + 2) * GRID
  const h = (b.y1 - b.y0 + 2) * GRID
  const scale = clampScale(Math.min((width - 2 * margin) / w, (height - 2 * margin) / h, 1.6))
  const cx = ((b.x0 + b.x1) / 2) * GRID
  const cy = ((b.y0 + b.y1) / 2) * GRID
  return { scale, x: width / 2 - cx * scale, y: height / 2 - cy * scale }
}
