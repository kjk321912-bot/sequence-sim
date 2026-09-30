// 편집기 상태 (Zustand)
import { create } from 'zustand'
import { rotate, type Circuit, type Component, type Point, type Rotation } from '../engine'
import { PALETTE } from '../editor/palette'
import { showcaseCircuit } from '../examples/showcase'
import { symbolOf } from '../symbols/defs'

export interface View {
  /** 화면 픽셀 기준 이동량 */
  x: number
  y: number
  scale: number
}

export const MIN_SCALE = 0.3
export const MAX_SCALE = 3

export interface EditorStore {
  circuit: Circuit
  selection: string | null
  view: View
  setView: (v: View) => void
  setCircuit: (c: Circuit) => void
  select: (id: string | null) => void
  /** 팔레트 부품을 격자 좌표 at(부품 중심)에 놓는다. 새 부품 id를 돌려준다 */
  addFromPalette: (key: string, at: Point) => string | null
  moveComponent: (id: string, x: number, y: number) => void
  rotateSelected: () => void
  deleteSelected: () => void
}

const AUTOSAVE_KEY = 'sequence-sim:autosave'

function loadAutosave(): Circuit | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    return raw ? (JSON.parse(raw) as Circuit) : null
  } catch {
    return null
  }
}

let idSeq = 0
const newId = (p: string) => `${p}${Date.now().toString(36)}${(idSeq++).toString(36)}`

/** 부품 기호 영역의 중심 (격자 좌표, 회전 반영) */
export function componentCenter(c: Component): Point {
  const { box } = symbolOf(c)
  const local = rotate({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }, c.rot)
  return { x: c.x + local.x, y: c.y + local.y }
}

const updateComp = (circuit: Circuit, id: string, f: (c: Component) => Component): Circuit => ({
  ...circuit,
  components: circuit.components.map((c) => (c.id === id ? f(c) : c)),
})

export const useEditor = create<EditorStore>((set, get) => ({
  circuit: loadAutosave() ?? showcaseCircuit(),
  selection: null,
  view: { x: 40, y: 40, scale: 1 },

  setView: (view) => set({ view }),
  setCircuit: (circuit) => set({ circuit, selection: null }),
  select: (selection) => set({ selection }),

  addFromPalette: (key, at) => {
    const item = PALETTE.find((p) => p.key === key)
    if (!item) return null
    const { circuit } = get()
    const draft = { ...item.make(circuit), id: newId('c'), x: 0, y: 0, rot: 0 as Rotation } as Component
    const center = componentCenter(draft)
    const comp = { ...draft, x: Math.round(at.x - center.x), y: Math.round(at.y - center.y) }
    set({ circuit: { ...circuit, components: [...circuit.components, comp] }, selection: comp.id })
    return comp.id
  },

  moveComponent: (id, x, y) => set({ circuit: updateComp(get().circuit, id, (c) => ({ ...c, x, y })) }),

  rotateSelected: () => {
    const { selection, circuit } = get()
    if (!selection) return
    set({
      circuit: updateComp(circuit, selection, (c) => {
        // 기호 중심이 제자리에 있도록 돌린 뒤 위치를 보정
        const before = componentCenter(c)
        const turned = { ...c, rot: ((c.rot + 90) % 360) as Rotation }
        const after = componentCenter(turned)
        return { ...turned, x: Math.round(c.x + before.x - after.x), y: Math.round(c.y + before.y - after.y) }
      }),
    })
  },

  deleteSelected: () => {
    const { selection, circuit } = get()
    if (!selection) return
    set({ circuit: { ...circuit, components: circuit.components.filter((c) => c.id !== selection) }, selection: null })
  },
}))

// 회로가 바뀌면 기기에 자동 저장 (저장 실패는 무시: 사생활 보호 모드 등)
let saveTimer: ReturnType<typeof setTimeout> | undefined
useEditor.subscribe((s, prev) => {
  if (s.circuit === prev.circuit) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(s.circuit))
    } catch {
      /* 저장 공간 없음 등 */
    }
  }, 500)
})
