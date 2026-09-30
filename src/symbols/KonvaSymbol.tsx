// 캔버스용 부품 기호 렌더러
import type Konva from 'konva'
import { memo, useLayoutEffect, useRef } from 'react'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { rotate, type Component } from '../engine'
import { colors, GRID } from '../ui/theme'
import { symbolOf, type Prim, type SymbolVisual } from './defs'

interface Props {
  comp: Component
  visual?: SymbolVisual
  selected?: boolean
  /** 드래그 중 반투명 표시 */
  ghost?: boolean
}

const STROKE = 2
/** 접점 막대가 움직이는 시간(초) */
const BAR_MOVE_SEC = 0.12

export const KonvaSymbol = memo(function KonvaSymbol({ comp, visual, selected, ghost }: Props) {
  const def = symbolOf(comp, visual)
  const { box } = def
  const body = def.prims.filter((p): p is Exclude<Prim, { t: 'text' }> => p.t !== 'text' && !p.move)
  const moving = def.prims.filter((p): p is Exclude<Prim, { t: 'text' }> => p.t !== 'text' && !!p.move)
  const texts = def.prims.filter((p): p is Extract<Prim, { t: 'text' }> => p.t === 'text')
  const pad = 0.25

  return (
    <Group x={comp.x * GRID} y={comp.y * GRID} name="comp" id={comp.id} opacity={ghost ? 0.5 : 1}>
      <Group rotation={comp.rot}>
        {/* 터치 판정 영역 (보이지 않음) */}
        <Rect
          x={(box.x0 - pad) * GRID}
          y={(box.y0 - pad) * GRID}
          width={(box.x1 - box.x0 + 2 * pad) * GRID}
          height={(box.y1 - box.y0 + 2 * pad) * GRID}
          fill="rgba(0,0,0,0)"
          stroke={selected ? colors.select : undefined}
          strokeWidth={selected ? 2 : 0}
          dash={[6, 4]}
          cornerRadius={6}
        />
        {body.map((p, i) => (
          <PrimShape key={i} p={p} />
        ))}
        {moving.length > 0 && <MovingBar x={(def.bar ?? 0) * GRID} prims={moving} />}
      </Group>
      {/* 글자는 부품을 돌려도 똑바로 서 있게 따로 그린다 */}
      {texts.map((p, i) => {
        const at = rotate({ x: p.x, y: p.y }, comp.rot)
        const size = p.size * GRID
        const width = p.align === 'center' ? size * 6 : undefined
        return (
          <Text
            key={`t${i}`}
            x={at.x * GRID}
            y={at.y * GRID}
            text={p.text}
            fontSize={size}
            fontStyle={p.bold ? 'bold' : 'normal'}
            fontFamily="Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"
            fill={p.color ?? colors.symbolLabel}
            align={p.align}
            width={width}
            offsetX={width ? width / 2 : 0}
            offsetY={size * 0.5}
            listening={false}
          />
        )
      })}
    </Group>
  )
}, sameProps)

/** 실행 결과가 바뀔 때마다 visual 객체가 새로 만들어지므로 내용이 같으면 다시 그리지 않는다 */
function sameProps(a: Props, b: Props): boolean {
  if (a.comp !== b.comp || a.selected !== b.selected || a.ghost !== b.ghost) return false
  const va = a.visual ?? {}
  const vb = b.visual ?? {}
  const keys = new Set([...Object.keys(va), ...Object.keys(vb)]) as Set<keyof SymbolVisual>
  for (const k of keys) if (va[k] !== vb[k]) return false
  return true
}

/**
 * 접점 가동부: 막대 위치가 바뀌면 부드럽게 밀어 움직인다.
 * x를 React 속성으로 넘기지 않고 직접 옮겨야 Konva 트윈이 덮어써지지 않는다.
 */
function MovingBar({ x, prims }: { x: number; prims: Exclude<Prim, { t: 'text' }>[] }) {
  const ref = useRef<Konva.Group>(null)
  const first = useRef(true)
  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    if (first.current) {
      first.current = false
      g.x(x)
      return
    }
    g.to({ x, duration: BAR_MOVE_SEC })
  }, [x])
  return (
    <Group ref={ref}>
      {prims.map((p, i) => (
        <PrimShape key={i} p={p} />
      ))}
    </Group>
  )
}

function PrimShape({ p }: { p: Exclude<Prim, { t: 'text' }> }) {
  const stroke = p.color ?? colors.symbol
  const glow = p.t === 'circle' && p.glow ? { shadowColor: p.glow, shadowBlur: 18, shadowOpacity: 0.9 } : {}
  if (p.t === 'circle') {
    return (
      <Circle
        x={p.x * GRID}
        y={p.y * GRID}
        radius={p.r * GRID}
        stroke={stroke}
        strokeWidth={p.w ?? STROKE}
        fill={p.fill}
        listening={false}
        {...glow}
      />
    )
  }
  return (
    <Line
      points={p.pts.map((v) => v * GRID)}
      stroke={stroke}
      strokeWidth={p.w ?? STROKE}
      dash={p.dash ? [5, 4] : undefined}
      closed={p.closed}
      fill={p.fill}
      lineCap="round"
      lineJoin="round"
      listening={false}
    />
  )
}
