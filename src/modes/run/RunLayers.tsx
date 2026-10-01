// 실행 모드 캔버스 레이어
//   RunWires   배선 상태색 (무전압·활선·통전·단락) — 결과가 바뀔 때만 다시 그림
//   RunLabels  부품 옆 상태 글자 (카운터 현재값, 전동기 회전 방향 등)
//   AnimLayer  매 프레임 움직이는 것 (전류 흐름 점선, 전동기 날개, 타이머 진행, 단락 깜빡임)
//              시뮬레이션 시간 진행도 이 레이어의 requestAnimationFrame 하나로 한다.
import type Konva from 'konva'
import { useEffect, useMemo, useRef } from 'react'
import { Arc, Circle, Group, Layer, Line, Text } from 'react-konva'
import { pointKey, type Circuit, type StepResult, type WireState } from '../../engine'
import { liveResult, useSim } from '../../store/simStore'
import { arcPts, COIL_R, MOTOR_C } from '../../symbols/defs'
import { colors, GRID } from '../../ui/theme'
import { labelsOf, pointStates, rotorsOf, timerRingsOf, type Label } from './visuals'

const WIRE_COLOR: Record<WireState, string> = {
  dead: colors.wireDead,
  live: colors.wireLive,
  flow: colors.wireFlow,
  short: colors.danger,
}

const px = (v: number) => v * GRID

/** 배선: 눌러서 고를 수 있는 바탕선 + 상태색 선분 + 접속점 */
/**
 * plain이면 배선 상태색을 그리지 않는다 (고장진단: 전류가 끊기는 곳이 보이면 고장 위치가 드러나므로)
 */
export function RunWires({
  circuit,
  result,
  junctions,
  plain = false,
}: {
  circuit: Circuit
  result: StepResult
  junctions: { x: number; y: number }[]
  plain?: boolean
}) {
  const states = useMemo(() => (plain ? new Map<string, WireState>() : pointStates(result)), [result, plain])
  return (
    <>
      {circuit.wires.map((w) => (
        <Line
          key={w.id}
          name="wire"
          id={w.id}
          points={w.points.flatMap((p) => [px(p.x), px(p.y)])}
          stroke={colors.wireDead}
          strokeWidth={3}
          hitStrokeWidth={18}
          lineCap="round"
          lineJoin="round"
        />
      ))}
      {(plain ? [] : result.solution.segments)
        .filter((g) => g.state !== 'dead')
        .map((g, i) => (
          <Line
            key={i}
            points={[px(g.from.x), px(g.from.y), px(g.to.x), px(g.to.y)]}
            stroke={WIRE_COLOR[g.state]}
            strokeWidth={g.state === 'flow' ? 4 : g.state === 'short' ? 5 : 3}
            lineCap="round"
            listening={false}
          />
        ))}
      {junctions.map((p) => (
        <Circle
          key={`${p.x},${p.y}`}
          x={px(p.x)}
          y={px(p.y)}
          radius={4.5}
          fill={WIRE_COLOR[states.get(pointKey(p)) ?? 'dead']}
          listening={false}
        />
      ))}
    </>
  )
}

const TONE: Record<Label['tone'], string> = {
  info: colors.accent,
  ok: colors.wireFlow,
  warn: colors.warn,
  danger: colors.danger,
}

export function RunLabels({ circuit, result }: { circuit: Circuit; result: StepResult }) {
  const labels = useMemo(() => labelsOf(circuit, result), [circuit, result])
  return (
    <>
      {labels.map((l) => (
        <Text
          key={l.key}
          x={px(l.x)}
          y={px(l.y)}
          offsetY={7}
          text={l.text}
          fontSize={14}
          fontStyle="bold"
          fontFamily="Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"
          fill={TONE[l.tone]}
          listening={false}
        />
      ))}
    </>
  )
}

/** 전류 점선이 흐르는 속도 (px/ms) */
const FLOW_SPEED = 0.05
/** 전동기 날개 회전 속도 (도/ms, ×1 기준) */
const ROTOR_SPEED = 0.2

