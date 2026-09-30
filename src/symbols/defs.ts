// 부품 기호 정의 (국내 시퀀스 교재 관례, 세로 방향)
//
// 기호는 격자 단위 좌표의 기본 도형(선·원·글자) 목록으로 기술한다.
// 같은 정의를 캔버스(KonvaSymbol)와 팔레트 아이콘(SvgSymbol)이 함께 쓴다.
// 좌표계: 첫 번째 핀이 (0,0), 아래쪽이 +y. 2단자 부품은 (0,0)~(0,3).

import type { Component, ContactComp, MotorRun } from '../engine'
import { colors } from '../ui/theme'

export type Prim =
  | { t: 'line'; pts: number[]; dash?: boolean; w?: number; closed?: boolean; color?: string; fill?: string }
  | { t: 'circle'; x: number; y: number; r: number; w?: number; color?: string; fill?: string; glow?: string }
  | { t: 'text'; x: number; y: number; text: string; size: number; align: 'left' | 'center'; color?: string; bold?: boolean }

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface SymbolDef {
  prims: Prim[]
  /** 선택 표시·터치 판정용 영역 (회전 전) */
  box: Box
}

/** 실행 모드에서 기호 모양을 바꾸는 상태 */
export interface SymbolVisual {
  /** 접점을 움직이는 장치가 동작 중 (a접점 닫힘 / b접점 열림) */
  active?: boolean
  /** 코일·부저 여자, 램프 점등 */
  energized?: boolean
  motor?: MotorRun
  /** 모터 회전 표시 각도(도) */
  motorAngle?: number
}

const rad = (d: number) => (d * Math.PI) / 180

/** 원호를 꺾은선 좌표로 (각도: 0°=오른쪽, 90°=아래) */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, steps = 12): number[] {
  const pts: number[] = []
  for (let i = 0; i <= steps; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / steps)
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  return pts
}

const LABEL = 0.5 // 이름표 글자 크기(격자 단위)
const textWidth = (s: string, size: number) =>
  [...s].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 1.0 : 0.62) * size, 0)

function label(x: number, y: number, text: string): Prim {
  return { t: 'text', x, y, text, size: LABEL, align: 'left', color: colors.symbolLabel }
}

// ─── 접점 ──────────────────────────────────────────────

/**
 * 접점 가동편 각도 (세로 위 방향 기준, +는 오른쪽으로 기울어짐)
 * a접점: 평상시 왼쪽으로 떨어져 있다가 동작하면 세로로 서서 위 단자에 닿는다.
 * b접점: 평상시 오른쪽 걸림쇠를 지나 닿아 있다가 동작하면 더 기울어 떨어진다.
 */
export function bladeAngle(type: 'a' | 'b', active: boolean): number {
  if (type === 'a') return active ? 0 : -30
  return active ? 55 : 25
}

/** 접점 한 극: 위·아래 단자선 + 가동편. 가동편 중간점을 돌려준다 (조작부 연결용) */
function contactPole(prims: Prim[], ox: number, type: 'a' | 'b', angle: number, color?: string) {
  const L = type === 'a' ? 0.85 : 1.0
  const px = ox
  const py = 1.9
  const ex = px + Math.sin(rad(angle)) * L
  const ey = py - Math.cos(rad(angle)) * L
  prims.push({ t: 'line', pts: [ox, 0, ox, 1.1], color })
  prims.push({ t: 'line', pts: [ox, 1.9, ox, 3], color })
  if (type === 'b') prims.push({ t: 'line', pts: [ox, 1.1, ox + 0.5, 1.1], color })
  prims.push({ t: 'line', pts: [px, py, ex, ey], w: 2.5, color })
  return { mx: px + (ex - px) * 0.55, my: py + (ey - py) * 0.55 }
}

