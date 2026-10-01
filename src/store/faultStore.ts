// 고장진단 탭 상태 (Zustand): 테스터 측정, 고장 지목, (교사) 고장 심기
import { create } from 'zustand'
import {
  buildGraph,
  componentLabel,
  faultKindsFor,
  faultLabel,
  FAULT_KIND_TEXT,
  isProbePoint,
  makeFault,
  matchFault,
  measureResistance,
  measureVoltage,
  probeNode,
  randomFaults,
  wireLabel,
  type Fault,
  type Point,
} from '../engine'
import { snapPoint } from '../editor/wiring'
import { useEditor } from './editorStore'
import { liveResult, useSim } from './simStore'

/** 탭 동작: 조작 / 전압 측정 / 도통 측정 / 고장 지목 / (교사) 고장 심기 */
export type FaultTool = 'operate' | 'volt' | 'ohm' | 'point' | 'plant'

export interface Reading {
  tool: 'volt' | 'ohm'
  text: string
  /** 도통 측정에서 전원이 있어 재지 못함 */
  refused: boolean
}

export interface FaultStore {
  tool: FaultTool
  /** 테스터 리드를 댄 점 (빨강, 검정) */
  probes: Point[]
  reading: Reading | null
  measurements: number
  wrongGuesses: number
  /** 찾아서 고친 고장 */
  found: string[]
  /** 지목·심기 대상으로 고른 부품·배선 */
  target: { id: string; label: string; kinds: Fault['kind'][] } | null

  setTool: (t: FaultTool) => void
  /** 캔버스를 톡 친 곳 (격자 좌표, 맞은 부품·배선) */
  pick: (p: Point, hit: { compId: string | null; wireId: string | null }) => void
  choose: (kind: Fault['kind']) => void
  cancelTarget: () => void
  /** 새 문제를 시작할 때: 측정·지목 기록을 지운다 */
  resetProgress: () => void
  /** (교사) 지금 회로에 무작위 고장 n개를 더 심는다 */
  plantRandom: (n: number) => number
  removeFault: (f: Fault) => void
}

/** 리드를 댈 점 찾기: 단자·배선·모선 가까이 (화면 배율 고려) */
function snapProbe(p: Point): Point | null {
  const { circuit, view } = useEditor.getState()
  const snap = snapPoint(circuit, p, 0.9 / Math.max(view.scale, 0.5))
  const q = snap.point
  return isProbePoint(circuit, q) ? q : null
}

export const useFault = create<FaultStore>((set, get) => ({
  tool: 'operate',
  probes: [],
  reading: null,
  measurements: 0,
  wrongGuesses: 0,
  found: [],
  target: null,

  setTool: (tool) => set({ tool, probes: [], target: null, reading: tool === 'volt' || tool === 'ohm' ? get().reading : null }),

  pick: (p, hit) => {
    const { tool } = get()
    const ed = useEditor.getState()
    if (tool === 'volt' || tool === 'ohm') {
      const q = snapProbe(p)
      if (!q) {
        ed.showToast('테스터는 단자·배선·모선에 대세요')
        return
      }
      const probes = get().probes.length >= 2 ? [q] : [...get().probes, q]
      if (probes.length < 2) {
        set({ probes })
        return
      }
      const live = liveResult()
      if (!live) return
      const circuit = ed.circuit
      const graph = buildGraph(circuit)
      const [a, b] = probes.map((x) => probeNode(circuit, graph, x)) as [number | null, number | null]
      const r =
        tool === 'volt'
          ? { tool, text: measureVoltage(circuit, graph, live.solution, a, b).text, refused: false }
          : (() => {
              const m = measureResistance(circuit, graph, live.solution, a, b)
              return { tool, text: m.text, refused: m.result === 'live' }
            })()
      set({ probes, reading: r, measurements: get().measurements + 1 })
      return
    }
    if (tool === 'point' || tool === 'plant') {
      const id = hit.compId ?? hit.wireId
      if (!id) return
      const kinds = faultKindsFor(ed.circuit, id)
      if (!kinds.length) {
        ed.showToast('고장은 접점·코일·배선에서만 고를 수 있습니다')
        return
      }
      const comp = ed.circuit.components.find((c) => c.id === id)
      set({ target: { id, kinds, label: comp ? componentLabel(comp) : wireLabel(ed.circuit, id) } })
    }
  },

  choose: (kind) => {
    const target = get().target
    if (!target) return
    const ed = useEditor.getState()
    const circuit = ed.circuit
    if (get().tool === 'plant') {
      const f = makeFault(kind, target.id)
      const others = (circuit.faults ?? []).filter((x) => (x.kind === 'wireOpen' ? x.wireId : x.compId) !== target.id)
      ed.setCircuit({ ...circuit, faults: [...others, f] })
      ed.showToast(`고장을 심었습니다: ${faultLabel(circuit, f)}`)
      set({ target: null })
      return
    }
    const hit = matchFault(circuit, target.id, kind)
    if (!hit) {
      set({ target: null, wrongGuesses: get().wrongGuesses + 1 })
      ed.showToast(`아닙니다 — ${target.label} ${FAULT_KIND_TEXT[kind]}이(가) 아닙니다. 다시 측정해 보세요`, 'error')
      return
    }
    // 정답: 고장을 고친다 (회로에서 고장을 뺀다)
    const label = faultLabel(circuit, hit)
    ed.setCircuit({ ...circuit, faults: (circuit.faults ?? []).filter((f) => f !== hit) })
    set({ target: null, found: [...get().found, label] })
    const left = (useEditor.getState().circuit.faults ?? []).length
    ed.showToast(left ? `정답! ${label} — 고쳤습니다. 남은 고장 ${left}개` : `정답! ${label} — 모든 고장을 고쳤습니다`)
  },

  cancelTarget: () => set({ target: null }),

  resetProgress: () => set({ tool: 'operate', probes: [], reading: null, measurements: 0, wrongGuesses: 0, found: [], target: null }),

  plantRandom: (n) => {
    const ed = useEditor.getState()
    const fs = randomFaults(ed.circuit, n, Math.random)
    if (fs.length) ed.setCircuit({ ...ed.circuit, faults: [...(ed.circuit.faults ?? []), ...fs] })
    return fs.length
  },

  removeFault: (f) => {
    const ed = useEditor.getState()
    ed.setCircuit({ ...ed.circuit, faults: (ed.circuit.faults ?? []).filter((x) => x !== f) })
  },
}))

// 회로를 고치면(배선 이동 등) 리드 위치는 맞지 않을 수 있으므로 지운다
useEditor.subscribe((s, prev) => {
  if (s.circuit.wires !== prev.circuit.wires || s.circuit.components !== prev.circuit.components) {
    useFault.setState({ probes: [], target: null })
  }
})

// 고장진단 탭을 떠나면 도구를 조작으로
useSim.subscribe((s, prev) => {
  if (s.mode !== prev.mode && s.mode !== 'fault') useFault.setState({ tool: 'operate', probes: [], target: null })
})
