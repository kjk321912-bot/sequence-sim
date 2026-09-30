// 캔버스 입력 처리 (Pointer Events로 손가락·S펜·마우스 통합)
//
//   한 손가락 / 마우스 / S펜
//     - 부품 위에서 끌기 → 부품 이동 (격자 스냅)
//     - 빈 곳에서 끌기 → 화면 이동
//     - 톡 치기 → 부품 선택 / 선택 해제
//   두 손가락 → 핀치 줌 + 화면 이동
//   마우스 휠 → 커서 위치 기준 줌
//
// 3단계에서 S펜 배선, 롱프레스가 추가된다.

import type Konva from 'konva'
import { useEffect, type RefObject } from 'react'
import { useEditor } from '../store/editorStore'
import { GRID } from '../ui/theme'
import { clampScale, zoomAt } from './viewMath'

interface Ptr {
  x: number
  y: number
  type: string
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'pending'; id: number; sx: number; sy: number; compId: string | null }
  | { kind: 'drag'; id: number; compId: string; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'pan'; id: number; lx: number; ly: number }
  | { kind: 'pinch'; a: number; b: number; dist: number; cx: number; cy: number; view: ReturnType<typeof useEditor.getState>['view'] }

/** 이 거리 이상 움직여야 끌기로 본다 (px) */
const DRAG_SLOP = { mouse: 4, pen: 6, touch: 10 } as Record<string, number>

export function useCanvasGestures(container: RefObject<HTMLDivElement | null>, stage: RefObject<Konva.Stage | null>) {
  useEffect(() => {
    const el = container.current
    if (!el) return
    const ptrs = new Map<number, Ptr>()
    let mode: Mode = { kind: 'idle' }

    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    /** 화면 위치의 부품 id */
    const hitComponent = (x: number, y: number): string | null => {
      const shape = stage.current?.getIntersection({ x, y })
      let node: Konva.Node | null = shape ?? null
      while (node) {
        if (node.name() === 'comp') return node.id()
        node = node.getParent()
      }
      return null
    }

    const startPinch = () => {
      const [a, b] = [...ptrs.entries()]
      if (!a || !b) return
      const cx = (a[1].x + b[1].x) / 2
      const cy = (a[1].y + b[1].y) / 2
      mode = {
        kind: 'pinch',
        a: a[0],
        b: b[0],
        dist: Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y) || 1,
        cx,
        cy,
        view: useEditor.getState().view,
      }
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return
      el.setPointerCapture(e.pointerId)
      const p = local(e)
      ptrs.set(e.pointerId, { ...p, type: e.pointerType })

      if (ptrs.size === 2 && e.pointerType === 'touch') {
        startPinch() // 끌던 부품은 그 자리에 둔다
        return
      }
      if (ptrs.size > 1) return
      const compId = e.button === 1 ? null : hitComponent(p.x, p.y)
      mode = { kind: 'pending', id: e.pointerId, sx: p.x, sy: p.y, compId }
    }

    const onMove = (e: PointerEvent) => {
      const prev = ptrs.get(e.pointerId)
      if (!prev) return
      const p = local(e)
      ptrs.set(e.pointerId, { ...p, type: e.pointerType })
      const store = useEditor.getState()

      if (mode.kind === 'pending' && mode.id === e.pointerId) {
        if (Math.hypot(p.x - mode.sx, p.y - mode.sy) < (DRAG_SLOP[e.pointerType] ?? 6)) return
        const hitId = mode.compId
        if (hitId) {
          const c = store.circuit.components.find((k) => k.id === hitId)
          if (!c) return
          store.select(c.id)
          mode = { kind: 'drag', id: e.pointerId, compId: c.id, sx: mode.sx, sy: mode.sy, ox: c.x, oy: c.y }
        } else {
          mode = { kind: 'pan', id: e.pointerId, lx: mode.sx, ly: mode.sy }
        }
      }

      if (mode.kind === 'drag' && mode.id === e.pointerId) {
        const step = GRID * store.view.scale
        const x = mode.ox + Math.round((p.x - mode.sx) / step)
        const y = mode.oy + Math.round((p.y - mode.sy) / step)
        const dragId = mode.compId
        const c = store.circuit.components.find((k) => k.id === dragId)
        if (c && (c.x !== x || c.y !== y)) store.moveComponent(dragId, x, y)
      } else if (mode.kind === 'pan' && mode.id === e.pointerId) {
        const v = store.view
        store.setView({ ...v, x: v.x + p.x - mode.lx, y: v.y + p.y - mode.ly })
        mode = { ...mode, lx: p.x, ly: p.y }
      } else if (mode.kind === 'pinch') {
        const a = ptrs.get(mode.a)
        const b = ptrs.get(mode.b)
        if (!a || !b) return
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        const v0 = mode.view
        const scale = clampScale(v0.scale * (dist / mode.dist))
        // 처음 두 손가락 중심 아래의 도면 지점이 현재 중심을 따라가도록
        const wx = (mode.cx - v0.x) / v0.scale
        const wy = (mode.cy - v0.y) / v0.scale
        store.setView({ scale, x: cx - wx * scale, y: cy - wy * scale })
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return
      ptrs.delete(e.pointerId)
      if (mode.kind === 'pending' && mode.id === e.pointerId && e.type === 'pointerup') {
        // 톡 치기: 선택 / 해제
        useEditor.getState().select(mode.compId)
      }
      if (mode.kind === 'pinch') {
        // 손가락 하나만 남으면 그 손가락으로 화면 이동을 이어간다
        const rest = [...ptrs.entries()][0]
        mode = rest ? { kind: 'pan', id: rest[0], lx: rest[1].x, ly: rest[1].y } : { kind: 'idle' }
        return
      }
      if (ptrs.size === 0) mode = { kind: 'idle' }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      const store = useEditor.getState()
      const v = store.view
      if (e.ctrlKey || e.deltaMode !== 0 || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        // 휠·트랙패드 핀치(ctrl+휠) → 줌
        store.setView(zoomAt(v, p.x, p.y, v.scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))))
      } else {
        store.setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [container, stage])
}