function contact(c: ContactComp, v: SymbolVisual): SymbolDef {
  const prims: Prim[] = []
  const { mx, my } = contactPole(prims, 0, c.type, bladeAngle(c.type, !!v.active))
  const dashTo = (x: number) => prims.push({ t: 'line', pts: [mx, my, x, my], dash: true, w: 1.5 })

  switch (c.device) {
    case 'pb': // 누름버튼: 점선 + ㄷ자 버튼 머리
      dashTo(-1.0)
      prims.push({ t: 'line', pts: [-1.2, my - 0.3, -1.0, my - 0.3, -1.0, my + 0.3, -1.2, my + 0.3] })
      break
    case 'selector': // 셀렉터: 점선 + ㄱ자 손잡이
      dashTo(-0.9)
      prims.push({ t: 'line', pts: [-0.9, my, -1.25, my, -1.25, my - 0.4] })
      break
    case 'limit': // 리밋 스위치: 가동편에 붙은 삼각형
      prims.push({ t: 'line', pts: [mx, my, mx - 0.45, my - 0.25, mx - 0.45, my + 0.25], closed: true })
      break
    case 'timer': // 한시동작 접점: 두 줄 + 원호(낙하산 모양)
      prims.push({ t: 'line', pts: [mx, my - 0.09, -0.6, my - 0.09] })
      prims.push({ t: 'line', pts: [mx, my + 0.09, -0.6, my + 0.09] })
      prims.push({ t: 'line', pts: arcPts(-0.85, my, 0.28, 90, 270) })
      break
    case 'thr': // 열동계전기 접점: 점선 + 열동 소자 표시
      dashTo(-0.6)
      prims.push({ t: 'line', pts: [-0.6, my, -0.6, my - 0.25, -0.9, my - 0.25, -0.9, my + 0.25, -1.2, my + 0.25] })
      break
    case 'relay':
    case 'mc':
    case 'counter':
      break
  }
  const lx = c.type === 'b' ? 1.0 : 0.6
  prims.push(label(lx, 1.5, c.tag))
  return { prims, box: { x0: -1.4, y0: 0, x1: lx + textWidth(c.tag, LABEL) + 0.1, y1: 3 } }
}

// ─── 코일·부하 ──────────────────────────────────────────

function innerTextSize(s: string) {
  return s.length <= 2 ? 0.52 : s.length === 3 ? 0.44 : 0.36
}

function coilLike(tag: string, side: string | null, on: boolean): SymbolDef {
  const color = on ? colors.wireFlow : undefined
  const prims: Prim[] = [
    { t: 'line', pts: [0, 0, 0, 0.75] },
    { t: 'line', pts: [0, 2.25, 0, 3] },
    { t: 'circle', x: 0, y: 1.5, r: 0.75, color, ...(on ? { glow: colors.wireFlow } : {}) },
    { t: 'text', x: 0, y: 1.5, text: tag, size: innerTextSize(tag), align: 'center', color: on ? colors.wireFlow : colors.symbol, bold: true },
  ]
  let x1 = 0.9
  if (side) {
    prims.push(label(1.0, 1.5, side))
    x1 = 1.1 + textWidth(side, LABEL)
  }
  return { prims, box: { x0: -0.9, y0: 0, x1, y1: 3 } }
}

const LAMP_COLOR = { RL: colors.lampRL, GL: colors.lampGL, YL: colors.lampYL, WL: colors.lampWL } as const

function lamp(color: keyof typeof LAMP_COLOR, tag: string, on: boolean): SymbolDef {
  const lit = LAMP_COLOR[color]
  const d = 0.7 * Math.SQRT1_2
  const cross = on ? colors.bg : undefined
  return {
    prims: [
      { t: 'line', pts: [0, 0, 0, 0.8] },
      { t: 'line', pts: [0, 2.2, 0, 3] },
      { t: 'circle', x: 0, y: 1.5, r: 0.7, color: on ? lit : undefined, ...(on ? { fill: lit, glow: lit } : {}) },
      { t: 'line', pts: [-d, 1.5 - d, d, 1.5 + d], color: cross },
      { t: 'line', pts: [-d, 1.5 + d, d, 1.5 - d], color: cross },
      // 소등 상태에서도 색을 알 수 있게 이름표를 램프 색으로
      { t: 'text', x: 1.0, y: 1.5, text: tag, size: LABEL, align: 'left', color: lit, bold: true },
    ],
    box: { x0: -0.9, y0: 0, x1: 1.1 + textWidth(tag, LABEL), y1: 3 },
  }
}

function buzzer(tag: string, on: boolean): SymbolDef {
  const color = on ? colors.warn : undefined
  return {
    prims: [
      { t: 'line', pts: [0, 0, 0, 1.2] },
      { t: 'line', pts: [0, 1.85, 0, 3] },
      { t: 'line', pts: [-0.65, 1.85, ...arcPts(0, 1.85, 0.65, 180, 360), -0.65, 1.85], closed: true, color, ...(on ? { fill: colors.warn } : {}) },
      label(1.0, 1.5, tag),
    ],
    box: { x0: -0.9, y0: 0, x1: 1.1 + textWidth(tag, LABEL), y1: 3 },
  }
}

// ─── 주회로 3극 부품 ───────────────────────────────────

