// 시뮬레이션 상태와 사용자 조작
// 상태는 불변 객체로 다룬다. 조작·스캔은 항상 새 상태를 돌려준다.

export interface TimerState {
  /** 코일이 여자된 뒤 누적된 시간(ms) */
  elapsed: number
  /** 설정 시간 도달 → 한시접점 전환 */
  done: boolean
}

export interface CounterState {
  count: number
  /** 직전 스캔의 계수 코일 상태 (상승 에지 검출용) */
  input: boolean
}

export interface FlickerState {
  /** 코일이 여자된 뒤 누적된 시간(ms) */
  elapsed: number
  /** 출력 상태: true면 a접점 닫힘·b접점 열림 */
  on: boolean
}

export interface ThrState {
  tripped: boolean
  /** 과부하·결상이 지속된 시간(ms) */
  heat: number
}

export interface SimState {
  /** 시뮬레이션 경과 시간(ms) */
  time: number
  /** 입력 장치(PB, 셀렉터, 리밋, MCCB)의 동작 여부. tag 기준 */
  inputs: Record<string, boolean>
  /** 코일 여자 여부. 키는 tag, 카운터 리셋 코일은 resetKey(tag) */
  coils: Record<string, boolean>
  timers: Record<string, TimerState>
  counters: Record<string, CounterState>
  flickers: Record<string, FlickerState>
  /** 과부하 보호계전기(THR·EOCR) 상태. tag 기준 */
  thr: Record<string, ThrState>
  /** 용단된 퓨즈 (부품 id 기준) */
  blownFuses: Record<string, boolean>
  /**
   * 전환 중인 스위치 (tag 기준). 스위치는 "끊고 나서 붙는" 구조라서 돌리거나 누르는 도중에는
   * 같은 스위치의 a접점과 b접점이 잠깐 모두 열린다.
   */
  moving: Record<string, boolean>
}

export const resetKey = (tag: string) => `${tag}#리셋`
/** 플로트레스·EOCR처럼 "전원이 들어와 있는가"만 의미 있는 부하의 코일 키 */
export const powerKey = (tag: string) => `${tag}#전원`

export function initialState(): SimState {
  return { time: 0, inputs: {}, coils: {}, timers: {}, counters: {}, flickers: {}, thr: {}, blownFuses: {}, moving: {} }
}

export type Action =
  | { type: 'press'; tag: string } // 푸시버튼 누름 / 리밋 스위치 동작
  | { type: 'release'; tag: string } // 손을 뗌
  | { type: 'toggle'; tag: string } // 셀렉터·MCCB 전환, 플로트레스 수위 감지
  | { type: 'thrTrip'; tag: string } // THR·EOCR 트립 (고장 모의 / EOCR 테스트 버튼)
  | { type: 'thrReset'; tag: string } // THR·EOCR 리셋 버튼
  | { type: 'fuseReplace' } // 용단된 퓨즈를 모두 새것으로 교체

export function applyAction(s: SimState, a: Action): SimState {
  switch (a.type) {
    case 'press':
      return { ...s, inputs: { ...s.inputs, [a.tag]: true } }
    case 'release':
      return { ...s, inputs: { ...s.inputs, [a.tag]: false } }
    case 'toggle':
      return { ...s, inputs: { ...s.inputs, [a.tag]: !s.inputs[a.tag] } }
    case 'thrTrip':
      return { ...s, thr: { ...s.thr, [a.tag]: { tripped: true, heat: s.thr[a.tag]?.heat ?? 0 } } }
    case 'thrReset':
      return { ...s, thr: { ...s.thr, [a.tag]: { tripped: false, heat: 0 } } }
    case 'fuseReplace':
      return { ...s, blownFuses: {} }
  }
}
