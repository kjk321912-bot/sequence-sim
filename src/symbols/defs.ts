// 부품 기호 정의 — 전기기능사 실기 공개도면(KS 세로 표기) 방식
//
// 기호는 격자 단위 좌표의 기본 도형(선·원·글자) 목록으로 기술한다.
// 같은 정의를 캔버스(KonvaSymbol)와 팔레트 아이콘(SvgSymbol)이 함께 쓴다.
// 좌표계: 첫 번째 핀이 (0,0), 아래쪽이 +y. 2단자 부품은 (0,0)~(0,3).
//
// 공개도면 표기 요약
// - 접점: 두 단자를 작은 원(○)으로 그리고 옆에 세로 막대(가동 접점)를 긋는다.
//     a접점 = 오른쪽에 떨어진 막대, b접점 = 왼쪽에 원에 붙은 막대
// - 조작부 표시: 누름버튼 ├, 셀렉터 ├↗, 리밋 스위치 가는 직사각형, 한시접점 ＞, 열동계전기 ×
// - 코일·램프: 원 안에 이름(X1, MC1, RL …), 부저: 사각형 + 사선
// - 주회로: MCCB는 원호 ")", MC 주접점은 사선 + 고리, THR 히터는 3선을 가로지르는 사각형

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

const LABEL = 0.55 // 이름표 글자 크기(격자 단위)
const textWidth = (s: string, size: number) =>
  [...s].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 1.0 : 0.66) * size, 0)

function label(x: number, y: number, text: string, color: string = colors.symbolLabel): Prim {
  return { t: 'text', x, y, text, size: LABEL, align: 'left', color, bold: true }
}

// ─── 접점 ──────────────────────────────────────────────

/** 단자 원 위치 (2단자 부품) */
const T1 = 1.0
const T2 = 2.0
const TERM_R = 0.13

/**
 * 가동 접점 막대의 가로 위치.
 * a접점: 평상시 오른쪽에 떨어져 있다가(열림) 동작하면 단자 원에 붙는다(닫힘).
 * b접점: 평상시 왼쪽에서 단자 원에 붙어 있다가(닫힘) 동작하면 떨어진다(열림).
 */
export function barOffset(type: 'a' | 'b', active: boolean): number {
  const touch = TERM_R + 0.03
  if (type === 'a') return active ? touch : 0.4
  return active ? -0.4 : -touch
}

/** 단자 원 두 개와 위·아래 리드선 (x = ox 열) */
function terminals(prims: Prim[], ox: number, color?: string) {
  prims.push({ t: 'line', pts: [ox, 0, ox, T1 - TERM_R], color })
  prims.push({ t: 'line', pts: [ox, T2 + TERM_R, ox, 3], color })
  prims.push({ t: 'circle', x: ox, y: T1, r: TERM_R, w: 1.6, color })
  prims.push({ t: 'circle', x: ox, y: T2, r: TERM_R, w: 1.6, color })
}

function contact(c: ContactComp, v: SymbolVisual): SymbolDef {
  const prims: Prim[] = []
  terminals(prims, 0)
  const bx = barOffset(c.type, !!v.active)
  const top = T1 - 0.15
  const bot = T2 + 0.15
  const mid = (T1 + T2) / 2
  /** 막대 오른쪽으로 가장 멀리 뻗은 곳 (이름표 위치 계산용) */
  let reach = bx

  if (c.device === 'limit') {
    // 리밋 스위치: 가는 직사각형 막대
    prims.push({ t: 'line', pts: [bx - 0.06, top, bx + 0.06, top, bx + 0.06, bot, bx - 0.06, bot], closed: true, w: 1.6 })
    reach = bx + 0.06
  } else {
    prims.push({ t: 'line', pts: [bx, top, bx, bot], w: 2.2 })
  }

  switch (c.device) {
    case 'pb': // 누름버튼: 막대에서 오른쪽으로 뻗은 가지 ├
      prims.push({ t: 'line', pts: [bx, mid, bx + 0.3, mid] })
      reach = bx + 0.3
      break
    case 'selector': // 셀렉터: 가지 끝이 위로 꺾임
      prims.push({ t: 'line', pts: [bx, mid, bx + 0.28, mid, bx + 0.18, mid - 0.12] })
      reach = bx + 0.28
      break
    case 'timer': // 한시접점: 막대 오른쪽의 ＞
      prims.push({ t: 'line', pts: [bx + 0.03, mid - 0.14, bx + 0.22, mid, bx + 0.03, mid + 0.14] })
      reach = bx + 0.22
      break
    case 'thr': // 열동계전기 접점: 막대 위의 ×
      prims.push({ t: 'line', pts: [bx - 0.1, mid - 0.1, bx + 0.1, mid + 0.1] })
      prims.push({ t: 'line', pts: [bx - 0.1, mid + 0.1, bx + 0.1, mid - 0.1] })
      reach = bx + 0.1
      break
    case 'limit':
    case 'relay':
    case 'mc':
    case 'counter':
      break
  }
  // 이름표는 a접점 기준 위치에 고정 (동작해도 글자가 흔들리지 않게)
  const lx = Math.max(reach, c.type === 'a' ? barOffset('a', false) : 0.15) + 0.22
  prims.push(label(lx, mid, c.tag))
  return { prims, box: { x0: -0.6, y0: 0, x1: lx + textWidth(c.tag, LABEL) + 0.1, y1: 3 } }
}

