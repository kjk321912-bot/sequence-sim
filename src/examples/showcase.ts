// 첫 화면 예제: 공개도면 스타일의 전동기 자동·수동 운전 회로 (직접 구성한 예제)
//
// 주회로: L1·L2·L3 → MCCB → EOCR → MC1 주접점 → M1
// 조작 전원: L1·L3에서 퓨즈 F1·F2를 거쳐 위·아래 제어선으로
// 조작회로
//   - EOCR 전원 / EOCR-a → FR, FR-a → YL, FR-b → BZ (과부하 경보: YL·BZ 교대)
//   - EOCR-b 이후
//     자동: SS(A) → FLS 전원,  SS(A) → FLS-a → X,  X-a → MC1
//     수동: SS(M) → PB0 → PB1 ∥ T순시-a → T,  T순시-a → MC1,  T한시-a → GL
//     MC1-a → RL,  MC1-b → WL
import { CircuitBuilder, TWO_TERMINAL_SPAN, type Circuit } from '../engine'

export function showcaseCircuit(): Circuit {
  const b = new CircuitBuilder()
  const S = TWO_TERMINAL_SPAN

  // ── 주회로
  b.bus('R', 0, 0, 12)
  b.bus('S', 0, 1, 12)
  b.bus('T', 0, 2, 12)
  b.add({ kind: 'mccb', x: 2, y: 5, tag: 'MCCB' })
  b.wire([2, 0], [2, 5])
  b.wire([4, 1], [4, 5])
  b.wire([6, 2], [6, 5])
  b.add({ kind: 'thrHeater', relay: 'eocr', x: 2, y: 12, tag: 'EOCR', tripTime: 3000 })
  b.wire([2, 8], [2, 12])
  b.wire([4, 8], [4, 12])
  b.wire([6, 8], [6, 12])
  b.add({ kind: 'mcMain', x: 2, y: 12 + S, tag: 'MC1' })
  b.add({ kind: 'motor', x: 2, y: 12 + 2 * S, tag: 'M1' })

  // ── 조작 전원: L1 → F1 → 위 제어선,  L3 → F2 → 아래 제어선
  const top = 0
  const bottom = 24
  b.wire([2, 9], [9, 9])
  b.add({ kind: 'fuse', x: 9, y: 9, rot: 270, tag: 'F1' })
  b.wire([12, 9], [16, 9], [16, top], [26, top])
  b.wire([6, 11], [9, 11])
  b.add({ kind: 'fuse', x: 9, y: 11, rot: 270, tag: 'F2' })
  b.wire([12, 11], [15, 11], [15, bottom], [64, bottom])

  // EOCR-b를 위 제어선에 가로로 넣는다
  b.add({ kind: 'contact', x: 26, y: top, rot: 270, device: 'eocr', type: 'b', tag: 'EOCR' })
  b.wire([29, top], [64, top])

  type Dev = Parameters<CircuitBuilder['contact']>[2]
  const ct = (device: Dev, type: 'a' | 'b', tag: string) => (x: number, y: number) => b.contact(x, y, device, type, tag)

  // ── EOCR 전원과 과부하 경보
  b.rung(18, top, bottom, [(x, y) => b.coil(x, y, 'eocr', 'EOCR')])
  b.wire([22, top], [22, 1])
  b.contact(22, 1, 'eocr', 'a', 'EOCR')
  b.wire([22, 4], [22, 6], [30, 6])
  b.wire([22, 6], [22, 8])
  b.coil(22, 8, 'flicker', 'FR', 1000)
  b.wire([22, 11], [22, bottom])
  for (const [x, type, load] of [
    [26, 'a', 'YL'],
    [30, 'b', 'BZ'],
  ] as const) {
    b.wire([x, 6], [x, 8])
    b.contact(x, 8, 'flicker', type, 'FR')
    if (load === 'BZ') b.add({ kind: 'buzzer', x, y: 11, tag: 'BZ' })
    else b.lamp(x, 11, 'YL')
    b.wire([x, 14], [x, bottom])
  }

  // ── 자동 운전: SS(A) → FLS, FLS-a → X
  b.rung(34, top, bottom, [ct('selector', 'a', 'SS'), (x, y) => b.add({ kind: 'fls', x, y, tag: 'FLS' })])
  b.rung(38, top, bottom, [ct('selector', 'a', 'SS'), ct('fls', 'a', 'FLS'), (x, y) => b.coil(x, y, 'relay', 'X')])

  // ── 수동 운전: SS(M) → PB0 → PB1 ∥ T순시-a → T
  const manual = b.rung(42, top, bottom, [
    ct('selector', 'b', 'SS'),
    ct('pb', 'b', 'PB0'),
    ct('pb', 'a', 'PB1'),
    (x, y) => b.coil(x, y, 'timer', 'T', 3000),
  ])
  const pb1 = manual[2]!.top
  b.contact(44, pb1, 'timerInst', 'a', 'T')
  b.wire([42, pb1], [44, pb1])
  b.wire([44, pb1 + S], [42, pb1 + S])

  // ── MC1: X-a ∥ T순시-a
  b.rung(48, top, bottom, [ct('relay', 'a', 'X'), (x, y) => b.coil(x, y, 'mc', 'MC1')])
  b.contact(50, 1, 'timerInst', 'a', 'T')
  b.wire([48, 1], [50, 1])
  b.wire([50, 1 + S], [48, 1 + S])

  // ── 표시등
  b.rung(54, top, bottom, [ct('timer', 'a', 'T'), (x, y) => b.lamp(x, y, 'GL')])
  b.rung(58, top, bottom, [ct('mc', 'a', 'MC1'), (x, y) => b.lamp(x, y, 'RL')])
  b.rung(62, top, bottom, [ct('mc', 'b', 'MC1'), (x, y) => b.lamp(x, y, 'WL')])

  return b.build('예제: 전동기 자동·수동 운전')
}
