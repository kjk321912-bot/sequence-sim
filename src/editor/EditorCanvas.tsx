// 회로 캔버스: 격자 · 배선 · 부품 레이어 (실행 모드에서는 상태색·애니메이션 레이어가 더해진다)
import type Konva from 'konva'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Layer, Line, Shape, Stage } from 'react-konva'
import { buildGraph, pinsOf, type Circuit, type Point } from '../engine'
import { AnimLayer, RunLabels, RunWires } from '../modes/run/RunLayers'
import { visualsOf } from '../modes/run/visuals'
import { useEditor, type View } from '../store/editorStore'
import { useSim } from '../store/simStore'
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
  const tool = useEditor((s) => s.tool)
  const draftWire = useEditor((s) => s.draftWire)
  const running = useSim((s) => s.mode === 'run')
  const result = useSim((s) => s.result)
  const run = running && result ? result : null
  const wiring = !run && (tool === 'wire' || !!draftWire)
  const visuals = useMemo(() => (run ? visualsOf(circuit, run) : null), [circuit, run])
  const junctions = useMemo(() => junctionPoints(circuit), [circuit])

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
    <div ref={wrapRef} className={`canvas-wrap ${run ? 'run' : tool === 'wire' ? 'wire-tool' : ''}`}>
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
          <Layer>
            {run ? (
              <RunWires circuit={circuit} result={run} junctions={junctions} />
            ) : (
              <Wires circuit={circuit} selection={selection} junctions={junctions} />
            )}
          </Layer>
          <Layer>
            {circuit.components.map((c) => (
              <KonvaSymbol key={c.id} comp={c} visual={visuals?.[c.id]} selected={c.id === selection} />
            ))}
          </Layer>
          {run ? (
            <>
              <Layer listening={false}>
                <RunLabels circuit={circuit} result={run} />
              </Layer>
              <AnimLayer circuit={circuit} result={run} />
            </>
          ) : (
            <Layer listening={false}>
              {wiring && <PinDots circuit={circuit} />}
              {draftWire && <DraftWire points={draftWire} />}
            </Layer>
          )}
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

/** 배선·핀·모선이 3개 이상 만나는 점 (접속점 ● 자리) */
function junctionPoints(circuit: Circuit): Point[] {
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
}

/** 배선 + 접속점(●). 배선은 눌러서 선택할 수 있다 */
function Wires({ circuit, selection, junctions }: { circuit: Circuit; selection: string | null; junctions: Point[] }) {
  return (
    <>
      {circuit.wires.map((w) => {
        const selected = w.id === selection
        return (
          <Line
            key={w.id}
            name="wire"
            id={w.id}
            points={w.points.flatMap((p) => [p.x * GRID, p.y * GRID])}
            stroke={selected ? colors.select : colors.wireDead}
            strokeWidth={selected ? 4 : 3}
            hitStrokeWidth={18}
            lineCap="round"
            lineJoin="round"
            shadowColor={selected ? colors.select : undefined}
            shadowBlur={selected ? 10 : 0}
          />
        )
      })}
      {junctions.map((p) => (
        <Circle key={`${p.x},${p.y}`} x={p.x * GRID} y={p.y * GRID} radius={4.5} fill={colors.wireDead} listening={false} />
      ))}
    </>
  )
}

/** 배선할 때 모든 핀 위치 표시 */
function PinDots({ circuit }: { circuit: Circuit }) {
  const pins = useMemo(() => circuit.components.flatMap((c) => pinsOf(c)), [circuit])
  return (
    <>
      {pins.map((p, i) => (
        <Circle key={i} x={p.x * GRID} y={p.y * GRID} radius={4} fill={colors.accent} opacity={0.75} />
      ))}
    </>
  )
}

/** 그리는 중인 배선 미리보기 */
function DraftWire({ points }: { points: Point[] }) {
  const end = points[points.length - 1]
  return (
    <>
      <Line
        points={points.flatMap((p) => [p.x * GRID, p.y * GRID])}
        stroke={colors.accent}
        strokeWidth={3}
        dash={[8, 6]}
        lineCap="round"
        lineJoin="round"
      />
      {end && <Circle x={end.x * GRID} y={end.y * GRID} radius={9} stroke={colors.accent} strokeWidth={2.5} />}
    </>
  )
}
