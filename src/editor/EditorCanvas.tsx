// 회로 캔버스: 격자 · 배선 · 부품 레이어
import type Konva from 'konva'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Layer, Line, Shape, Stage } from 'react-konva'
import { buildGraph, type Circuit } from '../engine'
import { useEditor, type View } from '../store/editorStore'
import { KonvaSymbol } from '../symbols/KonvaSymbol'
import { colors, GRID } from '../ui/theme'
import { useCanvasGestures } from './useCanvasGestures'
import { fitView, registerCanvas } from './viewMath'

export function EditorCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const circuit = useEditor((s) => s.circuit)
  const view = useEditor((s) => s.view)
  const selection = useEditor((s) => s.selection)

  // 캔버스 크기 추적
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    registerCanvas(el)
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      registerCanvas(null)
    }
  }, [])

  // 처음 크기가 정해지면 회로가 꽉 차게
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || !size.width) return
    fitted.current = true
    useEditor.getState().setView(fitView(useEditor.getState().circuit, size.width, size.height))
  }, [size])

  useCanvasGestures(wrapRef, stageRef)

  return (
    <div ref={wrapRef} className="canvas-wrap">
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
        >
          <Layer listening={false}>
            <Grid view={view} width={size.width} height={size.height} />
          </Layer>
          <Layer listening={false}>
            <Wires circuit={circuit} />
          </Layer>
          <Layer>
            {circuit.components.map((c) => (
              <KonvaSymbol key={c.id} comp={c} selected={c.id === selection} />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  )
}

/** 점 격자: 보이는 영역만 그린다. 5칸마다 굵은 점 */
function Grid({ view, width, height }: { view: View; width: number; height: number }) {
  return (
    <Shape
      sceneFunc={(ctx) => {
        const x0 = Math.floor(-view.x / view.scale / GRID) - 1
        const y0 = Math.floor(-view.y / view.scale / GRID) - 1
        const x1 = Math.ceil((width - view.x) / view.scale / GRID) + 1
        const y1 = Math.ceil((height - view.y) / view.scale / GRID) + 1
        // 많이 축소하면 5칸 점만
        const stepMinor = view.scale < 0.6 ? 5 : 1
        const r = 1.2 / view.scale
        for (let gx = Math.ceil(x0 / stepMinor) * stepMinor; gx <= x1; gx += stepMinor) {
          for (let gy = Math.ceil(y0 / stepMinor) * stepMinor; gy <= y1; gy += stepMinor) {
            const major = gx % 5 === 0 && gy % 5 === 0
            ctx.fillStyle = major ? colors.gridMajor : colors.grid
            const rr = major ? r * 1.8 : r
            ctx.fillRect(gx * GRID - rr, gy * GRID - rr, rr * 2, rr * 2)
          }
        }
      }}
    />
  )
}

/** 배선 (2단계: 정적 표시) + 접속점 표시 */
function Wires({ circuit }: { circuit: Circuit }) {
  const junctions = useMemo(() => {
    // 배선·핀·모선이 3개 이상 만나는 점에 접속점(●)
    const g = buildGraph(circuit)
    const degree = new Array<number>(g.nodeCount).fill(0)
    for (const e of g.edges) {
      if (e.kind === 'wire') {
        degree[e.a]!++
        degree[e.b]!++
      } else {
        degree[e.b]!++ // 모선 연결은 점 쪽만
      }
    }
    for (const n of g.terminals.values()) degree[n]!++
    return g.nodePoints.flatMap((p, i) => (p && degree[i]! >= 3 ? [p] : []))
  }, [circuit])

  return (
    <>
      {circuit.wires.map((w) => (
        <Line
          key={w.id}
          points={w.points.flatMap((p) => [p.x * GRID, p.y * GRID])}
          stroke={colors.wireDead}
          strokeWidth={3}
          lineCap="round"
          lineJoin="round"
        />
      ))}
      {junctions.map((p) => (
        <Circle key={`${p.x},${p.y}`} x={p.x * GRID} y={p.y * GRID} radius={4.5} fill={colors.wireDead} />
      ))}
    </>
  )
}
