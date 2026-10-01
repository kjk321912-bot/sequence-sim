// 전기기능사 공개문제 도면을 옮기는 도구
//
// 공개문제 도면은 모두 같은 틀이다.
//   주회로: L1·L2·L3 → MCCB → EOCR → MC1 → M1,  MC2 → M2  (MCCB 2차측 L1·L3에서 퓨즈 F1·F2로 조작 전원)
//   조작회로: 위 제어선 ─ EOCR-b ─ (PB0-b) ─ 세로 회로 줄들 ─ 아래 제어선,  맨 왼쪽 줄은 EOCR 전원
// 조작회로는 도면처럼 "세로 줄(열)"과 "가로 접속선(층)"으로 적는다.
//   열 i의 x = X0 + 4i,  부품 칸 r의 위 단자 y = ROW[r],  접속선 층 j의 y = JOIN[j]
//   부하(코일·램프)는 모두 같은 높이(COIL)에 놓고 아래 제어선(BOT)에 잇는다 (도면과 같은 모양).
import { CircuitBuilder, TWO_TERMINAL_SPAN, type Circuit } from '../../engine'

export const TOP = 0
export const BOT = 33
/** 부품 칸 r0~r4의 위 단자 y */
export const ROW = [2, 7, 12, 17, 22] as const
/** 칸 r 바로 아래 접속선 층 j0~j4의 y */
export const JOIN = [6, 11, 16, 21, 26] as const
const COIL = 27
/** 조작회로 첫 열(EOCR 전원)의 x */
const X0 = 24
const PITCH = 4

type Dev = Parameters<CircuitBuilder['contact']>[2]
/** 격자 위치를 받아 부품을 놓는 함수 */
export type Part = (x: number, y: number) => string

export interface Sheet {
  b: CircuitBuilder
  /** a접점 / b접점 */
  a: (device: Dev, tag: string) => Part
  bc: (device: Dev, tag: string) => Part
  relay: (tag: string) => Part
  mc: (tag: string) => Part
  timer: (tag: string, ms?: number) => Part
  flicker: (tag: string, ms?: number) => Part
  lamp: (color: 'RL' | 'GL' | 'YL' | 'WL') => Part
  buzzer: Part
  /** 플로트레스 스위치 본체(전원) */
  fls: Part
  /**
   * 열 i에 세로 줄을 긋는다: from(y)에서 시작해 [칸, 부품]을 위에서부터 놓고,
   * to가 부품이면 COIL 높이에 부하로 놓아 아래 제어선까지, 숫자면 그 y에서 끝낸다.
   */
  col: (i: number, from: number, parts: [number, Part][], to: Part | number) => void
  /** 층 y에서 열들을 가로로 잇는다 (열마다 꺾인 점을 두어 접속점이 생기게) */
  h: (y: number, cols: number[]) => void
  /** 접점 a → 부하 (가장 흔한 표시등 줄) */
  simple: (i: number, contact: Part, load: Part) => void
  build: (name: string) => Circuit
}

const colX = (i: number) => X0 + PITCH * i

/**
 * 공개문제 틀: 주회로 + 조작 전원 + EOCR 전원 열(0번 열)까지 그린다.
 * pb0OnTop이면 PB0(b)를 위 제어선에 EOCR-b와 나란히 둔다 (10~18번 유형).
 */
