// 전기기능사 공개문제 예제 목록 (조작 방법은 문제지 "제어회로의 동작 사항" 요약)
import type { Example } from '../index'
import * as P from './problems'

const AUTO = 'MCCB를 켜고, 자동은 SS를 톡 쳐서 A로 바꾼 뒤 FLS로 수위 감지, 수동은 SS를 M에 두고 PB1'
const LIMIT = 'MCCB를 켜고 PB1·PB2와 리밋 스위치 LS1·LS2를 톡 쳐서 조작, PB0은 정지'

const list: [string, string][] = [
  ['자동: FLS → X, MC1 / 수동: PB1 → T, MC1 → t초 후 MC2 / EOCR: FR로 BZ·YL 교대', AUTO],
  ['T 설정시간 후 FR로 MC1·MC2 교대 운전 / EOCR: BZ·YL', AUTO],
  ['자동: FLS → FR로 MC1·MC2 교대 / 수동: PB1 → T → t초 후 X, FR', AUTO],
  ['FR 간격으로 M1 → M2 → 정지 반복 (T 설정 < FR 설정)', AUTO],
  ['FR로 MC1·MC2 교대 → T 설정시간 후 둘 다 운전', AUTO],
  ['자동: MC1·MC2 동시 / 수동: t초 후 FR로 MC1·MC2 교대', AUTO],
  ['FR 간격 동안 M1 → t초 후 M2 → 정지 반복 (T 설정 < FR 설정)', AUTO],
  ['자동: MC1·MC2 운전, YL 점멸 / 수동: t초 동안만 운전 / EOCR: BZ', AUTO],
  ['자동: MC1만 / 수동: X, T, MC1 → t초 후 MC2 / EOCR: FR로 BZ·YL 교대', AUTO],
  ['PB1 → X1 → LS1 감지 → T1 → t1초 후 MC1 (PB2·LS2 → MC2도 같은 방식)', LIMIT],
  ['PB1을 t1초 이상 눌러야 자기유지 → LS1 감지 → MC1 (PB2 쪽도 같은 방식)', LIMIT],
  ['PB1 → X1, T1 → LS1 감지면 MC1, 아니면 t1초 후 MC2 / PB2 → MC2 → LS2 → T2', LIMIT],
  ['PB1 또는 LS1 순간 감지 → X1, T1 → LS2 감지면 MC1, 아니면 t1초 후 MC2', LIMIT],
  ['LS1·LS2 모두 감지 + PB1 → MC1 / 하나 이상 감지 + PB2 → MC2 (각 t초 운전)', LIMIT],
  ['LS 하나 이상 + PB1 → MC1 / LS 모두 감지 + PB2 → MC2 (각 t초 운전)', LIMIT],
  ['LS1 감지 → t1초 후 MC1 / LS2 감지 → MC2 → t2초 후 정지·WL', LIMIT],
  ['LS 하나만 감지 + PB1 → MC1 → t1초 후 PB2 허가 → MC2 t2초 운전', LIMIT],
  ['LS1만 감지 + PB1 → MC1 / LS2만 감지 + PB2 → MC2 → t초 후 WL', LIMIT],
]

const makers = [
  P.exam01, P.exam02, P.exam03, P.exam04, P.exam05, P.exam06, P.exam07, P.exam08, P.exam09,
  P.exam10, P.exam11, P.exam12, P.exam13, P.exam14, P.exam15, P.exam16, P.exam17, P.exam18,
]

export const EXAM_EXAMPLES: Example[] = list.map(([summary, howTo], i) => ({
  key: `exam${String(i + 1).padStart(2, '0')}`,
  group: '전기기능사 공개문제',
  title: `공개문제 ${i + 1}번`,
  summary,
  howTo,
  make: makers[i]!,
}))