// ─── 코일·부하 ──────────────────────────────────────────

const COIL_R = 0.62

function innerTextSize(s: string) {
  return s.length <= 2 ? 0.55 : s.length === 3 ? 0.44 : 0.34
}

/** 원 안에 이름을 쓴 기호 (코일·램프 공통) */
function circleSymbol(
  text: string,
  opts: { stroke?: string; fill?: string; glow?: string; textColor?: string; side?: string | null; sideColor?: string },
): SymbolDef {
  const prims: Prim[] = [
    { t: 'line', pts: [0, 0, 0, 1.5 - COIL_R] },
    { t: 'line', pts: [0, 1.5 + COIL_R, 0, 3] },
    { t: 'circle', x: 0, y: 1.5, r: COIL_R, w: 2, color: opts.stroke, fill: opts.fill ?? colors.bg, ...(opts.glow ? { glow: opts.glow } : {}) },
    { t: 'text', x: 0, y: 1.5, text, size: innerTextSize(text), align: 'center', color: opts.textColor ?? colors.symbol, bold: true },
  ]
  let x1 = COIL_R + 0.15
  if (opts.side) {
    prims.push(label(COIL_R + 0.2, 1.5, opts.side, opts.sideColor))
    x1 = COIL_R + 0.3 + textWidth(opts.side, LABEL)
  }
  return { prims, box: { x0: -COIL_R - 0.15, y0: 0, x1, y1: 3 } }
}

const LAMP_COLOR = { RL: colors.lampRL, GL: colors.lampGL, YL: colors.lampYL, WL: colors.lampWL } as const

function lamp(color: keyof typeof LAMP_COLOR, tag: string, on: boolean): SymbolDef {
  const lit = LAMP_COLOR[color]
  // 소등 상태에서도 무슨 색 램프인지 알 수 있게 테두리를 램프 색으로
  return on
    ? circleSymbol(tag, { stroke: lit, fill: lit, glow: lit, textColor: colors.bg })
    : circleSymbol(tag, { stroke: lit, textColor: lit })
}

function buzzer(tag: string, on: boolean): SymbolDef {
  const color = on ? colors.warn : undefined
  const w = 0.62
  const h = 0.5
  return {
    prims: [
      { t: 'line', pts: [0, 0, 0, 1.5 - h] },
      { t: 'line', pts: [0, 1.5 + h, 0, 3] },
      { t: 'line', pts: [-w, 1.5 - h, w, 1.5 - h, w, 1.5 + h, -w, 1.5 + h], closed: true, w: 2, color, fill: on ? colors.warn : colors.bg },
      // 소리 표시 사선
      { t: 'line', pts: [w + 0.12, 1.5 - h, w + 0.28, 1.5 + h + 0.05], color },
      { t: 'text', x: 0, y: 1.5, text: tag, size: innerTextSize(tag), align: 'center', color: on ? colors.bg : colors.symbol, bold: true },
    ],
    box: { x0: -w - 0.15, y0: 0, x1: w + 0.4, y1: 3 },
  }
}

// ─── 주회로 3극 부품 ───────────────────────────────────

