// 캔버스용 부품 기호 렌더러
import { memo } from 'react'
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

export const KonvaSymbol = memo(function KonvaSymbol({ comp, visual, selected, ghost }: Props) {
  const def = symbolOf(comp, visual)
  const { box } = def
  const body = def.prims.filter((p) => p.t !== 'text')
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
})

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