export function AnimLayer({ circuit, result, plain = false }: { circuit: Circuit; result: StepResult; plain?: boolean }) {
  const layerRef = useRef<Konva.Layer>(null)
  // 전류 방향(P→N)으로 점이 흘러가도록 선분 방향을 맞춘다
  const flows = useMemo(
    () =>
      result.solution.segments
        .filter((g) => !plain && g.state === 'flow' && g.dir !== 0)
        .map((g) => (g.dir === 1 ? [g.from, g.to] : [g.to, g.from])),
    [result, plain],
  )
  const shorts = useMemo(() => result.solution.segments.filter((g) => g.state === 'short'), [result])
  const rotors = useMemo(() => rotorsOf(circuit, result), [circuit, result])
  const rings = useMemo(() => timerRingsOf(circuit, result), [circuit, result])

  // 매 프레임 루프가 최신 목록을 읽도록
  const data = useRef({ rotors, rings, busy: false })
  data.current = { rotors, rings, busy: flows.length + shorts.length + rotors.length + rings.length > 0 }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let phase = 0
    let angle = 0
    const frame = (now: number) => {
      const dt = Math.min(now - last, 100)
      last = now
      useSim.getState().advance(dt)
      const { paused, speed } = useSim.getState()
      if (!paused) {
        phase += dt
        angle += dt * ROTOR_SPEED * speed
      }
      const layer = layerRef.current
      const d = data.current
      if (layer && d.busy) {
        layer.find('.flow').forEach((n) => (n as Konva.Line).dashOffset(-phase * FLOW_SPEED))
        const pulse = 0.35 + 0.3 * Math.sin(now / 120)
        layer.find('.short').forEach((n) => n.opacity(pulse))
        for (const r of d.rotors) layer.findOne(`#rotor-${r.id}`)?.rotation(angle * r.dir)
        const timers = liveResult()?.state.timers ?? {}
        for (const r of d.rings) {
          const elapsed = Math.min(timers[r.tag]?.elapsed ?? 0, r.preset)
          const frac = r.preset > 0 ? elapsed / r.preset : 1
          layer.findOne<Konva.Arc>(`#ring-${r.id}`)?.angle(360 * frac)
          layer.findOne<Konva.Text>(`#ringText-${r.id}`)?.text(`${(elapsed / 1000).toFixed(1)}초`)
        }
        layer.batchDraw()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const finR = MOTOR_C.r + 0.3
  return (
    <Layer ref={layerRef} listening={false}>
      {shorts.map((g, i) => (
        <Line
          key={`s${i}`}
          name="short"
          points={[px(g.from.x), px(g.from.y), px(g.to.x), px(g.to.y)]}
          stroke={colors.danger}
          strokeWidth={12}
          lineCap="round"
          opacity={0.4}
        />
      ))}
      {flows.map(([a, b], i) => (
        <Line
          key={`f${i}`}
          name="flow"
          points={[px(a!.x), px(a!.y), px(b!.x), px(b!.y)]}
          stroke={colors.flowDash}
          strokeWidth={2.5}
          dash={[3, 13]}
          lineCap="round"
        />
      ))}
      {rotors.map((r) => (
        <Group key={r.id} id={`rotor-${r.id}`} x={px(r.x)} y={px(r.y)}>
          {[0, 120, 240].map((a) => (
            <Line key={a} points={arcPts(0, 0, finR, a, a + 45, 6).map(px)} stroke={colors.wireFlow} strokeWidth={3} lineCap="round" />
          ))}
        </Group>
      ))}
      {rings.map((r) => (
        <Group key={r.id} x={px(r.x)} y={px(r.y)}>
          <Arc
            id={`ring-${r.id}`}
            innerRadius={px(COIL_R) + 1}
            outerRadius={px(COIL_R) + 4}
            angle={0}
            rotation={-90}
            fill={colors.accent}
          />
          <Text
            id={`ringText-${r.id}`}
            x={px(COIL_R) + 5}
            y={px(COIL_R) + 2}
            text=""
            fontSize={13}
            fontStyle="bold"
            fontFamily="Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"
            fill={colors.accent}
          />
        </Group>
      ))}
    </Layer>
  )
}
