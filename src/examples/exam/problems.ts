// 전기기능사 실기 공개문제 1~18번 조작회로 (2025-08-04 공개도면 기준)
// 저작권: 한국산업인력공단. 수업용으로만 사용한다.
//
// 표기: col(열, 시작 y, [[칸, 부품]…], 끝)  /  h(층 y, [열…])  — kit.ts 참고
// 셀렉터 SS: a접점 = A(자동) 위치, b접점 = M(수동) 위치
import type { Circuit } from '../../engine'
import { examSheet, JOIN, TOP, type Part, type Sheet } from './kit'

const [j0, j1, j2, j3, j4] = JOIN

/** 1~9번 공통: EOCR-a → YL ∥ BZ (EOCR 전원 열 j1에서 갈라짐) */
function eocrAlarm(s: Sheet) {
  s.h(j1, [0, 1])
  s.col(1, j1, [[2, s.a('eocr', 'EOCR')]], s.lamp('YL'))
  s.h(j2, [1, 2])
  s.col(2, j2, [], s.buzzer)
}

/** 1·9번: EOCR-a → FR,  FR-a → YL,  FR-b → BZ */
function eocrFlicker(s: Sheet) {
  s.h(j1, [0, 1])
  s.col(1, j1, [[2, s.a('eocr', 'EOCR')]], s.flicker('FR', 1000))
  s.h(j2, [1, 2, 3])
  s.col(2, j2, [[3, s.a('flicker', 'FR')]], s.lamp('YL'))
  s.col(3, j2, [[3, s.bc('flicker', 'FR')]], s.buzzer)
}

/** 10~18번 공통: EOCR-a → YL (EOCR 전원 열 j3에서 갈라짐) */
function eocrLamp(s: Sheet) {
  s.h(j3, [0, 1])
  s.col(1, j3, [[4, s.a('eocr', 'EOCR')]], s.lamp('YL'))
}

/** MCn-a → 표시등 */
function mcLamps(s: Sheet, i: number) {
  s.simple(i, s.a('mc', 'MC1'), s.lamp('RL'))
  s.simple(i + 1, s.a('mc', 'MC2'), s.lamp('GL'))
}

export function exam01(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 11 })
  eocrFlicker(s)
  // 자동: SS(A) → FLS 전원,  FLS-a → X
  s.col(4, j1, [], s.fls)
  s.col(5, TOP, [[0, s.a('selector', 'SS')], [2, s.a('fls', 'FLS')]], s.relay('X'))
  s.h(j1, [4, 5])
  // 수동: SS(M) → PB0 → PB1 ∥ T순시-a → X-b → T
  s.col(6, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')], [3, s.bc('relay', 'X')]], s.timer('T'))
  s.col(7, j1, [[2, s.a('timerInst', 'T')]], j2)
  s.h(j1, [6, 7])
  // X-a ∥ (수동 경로) → MC1,  T-a → MC2
  s.col(8, TOP, [[0, s.a('relay', 'X')]], s.mc('MC1'))
  s.col(9, j2, [[3, s.a('timer', 'T')]], s.mc('MC2'))
  s.h(j2, [6, 7, 8, 9])
  mcLamps(s, 10)
  return s.build('공개문제 1번')
}

export function exam02(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 11 })
  eocrAlarm(s)
  s.col(3, j1, [], s.fls)
  s.col(4, TOP, [[0, s.a('selector', 'SS')], [2, s.a('fls', 'FLS')]], s.relay('X'))
  s.h(j1, [3, 4])
  s.col(5, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')]], s.timer('T'))
  s.col(6, j1, [[2, s.a('relay', 'X')]], j2)
  s.h(j1, [5, 6])
  s.h(j2, [4, 5, 6])
  // X-a → T-a → FR,  FR-b → MC1,  FR-a → MC2
  s.col(7, TOP, [[0, s.a('relay', 'X')], [1, s.a('timer', 'T')]], s.flicker('FR'))
  s.col(8, j2, [[3, s.bc('flicker', 'FR')]], s.mc('MC1'))
  s.col(9, j2, [[3, s.a('flicker', 'FR')]], s.mc('MC2'))
  s.h(j2, [7, 8, 9])
  mcLamps(s, 10)
  return s.build('공개문제 2번')
}

