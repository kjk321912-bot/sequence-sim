// 기본 과제 목록 (과제 탭 → 과제 고르기)
// 정답 회로(예제)를 시나리오대로 돌려 기대 출력을 만들고, 학생에게는 모선·주회로만 남긴 시작 회로를 준다.
import { makeTask, partsSummary, starterCircuit, type Circuit, type ScriptItem } from '../engine'
import { counterCircuit, interlockCircuit, selfHoldCircuit, timerCircuit } from './basic'
import { EXAM_OPERATIONS } from './exam/operations'
import * as P from './exam/problems'
import { motorReversingCircuit, motorStartStopCircuit } from './motor'

export interface BuiltinTask {
  key: string
  group: string
  title: string
  /** 시작 회로 + 과제 */
  make: () => Circuit
}

/** 'click PB1', 'toggle SS', 'trip EOCR', 3000(기다림) 형식의 시나리오 */
function script(...items: (string | number)[]): ScriptItem[] {
  return items.map((it) => {
    if (typeof it === 'number') return { wait: it }
    const [verb, tag] = it.split(' ') as [ScriptItem extends { do: infer D } ? D : never, string]
    return { do: verb, tag }
  })
}

function task(answer: () => Circuit, title: string, description: string, items: (string | number)[]): () => Circuit {
  return () => {
    const a = answer()
    const t = makeTask(a, { title, description: `${description}\n\n${partsSummary(a)}` }, script(...items))
    return { ...starterCircuit(a), name: `과제: ${title}`, task: t }
  }
}

const BASIC: BuiltinTask[] = [
  {
    key: 'selfHold',
    group: '기초 회로',
    title: '자기유지 회로',
    make: task(
      selfHoldCircuit,
      '자기유지 회로',
      '(1) PB1을 누르면 릴레이 X가 여자되고, PB1에서 손을 떼도 X의 a접점으로 동작을 유지한다.\n(2) X가 여자되면 RL이 점등되고 GL이 소등된다.\n(3) PB0을 누르면 X가 소자되어 RL이 소등되고 GL이 점등된다.',
      ['click PB1', 'click PB0'],
    ),
  },
  {
    key: 'interlock',
    group: '기초 회로',
    title: '인터록 회로',
    make: task(
      interlockCircuit,
      '인터록 회로 (선입력 우선)',
      '(1) PB1을 누르면 X1이 자기유지되고 RL이 점등된다. 이때 PB2를 눌러도 X2는 동작하지 않는다.\n(2) PB2를 먼저 누르면 X2가 자기유지되고 GL이 점등된다. 이때 PB1을 눌러도 X1은 동작하지 않는다.\n(3) PB0을 누르면 모두 정지한다.',
      ['click PB1', 'click PB2', 'click PB0', 'click PB2', 'click PB1', 'click PB0'],
    ),
  },
  {
    key: 'timer',
    group: '기초 회로',
    title: '타이머 회로',
    make: task(
      timerCircuit,
      '타이머 회로 (ON 딜레이)',
      '(1) PB1을 누르면 릴레이 X가 자기유지되고 타이머 T가 여자되며, RL과 YL이 점등된다.\n(2) T의 설정시간 후 GL이 점등되고 YL이 소등된다.\n(3) PB0을 누르면 모두 정지한다.',
      ['click PB1', 3000, 'click PB0'],
    ),
  },
  {
    key: 'counter',
    group: '기초 회로',
    title: '카운터 회로',
    make: task(
      counterCircuit,
      '카운터 회로',
      '(1) 처음에는 GL이 점등되어 있다.\n(2) PB1을 누를 때마다 카운터 C가 1씩 세고, 설정값에 도달하면 RL이 점등되고 GL이 소등된다.\n(3) PB2를 누르면 카운터가 0으로 돌아가 처음 상태가 된다.',
      ['click PB1', 'click PB1', 'click PB1', 'click PB2'],
    ),
  },
  {
    key: 'motorStartStop',
    group: '전동기 회로',
    title: '전동기 기동·정지',
    make: task(
      motorStartStopCircuit,
      '전동기 기동·정지 (주회로는 그려져 있음)',
      '(1) MCCB를 넣으면 MCCB 2차측에서 퓨즈 F1·F2를 거쳐 조작 전원이 공급되고 GL이 점등된다.\n(2) PB1을 누르면 MC가 자기유지되어 전동기 M이 회전하고 RL 점등, GL 소등.\n(3) PB0을 누르면 정지한다.\n(4) 열동계전기 THR이 트립하면 전동기가 정지하고 YL이 점등된다. 리셋하면 처음 상태가 된다.',
      ['toggle MCCB', 'click PB1', 'click PB0', 'click PB1', 'trip THR', 'reset THR'],
    ),
  },
  {
    key: 'motorReversing',
    group: '전동기 회로',
    title: '전동기 정·역 운전',
    make: task(
      motorReversingCircuit,
      '전동기 정·역 운전 (주회로는 그려져 있음)',
      '(1) MCCB를 넣고 PB1을 누르면 MC1이 자기유지되어 전동기가 정회전하고 RL이 점등된다.\n(2) PB2를 누르면 MC2가 자기유지되어 전동기가 역회전하고 GL이 점등된다.\n(3) 한쪽이 운전 중일 때 반대쪽 버튼을 눌러도 동작하지 않는다 (인터록).\n(4) PB0을 누르면 정지한다.',
      ['toggle MCCB', 'click PB1', 'click PB2', 'click PB0', 'click PB2', 'click PB1', 'click PB0'],
    ),
  },
]