function threePole(kind: 'mccb' | 'mcMain' | 'thrHeater', tag: string, active: boolean): SymbolDef {
  const prims: Prim[] = []
  let my = 1.5
  let lastMx = 4
  for (let i = 0; i < 3; i++) {
    const ox = i * 2
    if (kind === 'thrHeater') {
      // 히터: 선로 중간의 ⊐자 소자
      prims.push({ t: 'line', pts: [ox, 0, ox, 0.9, ox + 0.4, 0.9, ox + 0.4, 2.1, ox, 2.1, ox, 3] })
    } else {
      const m = contactPole(prims, ox, 'a', bladeAngle('a', active))
      my = m.my
      if (i === 2) lastMx = m.mx
      if (kind === 'mcMain') prims.push({ t: 'line', pts: arcPts(ox, 1.1, 0.18, 0, 180, 8) })
    }
  }
  if (kind === 'thrHeater') {
    prims.push({ t: 'line', pts: [-0.45, 0.6, 4.85, 0.6, 4.85, 2.4, -0.45, 2.4], closed: true, dash: true, w: 1.5 })
  } else {
    // 3극 연동 점선
    prims.push({ t: 'line', pts: [-0.7, my, lastMx, my], dash: true, w: 1.5 })
    if (kind === 'mccb') {
      prims.push({ t: 'line', pts: [-0.7, my - 0.25, -1.1, my - 0.25, -1.1, my + 0.25, -0.7, my + 0.25], closed: true })
    }
  }
  const lx = 5.1
  prims.push(label(lx, 1.5, tag))
  return { prims, box: { x0: -1.3, y0: 0, x1: lx + textWidth(tag, LABEL) + 0.1, y1: 3 } }
}

function motor(tag: string, v: SymbolVisual): SymbolDef {
  const run = v.motor ?? 'stop'
  const spinning = run === 'fwd' || run === 'rev'
  const color = spinning ? colors.wireFlow : run === 'singlePhase' ? colors.warn : undefined
  const cx = 2
  const cy = 2.8
  const r = 1.5
  const prims: Prim[] = [
    { t: 'line', pts: [0, 0, 0, 1.9, 0.8, 1.9] },
    { t: 'line', pts: [2, 0, 2, 1.3] },
    { t: 'line', pts: [4, 0, 4, 1.9, 3.2, 1.9] },
    { t: 'circle', x: cx, y: cy, r, w: 2.5, color, ...(spinning ? { glow: colors.wireFlow } : {}) },
    { t: 'text', x: cx, y: cy - 0.15, text: 'M', size: 1.0, align: 'center', color: color ?? colors.symbol, bold: true },
    { t: 'text', x: cx, y: cy + 0.75, text: '3~', size: 0.45, align: 'center', color: colors.symbolLabel },
  ]
  if (spinning || v.motorAngle !== undefined) {
    // 회전 표시: 원 둘레의 날개 3개
    const base = v.motorAngle ?? 0
    for (let k = 0; k < 3; k++) {
      const a = base + k * 120
      prims.push({ t: 'line', pts: arcPts(cx, cy, r + 0.3, a, a + 45, 6), w: 3, color: color ?? colors.symbol })
    }
  }
  prims.push(label(4.6, 1.2, tag))
  return { prims, box: { x0: -0.3, y0: 0, x1: 4.7 + textWidth(tag, LABEL), y1: cy + r + 0.4 } }
}

const BUS_COLOR = { P: colors.busP, N: colors.busN, R: colors.busR, S: colors.busS, T: colors.busT } as const

// ─── 진입점 ────────────────────────────────────────────

export function symbolOf(c: Component, v: SymbolVisual = {}): SymbolDef {
  switch (c.kind) {
    case 'bus': {
      const color = BUS_COLOR[c.phase]
      return {
        prims: [
          { t: 'line', pts: [0, 0, c.length, 0], w: 5, color },
          { t: 'text', x: -0.6, y: 0, text: c.phase, size: 0.7, align: 'center', color, bold: true },
        ],
        box: { x0: -1.1, y0: -0.5, x1: c.length, y1: 0.5 },
      }
    }
    case 'contact':
      return contact(c, v)
    case 'coil': {
      const side =
        c.device === 'timer'
          ? `${(c.preset ?? 0) / 1000}초`
          : c.device === 'counter'
            ? `${c.preset ?? 1}회`
            : c.device === 'counterReset'
              ? '리셋'
              : null
      return coilLike(c.tag, side, !!v.energized)
    }
    case 'lamp':
      return lamp(c.color, c.tag, !!v.energized)
    case 'buzzer':
      return buzzer(c.tag, !!v.energized)
    case 'mccb':
    case 'mcMain':
    case 'thrHeater':
      return threePole(c.kind, c.tag, !!v.active)
    case 'motor':
      return motor(c.tag, v)
  }
}