export function exam03(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 10 })
  eocrAlarm(s)
  // X-a ∥ (SS(A) → FLS-a) → FR,  FR-b → MC1,  FR-a → MC2
  s.col(3, j2, [[3, s.bc('flicker', 'FR')]], s.mc('MC1'))
  s.col(4, TOP, [[0, s.a('relay', 'X')], [3, s.a('flicker', 'FR')]], s.mc('MC2'))
  s.h(j2, [3, 4])
  s.col(5, TOP, [[0, s.a('selector', 'SS')], [1, s.a('fls', 'FLS')]], s.flicker('FR'))
  s.col(6, j0, [], s.fls)
  s.h(j0, [5, 6])
  s.h(j1, [4, 5])
  // 수동: SS(M) → PB0 → PB1 ∥ T순시-a → T,  T-a → X
  s.col(7, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')]], s.timer('T'))
  s.col(8, j1, [[2, s.a('timerInst', 'T')], [3, s.a('timer', 'T')]], s.relay('X'))
  s.h(j1, [7, 8])
  s.h(j2, [7, 8])
  mcLamps(s, 9)
  return s.build('공개문제 3번')
}

export function exam04(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 11 })
  eocrAlarm(s)
  s.col(3, j1, [], s.fls)
  s.col(4, TOP, [[0, s.a('selector', 'SS')], [2, s.a('fls', 'FLS')]], s.flicker('FR', 4000))
  s.h(j1, [3, 4])
  s.col(5, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')]], s.relay('X'))
  s.col(6, j1, [[2, s.a('relay', 'X')]], j2)
  s.h(j1, [5, 6])
  s.h(j2, [4, 5, 6])
  // X-a → FR-b → MC1,  FR-a → T-b → MC2,  FR-a → T  (T 설정 < FR 설정)
  s.col(7, TOP, [[0, s.a('relay', 'X')], [2, s.bc('flicker', 'FR')]], s.mc('MC1'))
  s.col(8, j1, [[2, s.a('flicker', 'FR')], [3, s.bc('timer', 'T')]], s.mc('MC2'))
  s.col(9, j2, [], s.timer('T', 2000))
  s.h(j1, [7, 8])
  s.h(j2, [8, 9])
  mcLamps(s, 10)
  return s.build('공개문제 4번')
}

export function exam05(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 11 })
  eocrAlarm(s)
  // SS(A) → FLS 전원,  FLS-a ∥ (SS(M) → PB0 → PB1 ∥ X-a) → X, T
  s.col(3, TOP, [[0, s.a('selector', 'SS')]], s.fls)
  s.col(4, j1, [[2, s.a('fls', 'FLS')]], s.relay('X'))
  s.h(j1, [3, 4])
  s.col(5, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')]], s.timer('T'))
  // X-a 자기유지 → T-b → FR
  s.col(6, j1, [[2, s.a('relay', 'X')], [3, s.bc('timer', 'T')]], s.flicker('FR'))
  s.h(j1, [5, 6])
  // FR-b → MC1,  FR-a ∥ T-a → MC2
  s.col(7, j2, [[3, s.bc('flicker', 'FR')]], s.mc('MC1'))
  s.col(8, j2, [[3, s.a('flicker', 'FR')]], s.mc('MC2'))
  s.col(9, j2, [[3, s.a('timer', 'T')]], j3)
  s.h(j3, [8, 9])
  s.h(j2, [4, 5, 6, 7, 8, 9])
  mcLamps(s, 10)
  return s.build('공개문제 5번')
}

