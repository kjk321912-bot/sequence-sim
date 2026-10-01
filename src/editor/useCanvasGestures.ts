// 캔버스 입력 처리 (Pointer Events로 손가락·S펜·마우스 통합)
//
//   S펜       핀·배선 근처에서 긋기 → 배선 / 부품 위 → 부품 이동 / 빈 곳 → 화면 이동
//   마우스    핀에서 끌기 → 배선, 배선에서 끌기 → 가지 배선 / 부품 → 이동 / 빈 곳 → 화면 이동
//   손가락    부품 → 이동 / 빈 곳 → 화면 이동 / 두 손가락 → 핀치 줌
//             (툴바의 배선 도구를 켜면 손가락으로도 배선)
//   공통      톡 치기 → 선택, 길게 누르기 → 선택(속성 창) + 진동
//   마우스 휠 → 커서 위치 기준 줌
//
//   실행 모드  푸시버튼은 누르는 동안 동작(여러 손가락으로 동시에 누를 수 있음),
//             셀렉터·리밋·MCCB·보호계전기·퓨즈는 톡 칠 때마다 조작, 끌면 화면 이동.
//             길게 누르기 → 선택(속성 창)으로 설정값을 바꿀 수 있다.

import type Konva from 'konva'
import { useEffect, type RefObject } from 'react'
import type { Action, Circuit, Point } from '../engine'
import { operationOf } from '../modes/run/operate'
import { useEditor } from '../store/editorStore'
import { useFault } from '../store/faultStore'
import { isSimMode, liveResult, useSim } from '../store/simStore'
import { GRID } from '../ui/theme'
import { clampScale, screenToGrid, zoomAt } from './viewMath'
import { chooseRoute, snapPoint, type Snap } from './wiring'

interface Ptr {
  x: number
  y: number
  type: string
}

interface Hit {
  compId: string | null
  wireId: string | null
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'pending'; id: number; sx: number; sy: number; hit: Hit; wireStart: Snap | null; tap: Action | null }
  | { kind: 'held'; id: number } // 길게 눌러 선택한 뒤 손을 뗄 때까지
  | { kind: 'drag'; id: number; compId: string; base: Circuit; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'wire'; id: number; from: Point; preferVertical: boolean; route: Point[] }
  | { kind: 'pan'; id: number; lx: number; ly: number }
  | { kind: 'pinch'; a: number; b: number; dist: number; cx: number; cy: number; view: ReturnType<typeof useEditor.getState>['view'] }

/** 이 거리 이상 움직여야 끌기로 본다 (px) */
const DRAG_SLOP: Record<string, number> = { mouse: 4, pen: 6, touch: 10 }
/** 핀에 달라붙는 거리 (화면 px) */
const SNAP_PX: Record<string, number> = { mouse: 12, pen: 16, touch: 24 }
const LONG_PRESS_MS = 500

