// 기호 모음 예제: 모든 부품이 들어간 전동기 운전 회로 (처음 실행 시 표시)
import { CircuitBuilder, TWO_TERMINAL_SPAN, type Circuit } from '../engine'

export function showcaseCircuit(): Circuit {
  const b = new CircuitBuilder()
  const S = TWO_TERMINAL_SPAN

  // ── 주회로: R·S·T → MCCB → MC1 주접점 → THR1 히터 → 전동기
  b.bus('R', 0, 0, 14)
  b.bus('S', 0, 1, 14)
  b.bus('T', 0, 2, 14)
  b.add({ kind: 'mccb', x: 4, y: 5, tag: 'MCCB' })
  b.wire([4, 0], [4, 5])
  b.wire([6, 1], [6, 5])
  b.wire([8, 2], [8, 5])
  b.add({ kind: 'mcMain', x: 4, y: 5 + S, tag: 'MC1' })
  b.add({ kind: 'thrHeater', x: 4, y: 5 + 2 * S, tag: 'THR1', tripTime: 5000 })
  b.add({ kind: 'motor', x: 4, y: 5 + 3 * S, tag: 'M1' })

  // ── 조작회로
  const top = 0
  const bottom = 18
  b.bus('P', 20, top, 66)
  b.bus('N', 20, bottom, 66)
  const pb = (tag: string, type: 'a' | 'b') => (x: number, y: number) => b.contact(x, y, 'pb', type, tag)
  const ct = (device: Parameters<CircuitBuilder['contact']>[2], type: 'a' | 'b', tag: string) => (x: number, y: number) =>
    b.contact(x, y, device, type, tag)

  // 1. 자기유지: THR1-b → 정지 PB0 → 기동 PB1 ∥ MC1-a → MC1
  const r1 = b.rung(24, top, bottom, [ct('thr', 'b', 'THR1'), pb('PB0', 'b'), pb('PB1', 'a'), (x, y) => b.coil(x, y, 'mc', 'MC1')])
  const y1 = r1[2]!.top
  b.contact(27, y1, 'mc', 'a', 'MC1')
  b.wire([24, y1], [27, y1])
  b.wire([27, y1 + S], [24, y1 + S])

  // 2~4. 운전(RL)·정지(GL)·과부하 경보(BZ)
  b.rung(32, top, bottom, [ct('mc', 'a', 'MC1'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(37, top, bottom, [ct('mc', 'b', 'MC1'), (x, y) => b.lamp(x, y, 'GL')])
  b.rung(42, top, bottom, [ct('thr', 'a', 'THR1'), (x, y) => b.add({ kind: 'buzzer', x, y, tag: 'BZ' })])

  // 5~6. 셀렉터로 타이머 기동 → 3초 뒤 YL
  b.rung(47, top, bottom, [ct('selector', 'a', 'SS1'), (x, y) => b.coil(x, y, 'timer', 'T1', 3000)])
  b.rung(52, top, bottom, [ct('timer', 'a', 'T1'), (x, y) => b.lamp(x, y, 'YL')])

  // 7~9. 리밋 스위치 3회 → WL, PB2로 리셋
  b.rung(57, top, bottom, [ct('limit', 'a', 'LS1'), (x, y) => b.coil(x, y, 'counter', 'C1', 3)])
  b.rung(62, top, bottom, [pb('PB2', 'a'), (x, y) => b.coil(x, y, 'counterReset', 'C1')])
  b.rung(67, top, bottom, [ct('counter', 'a', 'C1'), (x, y) => b.lamp(x, y, 'WL')])

  // 10~12. 릴레이 X1과 나머지 b접점들
  b.rung(72, top, bottom, [pb('PB3', 'a'), (x, y) => b.coil(x, y, 'relay', 'X1')])
  b.rung(77, top, bottom, [ct('relay', 'a', 'X1'), ct('timer', 'b', 'T1'), ct('counter', 'b', 'C1'), (x, y) => b.lamp(x, y, 'GL', 'GL2')])
  b.rung(82, top, bottom, [ct('relay', 'b', 'X1'), ct('selector', 'b', 'SS1'), ct('limit', 'b', 'LS1'), (x, y) => b.lamp(x, y, 'RL', 'RL2')])

  return b.build('기호 모음')
}