export function exam06(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 11 })
  eocrAlarm(s)
  s.col(3, TOP, [[0, s.a('selector', 'SS')]], s.fls)
  s.col(4, j1, [[2, s.a('fls', 'FLS')]], s.relay('X'))
  s.h(j1, [3, 4])
  // 수동: SS(M) → PB0 → PB1 ∥ T순시-a → X-b → T
  s.col(5, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')], [3, s.bc('relay', 'X')]], s.timer('T'))
  s.col(6, j1, [[2, s.a('timerInst', 'T')]], j2)
  s.h(j1, [5, 6])
  // X-a ∥ (수동 경로) → T-a → FR
  s.col(7, TOP, [[0, s.a('relay', 'X')], [3, s.a('timer', 'T')]], s.flicker('FR'))
  s.h(j2, [5, 6, 7])
  // FR-b → MC1 ∥ RL,  T-b ∥ FR-a → MC2 ∥ GL
  s.col(8, j1, [[2, s.bc('flicker', 'FR')]], s.mc('MC1'))
  s.col(9, j3, [], s.lamp('RL'))
  s.h(j3, [8, 9])
  s.col(10, j1, [[2, s.bc('timer', 'T')]], j2)
  s.col(11, j1, [[2, s.a('flicker', 'FR')]], s.mc('MC2'))
  s.h(j2, [10, 11])
  s.col(10, j3, [], s.lamp('GL'))
  s.h(j3, [10, 11])
  s.h(j1, [7, 8, 10, 11])
  return s.build('공개문제 6번')
}

export function exam07(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 11 })
  eocrAlarm(s)
  s.col(3, j1, [], s.fls)
  s.col(4, TOP, [[0, s.a('selector', 'SS')], [2, s.a('fls', 'FLS')]], s.flicker('FR', 4000))
  s.h(j1, [3, 4])
  s.col(5, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')]], s.relay('X'))
  s.col(6, j1, [[2, s.a('relay', 'X')]], j2)
  s.h(j1, [5, 6])
  s.h(j2, [4, 5, 6])
  // X-a → FR-b → T,  T-b → MC1,  T-a → MC2  (T 설정 < FR 설정)
  s.col(7, TOP, [[0, s.a('relay', 'X')], [2, s.bc('flicker', 'FR')]], s.timer('T', 2000))
  s.col(8, j2, [[3, s.bc('timer', 'T')]], s.mc('MC1'))
  s.col(9, j2, [[3, s.a('timer', 'T')]], s.mc('MC2'))
  s.h(j2, [7, 8, 9])
  mcLamps(s, 10)
  return s.build('공개문제 7번')
}

export function exam08(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 11 })
  // EOCR-a → BZ
  s.h(j2, [0, 1])
  s.col(1, j2, [[3, s.a('eocr', 'EOCR')]], s.buzzer)
  // 자동: SS(A) → FLS-a → X, FR,  FR-b → YL
  s.col(2, j1, [], s.fls)
  s.col(3, TOP, [[0, s.a('selector', 'SS')], [2, s.a('fls', 'FLS')]], s.relay('X'))
  s.h(j1, [2, 3])
  s.col(4, j2, [], s.flicker('FR', 1000))
  s.col(5, j2, [[3, s.bc('flicker', 'FR')]], s.lamp('YL'))
  s.h(j2, [3, 4, 5])
  // 수동: SS(M) → PB0 → PB1 ∥ T순시-a → X-b → T
  s.col(6, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')], [3, s.bc('relay', 'X')]], s.timer('T'))
  s.col(7, j1, [[2, s.a('timerInst', 'T')]], j2)
  s.h(j1, [6, 7])
  // X-a ∥ (수동 경로) → T-b → MC1, MC2
  s.col(8, TOP, [[0, s.a('relay', 'X')]], j2)
  s.h(j2, [6, 7, 8])
  s.col(9, j1, [[2, s.bc('timer', 'T')]], s.mc('MC2'))
  s.h(j1, [8, 9])
  s.col(8, j3, [], s.mc('MC1'))
  s.h(j3, [8, 9])
  mcLamps(s, 10)
  return s.build('공개문제 8번')
}