function threePole(kind: 'mccb' | 'mcMain' | 'thrHeater', tag: string, active: boolean): SymbolDef {
  const prims: Prim[] = []
  const mid = (T1 + T2) / 2

  if (kind === 'thrHeater') {
    // 3선을 가로지르는 사각형 (공개도면의 EOCR 표기와 같은 방식)
    for (let i = 0; i < 3; i++) {
      const ox = i * 2
      prims.push({ t: 'line', pts: [ox, 0, ox, 1.1] })
      prims.push({ t: 'line', pts: [ox, 1.9, ox, 3] })
    }
    prims.push({ t: 'line', pts: [-0.6, 1.1, 4.6, 1.1, 4.6, 1.9, -0.6, 1.9], closed: true, w: 2, fill: colors.bg })
    prims.push({ t: 'text', x: 2, y: 1.5, text: tag, size: 0.55, align: 'center', color: colors.symbol, bold: true })
    return { prims, box: { x0: -0.8, y0: 0, x1: 4.8, y1: 3 } }
  }

  const linkY = mid
  for (let i = 0; i < 3; i++) {
    const ox = i * 2
    terminals(prims, ox)
    if (kind === 'mccb') {
      // 배선용 차단기: 두 단자를 잇는 원호 ")". 투입(ON)하면 원호가 단자 쪽으로 붙는다
      const bulge = active ? 0.16 : 0.34
      const r = ((T2 - T1) / 2) ** 2 / (2 * bulge) + bulge / 2
      const cx = ox + bulge - r
      const half = (Math.asin((T2 - T1) / 2 / r) * 180) / Math.PI
      prims.push({ t: 'line', pts: arcPts(cx, mid, r, -half, half, 14), w: 2 })
      if (i === 2) prims.push({ t: 'line', pts: [bulge, mid, ox + bulge, mid], dash: true, w: 1.4 })
    } else {
      // 전자접촉기 주접점: 아래 단자에서 오른쪽 위로 뻗은 사선 + 위 단자 옆의 고리
      const tipX = active ? ox + 0.16 : ox + 0.45
      prims.push({ t: 'line', pts: [ox, T2 - TERM_R, tipX, T1 - 0.05], w: 2.2 })
      prims.push({ t: 'line', pts: arcPts(ox + 0.28, T1 - 0.12, 0.1, 180, 450, 8), w: 1.4 })
      if (i === 2) {
        // 3극 연동 점선: 각 사선의 중간 높이를 가로지른다
        const off = (tipX - ox) * 0.45
        prims.push({ t: 'line', pts: [off, linkY, 4 + off, linkY], dash: true, w: 1.4 })
      }
    }
  }
  const lx = -0.5
  // 이름표는 왼쪽 (공개도면처럼 "MCCB", "MC1"을 앞에)
  const w = textWidth(tag, LABEL)
  prims.push({ t: 'text', x: lx - w, y: linkY, text: tag, size: LABEL, align: 'left', color: colors.symbolLabel, bold: true })
  return { prims, box: { x0: lx - w - 0.1, y0: 0, x1: 4.7, y1: 3 } }
}

function motor(tag: string, v: SymbolVisual): SymbolDef {
  const run = v.motor ?? 'stop'
  const spinning = run === 'fwd' || run === 'rev'
  const color = spinning ? colors.wireFlow : run === 'singlePhase' ? colors.warn : undefined
  const cx = 2
  const cy = 2.9
  const r = 1.2
  const d = r * Math.SQRT1_2
  const prims: Prim[] = [
    // U·V·W 선이 전동기 원으로 모여 들어간다
    { t: 'line', pts: [0, 0, 0, 1.3, cx - d, cy - d] },
    { t: 'line', pts: [2, 0, 2, cy - r] },
    { t: 'line', pts: [4, 0, 4, 1.3, cx + d, cy - d] },
    { t: 'circle', x: cx, y: cy, r, w: 2.5, color, fill: colors.bg, ...(spinning ? { glow: colors.wireFlow } : {}) },
    { t: 'text', x: cx, y: cy, text: tag, size: tag.length <= 2 ? 0.8 : 0.6, align: 'center', color: color ?? colors.symbol, bold: true },
  ]
  if (spinning || v.motorAngle !== undefined) {
    // 회전 표시: 원 둘레의 날개 3개
    const base = v.motorAngle ?? 0
    for (let k = 0; k < 3; k++) {
      const a = base + k * 120
      prims.push({ t: 'line', pts: arcPts(cx, cy, r + 0.3, a, a + 45, 6), w: 3, color: color ?? colors.symbol })
    }
  }
  return { prims, box: { x0: -0.3, y0: 0, x1: 4.3, y1: cy + r + 0.5 } }
}

const BUS_COLOR = { P: colors.busP, N: colors.busN, R: colors.busR, S: colors.busS, T: colors.busT } as const
/** 주회로 상 이름은 공개도면 표기(L1·L2·L3)를 따른다 */
export const PHASE_LABEL = { P: 'P', N: 'N', R: 'L1', S: 'L2', T: 'L3' } as const

// ─── 진입점 ────────────────────────────────────────────

export function symbolOf(c: Component, v: SymbolVisual = {}): SymbolDef {
  switch (c.kind) {
    case 'bus': {
      const color = BUS_COLOR[c.phase]
      const text = PHASE_LABEL[c.phase]
      const w = textWidth(text, 0.6)
      return {
        prims: [
          { t: 'line', pts: [0, 0, c.length, 0], w: 3.5, color },
          { t: 'text', x: -0.3 - w, y: 0, text, size: 0.6, align: 'left', color, bold: true },
        ],
        box: { x0: -0.5 - w, y0: -0.5, x1: c.length, y1: 0.5 },
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
      const on = !!v.energized
      return circleSymbol(c.tag, {
        ...(on ? { stroke: colors.wireFlow, glow: colors.wireFlow, textColor: colors.wireFlow } : {}),
        side,
      })
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
