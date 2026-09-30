// 회로 JSON 데이터 모델
// 과제 배포·학생 제출 파일이 이 형식을 따르므로, 필드를 바꿀 때는 CIRCUIT_VERSION을 올리고 변환 코드를 둔다.

export const CIRCUIT_VERSION = 1

/** 격자 좌표 (격자 단위, 픽셀 아님) */
export interface Point {
  x: number
  y: number
}

export type Rotation = 0 | 90 | 180 | 270

/** 전원 모선의 전위. P/N은 조작회로(직류/단상), R/S/T는 3상 주회로 */
export type Phase = 'P' | 'N' | 'R' | 'S' | 'T'

/**
 * 접점을 움직이는 장치 종류.
 * 같은 tag를 가진 코일·입력 장치의 상태에 따라 열리고 닫힌다.
 */
export type ContactDevice =
  | 'pb' // 푸시버튼 (누르는 동안만)
  | 'selector' // 셀렉터 스위치 (유지형)
  | 'limit' // 리밋 스위치
  | 'relay' // 릴레이 X
  | 'mc' // 전자접촉기 MC 보조접점
  | 'timer' // 타이머 T 한시접점
  | 'counter' // 카운터 C 접점
  | 'thr' // 열동계전기 THR 접점

export type CoilDevice =
  | 'relay' // 릴레이 X
  | 'mc' // 전자접촉기 MC
  | 'timer' // ON 딜레이 타이머
  | 'counter' // 카운터 계수 입력
  | 'counterReset' // 카운터 리셋 입력

export type LampColor = 'RL' | 'GL' | 'YL' | 'WL'

interface Base {
  id: string
  /** 기준점(첫 번째 핀)의 격자 좌표 */
  x: number
  y: number
  rot: Rotation
}

/** 모선: 기준점에서 오른쪽(회전 0°)으로 length 칸 뻗은 전원선 */
export interface BusComp extends Base {
  kind: 'bus'
  phase: Phase
  length: number
}

/** a접점(평상시 열림) / b접점(평상시 닫힘) */
export interface ContactComp extends Base {
  kind: 'contact'
  device: ContactDevice
  type: 'a' | 'b'
  tag: string
}

export interface CoilComp extends Base {
  kind: 'coil'
  device: CoilDevice
  tag: string
  /** 타이머: 설정 시간(ms), 카운터: 설정 횟수. 그 외에는 무시 */
  preset?: number
}

export interface LampComp extends Base {
  kind: 'lamp'
  color: LampColor
  tag: string
}

export interface BuzzerComp extends Base {
  kind: 'buzzer'
  tag: string
}

/** 배선용 차단기 (3극, 수동 ON/OFF) */
export interface MccbComp extends Base {
  kind: 'mccb'
  tag: string
}

/** 전자접촉기 주접점 (3극, 같은 tag의 MC 코일로 동작) */
export interface McMainComp extends Base {
  kind: 'mcMain'
  tag: string
}

/** 열동계전기 히터 (3극, 항상 도통). 과부하·결상이 tripTime(ms) 지속되면 트립 */
export interface ThrHeaterComp extends Base {
  kind: 'thrHeater'
  tag: string
  tripTime: number
}

/** 3상 유도전동기 (U·V·W 단자) */
export interface MotorComp extends Base {
  kind: 'motor'
  tag: string
  /** 과부하 모의: 켜면 운전 중 THR 히터가 가열된다 */
  overload?: boolean
}

export type Component =
  | BusComp
  | ContactComp
  | CoilComp
  | LampComp
  | BuzzerComp
  | MccbComp
  | McMainComp
  | ThrHeaterComp
  | MotorComp

export type ComponentKind = Component['kind']

/** 배선: 격자점을 잇는 직교 폴리라인 */
export interface Wire {
  id: string
  points: Point[]
}

/** 고장진단 모드에서 교사가 심는 고장 */
export type Fault =
  | { kind: 'wireOpen'; wireId: string } // 단선
  | { kind: 'contactOpen'; compId: string } // 접점 접촉 불량 (닫혀야 할 때도 열림)
  | { kind: 'contactWelded'; compId: string } // 접점 융착 (항상 닫힘)
  | { kind: 'coilBurnt'; compId: string } // 코일 소손 (여자되지 않음)

export interface Circuit {
  version: number
  name: string
  components: Component[]
  wires: Wire[]
  faults?: Fault[]
}

export function emptyCircuit(name = '새 회로'): Circuit {
  return { version: CIRCUIT_VERSION, name, components: [], wires: [] }
}