export function exam09(): Circuit {
  const s = examSheet({ pb0OnTop: false, lastCol: 11 })
  eocrFlicker(s)
  // X-a ∥ (SS(A) → FLS-a) → MC1
  s.col(4, TOP, [[0, s.a('relay', 'X')]], j2)
  s.col(5, TOP, [[0, s.a('selector', 'SS')], [2, s.a('fls', 'FLS')]], s.mc('MC1'))
  s.h(j2, [4, 5])
  s.col(6, j1, [], s.fls)
  s.h(j1, [5, 6])
  // 수동: SS(M) → PB0 → PB1 ∥ X-a → X, T
  s.col(7, TOP, [[0, s.bc('selector', 'SS')], [1, s.bc('pb', 'PB0')], [2, s.a('pb', 'PB1')]], s.relay('X'))
  s.col(8, j1, [[2, s.a('relay', 'X')]], s.timer('T'))
  s.h(j1, [7, 8])
  s.h(j2, [7, 8])
  s.simple(9, s.a('timer', 'T'), s.mc('MC2'))
  mcLamps(s, 10)
  return s.build('공개문제 9번')
}

// ── 10~18번: 위 제어선에 EOCR-b와 PB0(b), 리밋 스위치 LS1·LS2

/** WL: (X1-a → MC1-b) ∥ (X2-a → MC2-b) */
function wlIdle(s: Sheet, i: number) {
  s.col(i, TOP, [[0, s.a('relay', 'X1')], [1, s.bc('mc', 'MC1')]], s.lamp('WL'))
  s.col(i + 1, TOP, [[0, s.a('relay', 'X2')], [1, s.bc('mc', 'MC2')]], j1)
  s.h(j1, [i, i + 1])
}

/** 위 제어선에서 병렬 접점 줄들 → j0에서 합침 (첫 줄은 그대로 아래로 이어진다) */
function parallelTop(s: Sheet, first: number, others: [number, Part][]) {
  for (const [i, part] of others) s.col(i, TOP, [[0, part]], j0)
  s.h(j0, [first, ...others.map(([i]) => i)])
}

export function exam10(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 11 })
  eocrLamp(s)
  for (const [i, n] of [
    [2, '1'],
    [5, '2'],
  ] as const) {
    // PBn ∥ Xn-a → Xn,  LSn-a → Tn,  Tn-a → MCn
    s.col(i, TOP, [[0, s.a('pb', `PB${n}`)]], s.relay(`X${n}`))
    parallelTop(s, i, [[i + 1, s.a('relay', `X${n}`)]])
    s.col(i + 1, j3, [[4, s.a('limit', `LS${n}`)]], s.timer(`T${n}`))
    s.col(i + 2, j3, [[4, s.a('timer', `T${n}`)]], s.mc(`MC${n}`))
    s.h(j3, [i, i + 1, i + 2])
  }
  wlIdle(s, 8)
  mcLamps(s, 10)
  return s.build('공개문제 10번')
}

export function exam11(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 11 })
  eocrLamp(s)
  for (const [i, n, other] of [
    [2, '1', '2'],
    [5, '2', '1'],
  ] as const) {
    // PBn ∥ Tn-a → Xn,  LSn-a → MCn,  X(상대)-b → Tn
    s.col(i, TOP, [[0, s.a('pb', `PB${n}`)]], s.relay(`X${n}`))
    parallelTop(s, i, [[i + 1, s.a('timer', `T${n}`)]])
    s.col(i + 1, j3, [[4, s.a('limit', `LS${n}`)]], s.mc(`MC${n}`))
    s.col(i + 2, j3, [[4, s.bc('relay', `X${other}`)]], s.timer(`T${n}`))
    s.h(j3, [i, i + 1, i + 2])
  }
  wlIdle(s, 8)
  mcLamps(s, 10)
  return s.build('공개문제 11번')
}

