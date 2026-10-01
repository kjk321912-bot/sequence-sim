// 편집기 상태 (Zustand)
import { create } from 'zustand'
import type { Circuit, Component, Point, Rotation } from '../engine'
import { PALETTE } from '../editor/palette'
import { componentCenter, findFreeSpot } from '../editor/placement'
import { bridgeWires, followWires, insertIntoWires, simplify } from '../editor/wiring'
import { showcaseCircuit } from '../examples/showcase'

export interface View {
  /** 화면 픽셀 기준 이동량 */
  x: number
  y: number
  scale: number
}

export const MIN_SCALE = 0.3
export const MAX_SCALE = 3
const HISTORY_LIMIT = 100

export type Tool = 'select' | 'wire'

export interface Toast {
  text: string
  kind: 'info' | 'error'
  id: number
}

export interface EditorStore {
  circuit: Circuit
  /** 선택된 부품 또는 배선 id */
  selection: string | null
  view: View
  /** 선택 도구 / 배선 도구 (손가락으로 배선할 때) */
  tool: Tool
  /** 그리는 중인 배선 미리보기 */
  draftWire: Point[] | null
  past: Circuit[]
  future: Circuit[]
  toast: Toast | null

  setView: (v: View) => void
  setTool: (t: Tool) => void
  setDraftWire: (pts: Point[] | null) => void
  /** 새 회로·예제·파일 불러오기 (되돌리기 가능) */
  setCircuit: (c: Circuit) => void
  renameCircuit: (name: string) => void
  select: (id: string | null) => void
  /**
   * 팔레트 부품을 격자 좌표 at(부품 중심)에 놓는다. 새 부품 id를 돌려준다.
   * findSpot이면 at 근처에서 다른 부품·배선과 겹치지 않는 자리를 찾는다 (톡 쳐서 놓기).
   */
  addFromPalette: (key: string, at: Point, findSpot?: boolean) => string | null
  /** 끌기 시작: 되돌리기 기록을 한 번만 남기고, 배선 따라오기의 기준 회로를 돌려준다 */
  beginDrag: () => Circuit
  /** 끌기 중 이동 (base: beginDrag가 돌려준 회로) */
  dragComponent: (base: Circuit, id: string, x: number, y: number) => void
  /** 부품 속성 변경 (번호, a/b, 설정값 등) */
  updateComponent: (id: string, patch: Partial<Component>) => void
  addWire: (points: Point[]) => string | null
  rotateSelected: () => void
  deleteSelected: () => void
  undo: () => void
  redo: () => void
  showToast: (text: string, kind?: Toast['kind']) => void
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

export { componentCenter }

/** 연속 입력(속성 칸 타이핑 등)을 되돌리기 한 번으로 묶기 위한 기록 */
let lastCommit = { key: '', at: 0 }

export const useEditor = create<EditorStore>((set, get) => {
  /**
   * 회로 변경을 되돌리기 기록에 남기며 적용한다.
   * coalesceKey가 직전 변경과 같고 1.5초 안이면 기록을 새로 쌓지 않는다.
   */
  const commit = (next: Circuit, extra: Partial<EditorStore> = {}, coalesceKey = '') => {
    const { circuit, past } = get()
    const now = Date.now()
    const merge = coalesceKey !== '' && coalesceKey === lastCommit.key && now - lastCommit.at < 1500
    lastCommit = { key: coalesceKey, at: now }
    set({
      circuit: next,
      past: merge ? past : [...past, circuit].slice(-HISTORY_LIMIT),
      future: [],
      ...extra,
    })
  }

  /**
   * 부품 하나를 바꾸고(이동·회전·속성) 연결된 배선을 따라오게 한다.
   * 배선 없이 다른 핀·모선에 바로 붙어 있던 핀은 이어 주는 배선을 새로 만든다.
   * 배선 위에 겹쳐 놓으면 그 배선을 끊고 부품을 끼운다.
   */
  const replaceComp = (circuit: Circuit, before: Component, after: Component): Circuit => {
    const bridges = bridgeWires(circuit, before, after).map((w) => ({ ...w, id: newId('w') }))
    return {
      ...circuit,
      components: circuit.components.map((c) => (c.id === before.id ? after : c)),
      wires: insertIntoWires([...followWires(circuit.wires, before, after), ...bridges], after, () => newId('w')),
    }
  }

  return {
    circuit: loadAutosave() ?? showcaseCircuit(),
    selection: null,
    view: { x: 40, y: 40, scale: 1 },
    tool: 'select',
    draftWire: null,
    past: [],
    future: [],
    toast: null,

    setView: (view) => set({ view }),
    setTool: (tool) => set({ tool }),
    setDraftWire: (draftWire) => set({ draftWire }),
    setCircuit: (circuit) => commit(circuit, { selection: null }),
    renameCircuit: (name) => {
      const n = name.trim()
      if (n && n !== get().circuit.name) commit({ ...get().circuit, name: n })
    },
    select: (selection) => set({ selection }),

    addFromPalette: (key, at, findSpot = false) => {
      const item = PALETTE.find((p) => p.key === key)
      if (!item) return null
      const { circuit } = get()
      const draft = { ...item.make(circuit), id: newId('c'), x: 0, y: 0, rot: 0 as Rotation } as Component
      const center = componentCenter(draft)
      const pos = findSpot ? findFreeSpot(circuit, draft, at) : { x: Math.round(at.x - center.x), y: Math.round(at.y - center.y) }
      const comp = { ...draft, ...pos }
      const wires = insertIntoWires(circuit.wires, comp, () => newId('w'))
      commit({ ...circuit, components: [...circuit.components, comp], wires }, { selection: comp.id })
      return comp.id
    },

    beginDrag: () => {
      const { circuit, past } = get()
      set({ past: [...past, circuit].slice(-HISTORY_LIMIT), future: [] })
      lastCommit = { key: '', at: 0 }
      return circuit
    },

    dragComponent: (base, id, x, y) => {
      const before = base.components.find((c) => c.id === id)
      if (!before) return
      set({ circuit: replaceComp({ ...base, name: get().circuit.name }, before, { ...before, x, y }) })
    },

    updateComponent: (id, patch) => {
      const circuit = get().circuit
      const before = circuit.components.find((c) => c.id === id)
      if (!before) return
      const after = { ...before, ...patch, id: before.id, kind: before.kind } as Component
      commit(replaceComp(circuit, before, after), {}, `${id}:${Object.keys(patch).join(',')}`)
    },

    addWire: (points) => {
      const pts = simplify(points)
      if (pts.length < 2) return null
      const id = newId('w')
      const circuit = get().circuit
      commit({ ...circuit, wires: [...circuit.wires, { id, points: pts }] }, { selection: null })
      return id
    },

    rotateSelected: () => {
      const { selection, circuit } = get()
      const c = circuit.components.find((k) => k.id === selection)
      if (!c) return
      // 기호 중심이 제자리에 있도록 돌린 뒤 위치를 보정
      const before = componentCenter(c)
      const turned = { ...c, rot: ((c.rot + 90) % 360) as Rotation }
      const after = componentCenter(turned)
      const moved = { ...turned, x: Math.round(c.x + before.x - after.x), y: Math.round(c.y + before.y - after.y) }
      commit(replaceComp(circuit, c, moved))
    },

    deleteSelected: () => {
      const { selection, circuit } = get()
      if (!selection) return
      const faults = circuit.faults?.filter(
        (f) => !('compId' in f && f.compId === selection) && !('wireId' in f && f.wireId === selection),
      )
      commit(
        {
          ...circuit,
          components: circuit.components.filter((c) => c.id !== selection),
          wires: circuit.wires.filter((w) => w.id !== selection),
          ...(faults ? { faults } : {}),
        },
        { selection: null },
      )
    },

    undo: () => {
      const { past, future, circuit } = get()
      const prev = past[past.length - 1]
      if (!prev) return
      lastCommit = { key: '', at: 0 }
      set({ circuit: prev, past: past.slice(0, -1), future: [circuit, ...future], selection: null })
    },

    redo: () => {
      const { past, future, circuit } = get()
      const next = future[0]
      if (!next) return
      lastCommit = { key: '', at: 0 }
      set({ circuit: next, past: [...past, circuit], future: future.slice(1), selection: null })
    },

    showToast: (text, kind = 'info') => set({ toast: { text, kind, id: Date.now() } }),
  }
})

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
