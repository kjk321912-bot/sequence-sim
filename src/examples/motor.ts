// 전동기 예제: 주회로(3상)와 조작회로를 한 도면에
//
// 주회로: L1·L2·L3 → MCCB → MC 주접점 → THR → M
// 조작 전원: MCCB 2차측 L1·L3에서 퓨즈 F1·F2를 거쳐 위·아래 제어선으로 (MCCB를 켜야 조작 전원이 들어온다)
import { CircuitBuilder, type Circuit } from '../engine'

type Dev = Parameters<CircuitBuilder['contact']>[2]
type Part = (x: number, y: number) => string

/** 조작회로 위·아래 제어선 y */
const TOP = 0
const BOTTOM = 26
/** 퓨즈를 놓는 x (MCCB 2차측 가로선의 오른쪽 끝) */
const FUSE_X = 20

/**
 * 3상 모선, MCCB, 조작 전원(F1·F2)과 위 제어선의 THR-b·PB0(b)까지 만든다.
 * MCCB 2차측 L1은 y=8, L3은 y=10 가로선으로 오른쪽 퓨즈까지 이어지며, 그 가로선에서 MC 1차측을 따온다.
 * 돌려주는 first는 첫 회로 줄을 놓을 x (여기서부터 오른쪽으로 회로 줄을 놓는다).
 */
function motorBase(b: CircuitBuilder, controlEnd: number) {
  b.bus('R', 0, 0, 16)
  b.bus('S', 0, 1, 16)
  b.bus('T', 0, 2, 16)
  b.add({ kind: 'mccb', x: 2, y: 4, tag: 'MCCB' })
  b.wire([2, 0], [2, 4])
  b.wire([4, 1], [4, 4])
  b.wire([6, 2], [6, 4])

  // MCCB 2차측 L1 → 가로선(y=8) → F1,  L3 → 가로선(y=10) → F2
  b.wire([2, 7], [2, 11])
  b.wire([4, 7], [4, 11])
  b.wire([6, 7], [6, 11])
  b.wire([2, 8], [FUSE_X, 8])
  b.wire([6, 10], [FUSE_X, 10])
  b.add({ kind: 'fuse', x: FUSE_X, y: 8, rot: 270, tag: 'F1' })
  b.add({ kind: 'fuse', x: FUSE_X, y: 10, rot: 270, tag: 'F2' })
  const fx = FUSE_X + 3
  b.wire([fx, 8], [fx + 3, 8], [fx + 3, TOP], [fx + 5, TOP])
  b.wire([fx, 10], [fx + 2, 10], [fx + 2, BOTTOM], [controlEnd, BOTTOM])

  // 위 제어선: THR-b → PB0(b) 가로로
  const x0 = fx + 5
  b.add({ kind: 'contact', x: x0, y: TOP, rot: 270, device: 'thr', type: 'b', tag: 'THR' })
  b.add({ kind: 'contact', x: x0 + 3, y: TOP, rot: 270, device: 'pb', type: 'b', tag: 'PB0' })
  b.wire([x0 + 6, TOP], [controlEnd, TOP])

  const a = (device: Dev, tag: string): Part => (x, y) => b.contact(x, y, device, 'a', tag)
  const bc = (device: Dev, tag: string): Part => (x, y) => b.contact(x, y, device, 'b', tag)
  /** 기동 버튼 ∥ 자기유지 a접점 → [인터록] → MC 코일 */
  const startRung = (x: number, pb: string, mc: string, interlock?: string) => {
    const parts: Part[] = [a('pb', pb)]
    if (interlock) parts.push(bc('mc', interlock))
    parts.push((x, y) => b.coil(x, y, 'mc', mc))
    const [start] = b.rung(x, TOP, BOTTOM, parts)
    b.contact(x + 2, start!.top, 'mc', 'a', mc)
    b.wire([x, start!.top], [x + 2, start!.top])
    b.wire([x + 2, start!.top + 3], [x, start!.top + 3])
  }
  return { first: x0 + 8, a, bc, startRung }
}