/** T1순시-a ∥ T2순시-a → WL */
function wlTimers(s: Sheet, i: number) {
  s.col(i, TOP, [[0, s.a('timerInst', 'T1')]], s.lamp('WL'))
  s.col(i + 1, TOP, [[0, s.a('timerInst', 'T2')]], j0)
  s.h(j0, [i, i + 1])
}

export function exam12(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 11 })
  eocrLamp(s)
  // PB1 ∥ X1-a ∥ T2-a → X1,  LS1-a → MC1,  MC1-b → T1
  s.col(2, TOP, [[0, s.a('pb', 'PB1')]], s.relay('X1'))
  parallelTop(s, 2, [
    [3, s.a('relay', 'X1')],
    [4, s.a('timer', 'T2')],
  ])
  s.col(3, j3, [[4, s.a('limit', 'LS1')]], s.mc('MC1'))
  s.col(4, j3, [[4, s.bc('mc', 'MC1')]], s.timer('T1'))
  s.h(j3, [2, 3, 4])
  // PB2 ∥ X2-a ∥ T1-a → X2, MC2,  LS2-a → T2
  s.col(5, TOP, [[0, s.a('pb', 'PB2')]], s.relay('X2'))
  parallelTop(s, 5, [
    [6, s.a('relay', 'X2')],
    [7, s.a('timer', 'T1')],
  ])
  s.col(7, j3, [[4, s.a('limit', 'LS2')]], s.timer('T2'))
  s.h(j3, [5, 7])
  s.col(6, j4, [], s.mc('MC2'))
  s.h(j4, [5, 6])
  wlTimers(s, 8)
  mcLamps(s, 10)
  return s.build('공개문제 12번')
}

export function exam13(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 11 })
  eocrLamp(s)
  // PB1 ∥ X1-a ∥ LS1-a → T2-b → X1,  LS2-a → MC1,  MC1-b → T1
  s.col(2, TOP, [[0, s.a('pb', 'PB1')], [2, s.bc('timer', 'T2')]], s.relay('X1'))
  parallelTop(s, 2, [
    [3, s.a('relay', 'X1')],
    [4, s.a('limit', 'LS1')],
  ])
  s.col(3, j3, [[4, s.a('limit', 'LS2')]], s.mc('MC1'))
  s.col(4, j3, [[4, s.bc('mc', 'MC1')]], s.timer('T1'))
  s.h(j3, [2, 3, 4])
  // PB2 ∥ X2-a ∥ T1-a → X2, MC2,  X1-a → T2
  s.col(5, TOP, [[0, s.a('pb', 'PB2')]], s.relay('X2'))
  parallelTop(s, 5, [
    [6, s.a('relay', 'X2')],
    [7, s.a('timer', 'T1')],
  ])
  s.col(7, j3, [[4, s.a('relay', 'X1')]], s.timer('T2'))
  s.h(j3, [5, 7])
  s.col(6, j4, [], s.mc('MC2'))
  s.h(j4, [5, 6])
  wlTimers(s, 8)
  mcLamps(s, 10)
  return s.build('공개문제 13번')
}

/** LS1-a → X1,  LS2-a → X2 */
function limitRelays(s: Sheet) {
  s.simple(2, s.a('limit', 'LS1'), s.relay('X1'))
  s.simple(3, s.a('limit', 'LS2'), s.relay('X2'))
}

/** MCn과 Tn을 j4에서 나란히 (Tn은 오른쪽 열) */
function withTimer(s: Sheet, i: number, n: string) {
  s.h(j4, [i, i + 1])
  s.col(i + 1, j4, [], s.timer(`T${n}`))
}

