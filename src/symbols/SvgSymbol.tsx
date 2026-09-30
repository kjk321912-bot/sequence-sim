// 팔레트 아이콘용 부품 기호 렌더러 (캔버스와 같은 기호 정의 사용)
import type { Component } from '../engine'
import { colors } from '../ui/theme'
import { placedPrims, symbolOf } from './defs'

const U = 20 // 격자 1칸 = 20 SVG 단위

export function SvgSymbol({ comp, size = 48 }: { comp: Component; size?: number }) {
  const def = symbolOf(comp)
  const { box } = def
  const prims = placedPrims(def)
  const pad = 0.3
  const x = (box.x0 - pad) * U
  const y = (box.y0 - pad) * U
  const w = (box.x1 - box.x0 + 2 * pad) * U
  const h = (box.y1 - box.y0 + 2 * pad) * U
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width={size} height={size} aria-hidden>
      {prims.map((p, i) => {
        if (p.t === 'circle') {
          return (
            <circle key={i} cx={p.x * U} cy={p.y * U} r={p.r * U} stroke={p.color ?? colors.symbol} strokeWidth={(p.w ?? 2) * 1.2} fill={p.fill ?? 'none'} />
          )
        }
        if (p.t === 'line') {
          const pts = []
          for (let k = 0; k < p.pts.length; k += 2) pts.push(`${p.pts[k]! * U},${p.pts[k + 1]! * U}`)
          const Tag = p.closed ? 'polygon' : 'polyline'
          return (
            <Tag
              key={i}
              points={pts.join(' ')}
              stroke={p.color ?? colors.symbol}
              strokeWidth={(p.w ?? 2) * 1.2}
              strokeDasharray={p.dash ? '5 4' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={p.fill ?? 'none'}
            />
          )
        }
        return (
          <text
            key={i}
            x={p.x * U}
            y={p.y * U}
            fontSize={p.size * U}
            fontWeight={p.bold ? 700 : 400}
            fill={p.color ?? colors.symbolLabel}
            textAnchor={p.align === 'center' ? 'middle' : 'start'}
            dominantBaseline="central"
          >
            {p.text}
          </text>
        )
      })}
    </svg>
  )
}