/** 공개문제 시나리오 (문제지 동작 사항의 자동·수동·EOCR 동작을 차례로) */
const EXAM_SCRIPTS: (string | number)[][] = [
  ['toggle MCCB', 'toggle SS', 'toggle FLS', 1000, 'toggle FLS', 'toggle SS', 'click PB1', 3000, 'click PB0', 'click PB1', 'trip EOCR', 1000, 1000, 'reset EOCR'],
  ['toggle MCCB', 'click PB1', 3000, 2000, 2000, 'click PB0', 'toggle SS', 'toggle FLS', 3000, 2000, 'toggle SS', 'toggle FLS', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle SS', 'toggle FLS', 2000, 2000, 'toggle FLS', 'toggle SS', 'click PB1', 3000, 2000, 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle SS', 'toggle FLS', 4000, 2000, 2000, 'toggle FLS', 'toggle SS', 'click PB1', 4000, 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle SS', 'toggle FLS', 2000, 1000, 'toggle FLS', 'toggle SS', 'click PB1', 3000, 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle SS', 'toggle FLS', 1000, 'toggle FLS', 'toggle SS', 'click PB1', 3000, 2000, 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle SS', 'toggle FLS', 2000, 2000, 4000, 'toggle FLS', 'toggle SS', 'click PB1', 2000, 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle SS', 'toggle FLS', 1000, 1000, 'toggle FLS', 'toggle SS', 'click PB1', 3000, 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle SS', 'toggle FLS', 1000, 'toggle FLS', 'toggle SS', 'click PB1', 3000, 'click PB0', 'trip EOCR', 1000, 'reset EOCR'],
  ['toggle MCCB', 'click PB1', 'toggle LS1', 3000, 'toggle LS1', 'click PB2', 'toggle LS2', 3000, 'toggle LS2', 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'click PB1', 'press PB1', 3000, 'release PB1', 'toggle LS1', 'toggle LS1', 'press PB2', 3000, 'release PB2', 'toggle LS2', 'toggle LS2', 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'click PB1', 'toggle LS1', 'toggle LS1', 3000, 'click PB0', 'click PB2', 'toggle LS2', 3000, 'toggle LS1', 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle LS1', 'toggle LS1', 'toggle LS2', 'toggle LS2', 3000, 3000, 'click PB0', 'click PB2', 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle LS1', 'click PB1', 'toggle LS2', 'click PB1', 3000, 'toggle LS2', 'click PB2', 'toggle LS1', 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle LS1', 'click PB1', 'toggle LS1', 3000, 'toggle LS1', 'click PB2', 'toggle LS2', 'click PB2', 3000, 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle LS1', 3000, 'toggle LS1', 'toggle LS1', 'toggle LS2', 3000, 'toggle LS2', 'click PB0', 'toggle LS1', 'click PB2', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle LS1', 'click PB1', 'click PB2', 3000, 'click PB2', 3000, 'toggle LS2', 'click PB0', 'trip EOCR', 'reset EOCR'],
  ['toggle MCCB', 'toggle LS1', 'click PB1', 3000, 'toggle LS2', 'click PB0', 'toggle LS1', 'click PB2', 3000, 'click PB0', 'trip EOCR', 'reset EOCR'],
]

const EXAM_MAKERS = [
  P.exam01, P.exam02, P.exam03, P.exam04, P.exam05, P.exam06, P.exam07, P.exam08, P.exam09,
  P.exam10, P.exam11, P.exam12, P.exam13, P.exam14, P.exam15, P.exam16, P.exam17, P.exam18,
]

const EXAM: BuiltinTask[] = EXAM_MAKERS.map((answer, i) => {
  const title = `공개문제 ${i + 1}번`
  return {
    key: `exam${String(i + 1).padStart(2, '0')}`,
    group: '전기기능사 공개문제 (주회로는 그려져 있음)',
    title,
    make: task(answer, title, EXAM_OPERATIONS[i]!, EXAM_SCRIPTS[i]!),
  }
})

export const BUILTIN_TASKS: BuiltinTask[] = [...BASIC, ...EXAM]