export function exam14(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 10 })
  eocrLamp(s)
  limitRelays(s)
  // PB1 ∥ T1순시-a → X1-a → X2-a → T1-b → MC1, T1  (LS1·LS2 모두 감지)
  s.col(4, TOP, [[0, s.a('pb', 'PB1')], [1, s.a('relay', 'X1')], [2, s.a('relay', 'X2')], [3, s.bc('timer', 'T1')]], s.mc('MC1'))
  parallelTop(s, 4, [[5, s.a('timerInst', 'T1')]])
  withTimer(s, 4, '1')
  s.simple(6, s.a('mc', 'MC1'), s.lamp('RL'))
  // PB2 ∥ T2순시-a → (X1-a ∥ X2-a) → T2-b → MC2, T2  (LS1·LS2 중 하나 이상)
  s.col(7, TOP, [[0, s.a('pb', 'PB2')], [1, s.a('relay', 'X1')], [3, s.bc('timer', 'T2')]], s.mc('MC2'))
  s.col(8, TOP, [[0, s.a('timerInst', 'T2')], [1, s.a('relay', 'X2')]], j1)
  s.h(j0, [7, 8])
  s.h(j1, [7, 8])
  withTimer(s, 7, '2')
  s.simple(9, s.a('mc', 'MC2'), s.lamp('GL'))
  s.col(10, TOP, [[0, s.bc('mc', 'MC1')], [1, s.bc('mc', 'MC2')]], s.lamp('WL'))
  return s.build('공개문제 14번')
}

export function exam15(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 11 })
  eocrLamp(s)
  limitRelays(s)
  // PB1 → (X1-a ∥ X2-a) ∥ T1순시-a → T1-b → MC1, T1  (LS1·LS2 중 하나 이상)
  s.col(4, TOP, [[0, s.a('pb', 'PB1')], [1, s.a('relay', 'X1')], [3, s.bc('timer', 'T1')]], s.mc('MC1'))
  s.col(5, j0, [[1, s.a('relay', 'X2')]], j1)
  s.col(6, TOP, [[0, s.a('timerInst', 'T1')]], j1)
  s.h(j0, [4, 5])
  s.h(j1, [4, 5, 6])
  withTimer(s, 4, '1')
  s.simple(7, s.a('mc', 'MC1'), s.lamp('RL'))
  // PB2 → X1-a → X2-a ∥ T2순시-a → T2-b → MC2, T2  (LS1·LS2 모두 감지)
  s.col(8, TOP, [[0, s.a('pb', 'PB2')], [1, s.a('relay', 'X1')], [2, s.a('relay', 'X2')], [3, s.bc('timer', 'T2')]], s.mc('MC2'))
  s.col(9, TOP, [[0, s.a('timerInst', 'T2')]], j2)
  s.h(j2, [8, 9])
  withTimer(s, 8, '2')
  s.simple(10, s.a('mc', 'MC2'), s.lamp('GL'))
  s.col(11, TOP, [[0, s.bc('mc', 'MC1')], [1, s.bc('mc', 'MC2')]], s.lamp('WL'))
  return s.build('공개문제 15번')
}

