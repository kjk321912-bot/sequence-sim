// 기초 예제: 조작회로만 있는 회로 (P모선 위, N모선 아래)
//
// 교재 순서대로 자기유지 → 인터록 → 타이머 → 카운터.
import { CircuitBuilder, type Circuit } from '../engine'

const TOP = 0
const BOTTOM = 18

type Dev = Parameters<CircuitBuilder['contact']>[2]
type Part = (x: number, y: number) => string

function board(width: number) {
  const b = new CircuitBuilder()
  b.bus('P', 0, TOP, width)
  b.bus('N', 0, BOTTOM, width)
  const a = (device: Dev, tag: string): Part => (x, y) => b.contact(x, y, device, 'a', tag)
  const bc = (device: Dev, tag: string): Part => (x, y) => b.contact(x, y, device, 'b', tag)
  /** 접점 하나를 x줄의 y 위치 접점과 병렬로 (오른쪽 2칸) */
  const parallel = (x: number, y: number, device: Dev, tag: string) => {
    b.contact(x + 2, y, device, 'a', tag)
    b.wire([x, y], [x + 2, y])
    b.wire([x + 2, y + 3], [x, y + 3])
  }
  return { b, a, bc, parallel }
}

/**
 * 자기유지 회로
 *   PB0(b) → PB1(a) ∥ X-a → X,   X-a → RL(운전),   X-b → GL(정지)
 */
export function selfHoldCircuit(): Circuit {
  const { b, a, bc, parallel } = board(20)
  const [, start] = b.rung(2, TOP, BOTTOM, [bc('pb', 'PB0'), a('pb', 'PB1'), (x, y) => b.coil(x, y, 'relay', 'X')])
  parallel(2, start!.top, 'relay', 'X')
  b.rung(10, TOP, BOTTOM, [a('relay', 'X'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(14, TOP, BOTTOM, [bc('relay', 'X'), (x, y) => b.lamp(x, y, 'GL')])
  return b.build('예제: 자기유지 회로')
}

/**
 * 인터록 회로 (선입력 우선)
 *   PB0(b)는 P모선 쪽에 가로로 두어 두 줄을 함께 정지시킨다.
 *   PB1 ∥ X1-a → X2-b → X1,   PB2 ∥ X2-a → X1-b → X2,   X1-a → RL,   X2-a → GL
 */
export function interlockCircuit(): Circuit {
  const b = new CircuitBuilder()
  const width = 30
  b.bus('P', 0, TOP, 2)
  b.bus('N', 0, BOTTOM, width)
  // 정지 버튼 PB0: P모선 → PB0(가로) → 위 제어선
  b.wire([2, TOP], [4, TOP])
  b.add({ kind: 'contact', x: 4, y: TOP, rot: 270, device: 'pb', type: 'b', tag: 'PB0' })
  b.wire([7, TOP], [width, TOP])

  const a = (device: Dev, tag: string): Part => (x, y) => b.contact(x, y, device, 'a', tag)
  const bc = (device: Dev, tag: string): Part => (x, y) => b.contact(x, y, device, 'b', tag)
  for (const [x, pb, me, other] of [
    [10, 'PB1', 'X1', 'X2'],
    [16, 'PB2', 'X2', 'X1'],
  ] as const) {
    const [start] = b.rung(x, TOP, BOTTOM, [a('pb', pb), bc('relay', other), (x, y) => b.coil(x, y, 'relay', me)])
    b.contact(x + 2, start!.top, 'relay', 'a', me)
    b.wire([x, start!.top], [x + 2, start!.top])
    b.wire([x + 2, start!.top + 3], [x, start!.top + 3])
  }
  b.rung(22, TOP, BOTTOM, [a('relay', 'X1'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(26, TOP, BOTTOM, [a('relay', 'X2'), (x, y) => b.lamp(x, y, 'GL')])
  return b.build('예제: 인터록 회로')
}

/**
 * 타이머 회로 (ON 딜레이)
 *   PB0(b) → PB1(a) ∥ X-a → X,   X-a → T(3초),   X-a → RL,   T-a → GL(3초 뒤),   T-b → YL(3초 뒤 꺼짐)
 */
export function timerCircuit(): Circuit {
  const { b, a, bc, parallel } = board(28)
  const [, start] = b.rung(2, TOP, BOTTOM, [bc('pb', 'PB0'), a('pb', 'PB1'), (x, y) => b.coil(x, y, 'relay', 'X')])
  parallel(2, start!.top, 'relay', 'X')
  b.rung(10, TOP, BOTTOM, [a('relay', 'X'), (x, y) => b.coil(x, y, 'timer', 'T', 3000)])
  b.rung(14, TOP, BOTTOM, [a('relay', 'X'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(18, TOP, BOTTOM, [a('relay', 'X'), bc('timer', 'T'), (x, y) => b.lamp(x, y, 'YL')])
  b.rung(22, TOP, BOTTOM, [a('timer', 'T'), (x, y) => b.lamp(x, y, 'GL')])
  return b.build('예제: 타이머 회로')
}

/**
 * 카운터 회로
 *   PB1 → C(계수, 설정 3),   PB2 → C 리셋,   C-a → RL(3번째에 점등),   C-b → GL
 */
export function counterCircuit(): Circuit {
  const { b, a, bc } = board(20)
  b.rung(2, TOP, BOTTOM, [a('pb', 'PB1'), (x, y) => b.coil(x, y, 'counter', 'C', 3)])
  b.rung(6, TOP, BOTTOM, [a('pb', 'PB2'), (x, y) => b.coil(x, y, 'counterReset', 'C')])
  b.rung(10, TOP, BOTTOM, [a('counter', 'C'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(14, TOP, BOTTOM, [bc('counter', 'C'), (x, y) => b.lamp(x, y, 'GL')])
  return b.build('예제: 카운터 회로')
}
