// 내장 예제 회로 목록 (파일 메뉴 → 예제 회로)
// 교재 순서: 기초 조작회로 → 전동기 주회로 → 종합 예제
import type { Circuit } from '../engine'
import { counterCircuit, interlockCircuit, selfHoldCircuit, timerCircuit } from './basic'
import { motorReversingCircuit, motorStartStopCircuit } from './motor'
import { showcaseCircuit } from './showcase'

export interface Example {
  key: string
  title: string
  /** 무엇을 배우는 회로인가 */
  summary: string
  /** 실행 모드에서 해 볼 조작 (예제를 열면 알림으로 보여 준다) */
  howTo: string
  make: () => Circuit
}

export const EXAMPLES: Example[] = [
  {
    key: 'selfHold',
    title: '자기유지 회로',
    summary: '기동 버튼에서 손을 떼도 릴레이가 자기 a접점으로 동작을 유지한다',
    howTo: 'PB1을 눌렀다 떼면 X가 자기유지되어 RL이 켜집니다. PB0을 누르면 풀립니다',
    make: selfHoldCircuit,
  },
  {
    key: 'interlock',
    title: '인터록 회로',
    summary: '먼저 동작한 쪽이 상대 릴레이를 b접점으로 막는다 (선입력 우선)',
    howTo: 'PB1로 X1을 켠 뒤 PB2를 눌러 보세요. X2는 동작하지 않습니다. PB0으로 정지',
    make: interlockCircuit,
  },
  {
    key: 'timer',
    title: '타이머 회로',
    summary: '타이머 코일이 여자되고 설정 시간(3초)이 지나면 한시 접점이 전환된다',
    howTo: 'PB1을 누르면 RL·YL이 켜지고, 3초 뒤 GL이 켜지며 YL이 꺼집니다',
    make: timerCircuit,
  },
  {
    key: 'counter',
    title: '카운터 회로',
    summary: '계수 입력이 들어올 때마다 1씩 세고, 설정값(3)에 도달하면 접점이 전환된다',
    howTo: 'PB1을 세 번 누르면 RL이 켜집니다. PB2를 누르면 0으로 돌아갑니다',
    make: counterCircuit,
  },
  {
    key: 'motorStartStop',
    title: '전동기 기동·정지',
    summary: '주회로(MCCB·MC·THR·M)와 조작회로를 함께. THR이 트립하면 정지하고 YL이 켜진다',
    howTo: 'MCCB를 톡 쳐서 켜고 PB1로 기동, PB0으로 정지. THR을 톡 치면 과부하 트립',
    make: motorStartStopCircuit,
  },
  {
    key: 'motorReversing',
    title: '전동기 정·역 운전',
    summary: '두 상을 바꿔 연결해 회전 방향을 바꾼다. MC1·MC2 인터록으로 단락을 막는다',
    howTo: 'MCCB를 켜고 PB1은 정회전, PB2는 역회전. 방향을 바꾸려면 PB0으로 먼저 정지',
    make: motorReversingCircuit,
  },
  {
    key: 'showcase',
    title: '전동기 자동·수동 운전',
    summary: '셀렉터로 자동(플로트레스 수위)·수동(타이머) 운전을 고르고, EOCR 경보(FR)까지',
    howTo: 'MCCB를 켜고 PB1로 수동 운전. SS를 톡 쳐서 자동으로 바꾼 뒤 FLS로 수위 감지',
    make: showcaseCircuit,
  },
]