export function exam16(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 11 })
  eocrLamp(s)
  s.simple(2, s.a('limit', 'LS1'), s.timer('T1'))
  s.simple(3, s.a('limit', 'LS2'), s.timer('T2'))
  // PB1 ∥ X1-a ∥ T1-a → MC1, X1
  s.col(4, TOP, [[0, s.a('pb', 'PB1')]], s.mc('MC1'))
  parallelTop(s, 4, [
    [5, s.a('relay', 'X1')],
    [6, s.a('timer', 'T1')],
  ])
  s.col(5, j4, [], s.relay('X1'))
  s.h(j4, [4, 5])
  s.simple(7, s.a('mc', 'MC1'), s.lamp('RL'))
  // PB2 ∥ X2-a ∥ T2순시-a → T1순시-a → T2-b → MC2,  T2-a → WL,  X2
  s.col(8, TOP, [[0, s.a('pb', 'PB2')], [1, s.a('timerInst', 'T1')], [4, s.bc('timer', 'T2')]], s.mc('MC2'))
  parallelTop(s, 8, [
    [9, s.a('relay', 'X2')],
    [10, s.a('timerInst', 'T2')],
  ])
  s.col(9, j3, [[4, s.a('timer', 'T2')]], s.lamp('WL'))
  s.col(10, j3, [], s.relay('X2'))
  s.h(j3, [8, 9, 10])
  s.simple(11, s.a('mc', 'MC2'), s.lamp('GL'))
  return s.build('공개문제 16번')
}

export function exam17(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 10 })
  eocrLamp(s)
  limitRelays(s)
  // PB1 ∥ T1순시-a → (X1-a → X2-b) ∥ (X1-b → X2-a) → MC1, T1  (LS1·LS2 중 하나만)
  s.col(4, TOP, [[0, s.a('pb', 'PB1')], [1, s.a('relay', 'X1')], [2, s.bc('relay', 'X2')]], s.mc('MC1'))
  s.col(5, TOP, [[0, s.a('timerInst', 'T1')], [1, s.bc('relay', 'X1')], [2, s.a('relay', 'X2')]], j3)
  s.h(j0, [4, 5])
  s.h(j3, [4, 5])
  withTimer(s, 4, '1')
  s.simple(6, s.a('mc', 'MC1'), s.lamp('RL'))
  // PB2 ∥ T2순시-a → T1-a → T2-b → MC2,  T2-a → WL,  T2
  s.col(7, TOP, [[0, s.a('pb', 'PB2')], [1, s.a('timer', 'T1')], [4, s.bc('timer', 'T2')]], s.mc('MC2'))
  parallelTop(s, 7, [[8, s.a('timerInst', 'T2')]])
  s.col(8, j3, [[4, s.a('timer', 'T2')]], s.lamp('WL'))
  s.col(9, j3, [], s.timer('T2'))
  s.h(j3, [7, 8, 9])
  s.simple(10, s.a('mc', 'MC2'), s.lamp('GL'))
  return s.build('공개문제 17번')
}

export function exam18(): Circuit {
  const s = examSheet({ pb0OnTop: true, lastCol: 11 })
  eocrLamp(s)
  limitRelays(s)
  // (PB1 → X1-a → X2-b) ∥ T1순시-a → MC1, T1  (LS1 감지·LS2 해제)
  s.col(4, TOP, [[0, s.a('pb', 'PB1')], [1, s.a('relay', 'X1')], [2, s.bc('relay', 'X2')]], s.mc('MC1'))
  s.col(5, TOP, [[0, s.a('timerInst', 'T1')]], j3)
  s.h(j3, [4, 5])
  withTimer(s, 4, '1')
  s.simple(6, s.a('mc', 'MC1'), s.lamp('RL'))
  // (PB2 → X1-b → X2-a) ∥ T2순시-a → MC2, T2  (LS1 해제·LS2 감지)
  s.col(7, TOP, [[0, s.a('pb', 'PB2')], [1, s.bc('relay', 'X1')], [2, s.a('relay', 'X2')]], s.mc('MC2'))
  s.col(8, TOP, [[0, s.a('timerInst', 'T2')]], j3)
  s.h(j3, [7, 8])
  withTimer(s, 7, '2')
  s.simple(9, s.a('mc', 'MC2'), s.lamp('GL'))
  // T1-a ∥ T2-a → WL
  s.col(10, TOP, [[0, s.a('timer', 'T1')]], s.lamp('WL'))
  s.col(11, TOP, [[0, s.a('timer', 'T2')]], j0)
  s.h(j0, [10, 11])
  return s.build('공개문제 18번')
}