export function examSheet(opts: { pb0OnTop: boolean; eocrTrip?: number }): Sheet {
  const b = new CircuitBuilder()
  const S = TWO_TERMINAL_SPAN

  // ── 주회로
  b.bus('R', 0, 0, 8)
  b.bus('S', 0, 1, 8)
  b.bus('T', 0, 2, 8)
  b.add({ kind: 'mccb', x: 2, y: 4, tag: 'MCCB' })
  b.wire([2, 0], [2, 4])
  b.wire([4, 1], [4, 4])
  b.wire([6, 2], [6, 4])
  b.wire([2, 7], [2, 12])
  b.wire([4, 7], [4, 12])
  b.wire([6, 7], [6, 12])
  b.add({ kind: 'thrHeater', relay: 'eocr', x: 2, y: 12, tag: 'EOCR', tripTime: opts.eocrTrip ?? 5000 })
  // EOCR 2차측 → MC1 (바로 아래), MC2 (오른쪽으로 갈라져)
  b.wire([2, 15], [2, 19])
  b.wire([4, 15], [4, 19])
  b.wire([6, 15], [6, 19])
  b.wire([2, 16], [10, 16], [10, 19])
  b.wire([4, 17], [12, 17], [12, 19])
  b.wire([6, 18], [14, 18], [14, 19])
  b.add({ kind: 'mcMain', x: 2, y: 19, tag: 'MC1' })
  b.add({ kind: 'mcMain', x: 10, y: 19, tag: 'MC2' })
  b.add({ kind: 'motor', x: 2, y: 19 + S, tag: 'M1' })
  b.add({ kind: 'motor', x: 10, y: 19 + S, tag: 'M2' })

  // ── 조작 전원: MCCB 2차측 L1 → F1 → 위 제어선,  L3 → F2 → 아래 제어선
  const FX = 16
  b.wire([2, 8], [FX, 8])
  b.wire([6, 10], [FX, 10])
  b.add({ kind: 'fuse', x: FX, y: 8, rot: 270, tag: 'F1' })
  b.add({ kind: 'fuse', x: FX, y: 10, rot: 270, tag: 'F2' })
  // 위 제어선: 0번 열(EOCR 전원) 뒤에 EOCR-b, (PB0-b)
  b.wire([FX + 3, 8], [FX + 6, 8], [FX + 6, TOP], [X0, TOP], [X0 + 1, TOP])
  b.add({ kind: 'contact', x: X0 + 1, y: TOP, rot: 270, device: 'eocr', type: 'b', tag: 'EOCR' })
  let lineStart = X0 + 1 + S
  if (opts.pb0OnTop) {
    b.add({ kind: 'contact', x: lineStart, y: TOP, rot: 270, device: 'pb', type: 'b', tag: 'PB0' })
    lineStart += S
  }
  /** 위 제어선에서 시작하는 열 (위 제어선은 마지막 열까지만 긋는다) */
  const topCols = new Set<number>()

  // 아래 제어선: 부하 열마다 꺾인 점
  const loadCols = new Set<number>([0])

  const sheet: Sheet = {
    b,
    a: (device, tag) => (x, y) => b.contact(x, y, device, 'a', tag),
    bc: (device, tag) => (x, y) => b.contact(x, y, device, 'b', tag),
    relay: (tag) => (x, y) => b.coil(x, y, 'relay', tag),
    mc: (tag) => (x, y) => b.coil(x, y, 'mc', tag),
    timer: (tag, ms = 3000) => (x, y) => b.coil(x, y, 'timer', tag, ms),
    flicker: (tag, ms = 2000) => (x, y) => b.coil(x, y, 'flicker', tag, ms),
    lamp: (color) => (x, y) => b.lamp(x, y, color),
    buzzer: (x, y) => b.add({ kind: 'buzzer', x, y, tag: 'BZ' }),
    fls: (x, y) => b.add({ kind: 'fls', x, y, tag: 'FLS' }),

    col: (i, from, parts, to) => {
      const x = colX(i)
      if (from === TOP && i > 0) topCols.add(i)
      let y = from
      for (const [row, make] of parts) {
        const top = ROW[row]!
        if (top > y) b.wire([x, y], [x, top])
        make(x, top)
        y = top + S
      }
      if (typeof to === 'number') {
        if (to > y) b.wire([x, y], [x, to])
        return
      }
      if (COIL > y) b.wire([x, y], [x, COIL])
      to(x, COIL)
      loadCols.add(i)
    },

    h: (y, cols) => {
      b.wire(...cols.map((i): [number, number] => [colX(i), y]))
    },

    simple: (i, contact, load) => sheet.col(i, TOP, [[0, contact]], load),

    build: (name) => {
      // EOCR 전원 (0번 열): 위 제어선 → EOCR 전원 → 아래 제어선
      sheet.col(0, TOP, [], (x, y) => b.coil(x, y, 'eocr', 'EOCR'))
      const topXs = [...topCols].sort((p, q) => p - q).map(colX).filter((x) => x > lineStart)
      b.wire([lineStart, TOP], ...topXs.map((x): [number, number] => [x, TOP]))
      for (const i of loadCols) b.wire([colX(i), COIL + S], [colX(i), BOT])
      const xs = [...loadCols].sort((p, q) => p - q).map(colX)
      b.wire([FX + 3, 10], [FX + 5, 10], [FX + 5, BOT], ...xs.map((x): [number, number] => [x, BOT]))
      return b.build(name)
    },
  }
  return sheet
}