export function useCanvasGestures(container: RefObject<HTMLDivElement | null>, stage: RefObject<Konva.Stage | null>) {
  useEffect(() => {
    const el = container.current
    if (!el) return
    const ptrs = new Map<number, Ptr>()
    /** 실행 모드에서 누르고 있는 푸시버튼 (포인터 id → 번호) */
    const pressed = new Map<number, string>()
    let mode: Mode = { kind: 'idle' }
    let longTimer: ReturnType<typeof setTimeout> | undefined

    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    /** 화면 위치의 부품·배선 */
    const hitTest = (x: number, y: number): Hit => {
      const hit: Hit = { compId: null, wireId: null }
      let node: Konva.Node | null = stage.current?.getIntersection({ x, y }) ?? null
      while (node) {
        if (node.name() === 'comp') hit.compId = node.id()
        if (node.name() === 'wire') hit.wireId = node.id()
        node = node.getParent()
      }
      return hit
    }

    const cancelLongPress = () => clearTimeout(longTimer)

    const endWireDraft = () => useEditor.getState().setDraftWire(null)

    const startPinch = () => {
      const [a, b] = [...ptrs.entries()]
      if (!a || !b) return
      if (mode.kind === 'wire') endWireDraft()
      mode = {
        kind: 'pinch',
        a: a[0],
        b: b[0],
        dist: Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y) || 1,
        cx: (a[1].x + b[1].x) / 2,
        cy: (a[1].y + b[1].y) / 2,
        view: useEditor.getState().view,
      }
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return
      el.setPointerCapture(e.pointerId)
      const p = local(e)
      const store = useEditor.getState()
      const running = isSimMode(useSim.getState().mode)

      // 실행 모드: 푸시버튼은 다른 손가락과 상관없이 바로 누른다 (화면 이동·핀치에 끼지 않음)
      let tap: Action | null = null
      if (running && e.button === 0) {
        const hitComp = hitTest(p.x, p.y).compId
        const comp = store.circuit.components.find((c) => c.id === hitComp)
        const live = liveResult()
        // 과제 채점 재생 중에는 손으로 조작하지 않는다
        // 고장진단에서 테스터·지목 도구를 쓰는 중이면 톡 치기는 측정·지목이다
        const measuring = useSim.getState().mode === 'fault' && useFault.getState().tool !== 'operate'
        const op = comp && live && !useSim.getState().driven && !measuring ? operationOf(comp, live.state) : null
        if (op?.kind === 'momentary') {
          pressed.set(e.pointerId, op.tag)
          useSim.getState().act({ type: 'press', tag: op.tag }, comp!.id)
          navigator.vibrate?.(10)
          return
        }
        tap = op?.kind === 'tap' ? op.action : null
      }

      ptrs.set(e.pointerId, { ...p, type: e.pointerType })

      if (ptrs.size === 2 && e.pointerType === 'touch') {
        cancelLongPress()
        startPinch() // 끌던 부품은 그 자리에 둔다
        return
      }
      if (ptrs.size > 1) return

      const hit: Hit = e.button === 1 ? { compId: null, wireId: null } : hitTest(p.x, p.y)
      const g = screenToGrid(store.view, p.x, p.y)
      const radius = (SNAP_PX[e.pointerType] ?? 14) / (GRID * store.view.scale)
      const snap = snapPoint(store.circuit, g, radius)

      // 배선을 시작하는가
      let wireIntent = false
      if (e.button !== 1 && !running) {
        if (store.tool === 'wire') wireIntent = true
        else if (e.pointerType === 'pen') wireIntent = snap.kind === 'pin' || (!hit.compId && (snap.kind === 'wire' || !!hit.wireId))
        else if (e.pointerType === 'mouse') wireIntent = snap.kind === 'pin' || (!hit.compId && !!hit.wireId)
      }
      mode = { kind: 'pending', id: e.pointerId, sx: p.x, sy: p.y, hit, wireStart: wireIntent ? snap : null, tap }

      // 길게 누르기: 선택 + 속성 창
      cancelLongPress()
      longTimer = setTimeout(() => {
        if (mode.kind !== 'pending' || mode.id !== e.pointerId) return
        const target = mode.hit.compId ?? mode.hit.wireId
        if (!target || useSim.getState().driven) return
        useEditor.getState().select(target)
        navigator.vibrate?.(15)
        mode = { kind: 'held', id: e.pointerId }
      }, LONG_PRESS_MS)
    }

    const onMove = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return
      const p = local(e)
      ptrs.set(e.pointerId, { ...p, type: e.pointerType })
      const store = useEditor.getState()

      if (mode.kind === 'pending' && mode.id === e.pointerId) {
        const dx = p.x - mode.sx
        const dy = p.y - mode.sy
        if (Math.hypot(dx, dy) < (DRAG_SLOP[e.pointerType] ?? 6)) return
        cancelLongPress()
        if (mode.wireStart) {
          mode = { kind: 'wire', id: e.pointerId, from: mode.wireStart.point, preferVertical: Math.abs(dy) >= Math.abs(dx), route: [] }
        } else if (mode.hit.compId && useSim.getState().mode === 'edit') {
          const c = store.circuit.components.find((k) => k.id === (mode as { hit: Hit }).hit.compId)
          if (!c) return
          store.select(c.id)
          const base = store.beginDrag()
          mode = { kind: 'drag', id: e.pointerId, compId: c.id, base, sx: mode.sx, sy: mode.sy, ox: c.x, oy: c.y }
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
        if (c && (c.x !== x || c.y !== y)) store.dragComponent(mode.base, dragId, x, y)
      } else if (mode.kind === 'wire' && mode.id === e.pointerId) {
        const g = screenToGrid(store.view, p.x, p.y)
        const radius = (SNAP_PX[e.pointerType] ?? 14) / (GRID * store.view.scale)
        const end = snapPoint(store.circuit, g, radius)
        const route = chooseRoute(store.circuit, mode.from, end.point, mode.preferVertical)
        mode = { ...mode, route }
        store.setDraftWire(route)
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
      const held = pressed.get(e.pointerId)
      if (held !== undefined) {
        pressed.delete(e.pointerId)
        // 같은 버튼을 다른 손가락이 아직 누르고 있으면 그대로 둔다
        if (![...pressed.values()].includes(held)) useSim.getState().act({ type: 'release', tag: held })
        return
      }
      if (!ptrs.has(e.pointerId)) return
      ptrs.delete(e.pointerId)
      cancelLongPress()
      const store = useEditor.getState()

      if (mode.kind === 'pending' && mode.id === e.pointerId && e.type === 'pointerup') {
        if (isSimMode(useSim.getState().mode)) {
          // 실행 모드의 톡 치기는 조작. 속성 창은 닫는다
          store.select(null)
          if (useSim.getState().mode === 'fault' && useFault.getState().tool !== 'operate') {
            useFault.getState().pick(screenToGrid(store.view, mode.sx, mode.sy), mode.hit)
          } else if (mode.tap) {
            useSim.getState().act(mode.tap, mode.hit.compId)
            navigator.vibrate?.(10)
          }
        } else {
          // 톡 치기: 부품 → 배선 → 빈 곳(선택 해제) 순서로 선택
          store.select(mode.hit.compId ?? mode.hit.wireId)
        }
      }
      if (mode.kind === 'wire' && mode.id === e.pointerId) {
        const route = mode.route
        endWireDraft()
        if (e.type === 'pointerup' && route.length >= 2) store.addWire(route)
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
      cancelLongPress()
      for (const tag of new Set(pressed.values())) useSim.getState().act({ type: 'release', tag })
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [container, stage])
}