/** MC 주접점 아래: THR 히터 → 전동기 */
function motorBottom(b: CircuitBuilder, y: number) {
  b.add({ kind: 'thrHeater', x: 2, y, tag: 'THR', tripTime: 5000 })
  b.add({ kind: 'motor', x: 2, y: y + 3, tag: 'M' })
}

/**
 * 전동기 기동·정지 회로
 *   주회로: MCCB → MC 주접점 → THR → M
 *   조작회로: THR-b → PB0(b) → PB1 ∥ MC-a → MC,   MC-a → RL(운전),   MC-b → GL(정지),   THR-a → YL(과부하)
 */
export function motorStartStopCircuit(): Circuit {
  const b = new CircuitBuilder()
  const end = 50
  const { first, a, bc, startRung } = motorBase(b, end)
  b.add({ kind: 'mcMain', x: 2, y: 11, tag: 'MC' })
  b.wire([2, 14], [2, 18])
  b.wire([4, 14], [4, 18])
  b.wire([6, 14], [6, 18])
  motorBottom(b, 18)

  // 과부하 표시: THR-b 앞(퓨즈 F1 쪽 세로선)에서 따와 THR-a → YL
  const yTap = 4
  b.wire([FUSE_X + 6, yTap], [first, yTap])
  b.rung(first, yTap, BOTTOM, [a('thr', 'THR'), (x, y) => b.lamp(x, y, 'YL')])
  startRung(first + 4, 'PB1', 'MC')
  b.rung(first + 10, TOP, BOTTOM, [a('mc', 'MC'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(first + 14, TOP, BOTTOM, [bc('mc', 'MC'), (x, y) => b.lamp(x, y, 'GL')])
  return b.build('예제: 전동기 기동·정지')
}

/**
 * 전동기 정·역 운전 회로
 *   주회로: MC1(정) 주접점은 그대로, MC2(역) 주접점은 L1·L3을 바꿔 THR에 연결
 *   조작회로: THR-b → PB0(b) → PB1 ∥ MC1-a → MC2-b → MC1,   PB2 ∥ MC2-a → MC1-b → MC2
 *            MC1-a → RL(정회전),   MC2-a → GL(역회전)
 *   MC1-b·MC2-b 인터록이 없으면 두 MC가 함께 붙어 L1–L3 단락이 난다.
 */
export function motorReversingCircuit(): Circuit {
  const b = new CircuitBuilder()
  const end = 52
  const { first, a, startRung } = motorBase(b, end)

  // MC1(정회전) 1차측: MCCB 2차측 세로선에서 바로
  b.add({ kind: 'mcMain', x: 2, y: 11, tag: 'MC1' })
  // MC2(역회전) 1차측: L1은 y=8 가로선, L2는 y=9 가로선, L3는 y=10 가로선에서 따온다
  b.add({ kind: 'mcMain', x: 10, y: 11, tag: 'MC2' })
  b.wire([10, 8], [10, 11])
  b.wire([4, 9], [12, 9], [12, 11])
  b.wire([14, 10], [14, 11])

  // MC1 2차측 → THR 그대로
  b.wire([2, 14], [2, 18])
  b.wire([4, 14], [4, 18])
  b.wire([6, 14], [6, 18])
  // MC2 2차측 → THR: L1과 L3을 바꿔 연결 (두 상을 바꾸면 회전 방향이 바뀐다)
  b.wire([10, 14], [10, 15], [6, 15])
  b.wire([12, 14], [12, 16], [4, 16])
  b.wire([14, 14], [14, 17], [2, 17])
  motorBottom(b, 18)

  startRung(first, 'PB1', 'MC1', 'MC2')
  startRung(first + 6, 'PB2', 'MC2', 'MC1')
  b.rung(first + 12, TOP, BOTTOM, [a('mc', 'MC1'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(first + 16, TOP, BOTTOM, [a('mc', 'MC2'), (x, y) => b.lamp(x, y, 'GL')])
  return b.build('예제: 전동기 정·역 운전')
}
