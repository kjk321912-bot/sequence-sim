// 고장진단 기본 문제: 예제 회로에 고장을 심고, 정상 동작과 증상을 알려 준다
import { pinsOf, type Circuit, type Component, type Fault } from '../engine'
import { counterCircuit, interlockCircuit, selfHoldCircuit, timerCircuit } from './basic'
import { EXAM_OPERATIONS } from './exam/operations'
import * as P from './exam/problems'
import { motorReversingCircuit, motorStartStopCircuit } from './motor'

export interface FaultProblem {
  key: string
  group: string
  title: string
  make: () => Circuit
}

type Finder = (c: Circuit) => Fault

/** 조건에 맞는 부품 (같은 조건이 여럿이면 x가 작은 것부터 n번째) */
function comp(c: Circuit, pred: (k: Component) => boolean, n = 0): Component {
  const found = c.components.filter(pred).sort((p, q) => p.x - q.x || p.y - q.y)[n]
  if (!found) throw new Error('고장 심을 부품을 찾지 못함')
  return found
}

const contact =
  (tag: string, device: string, type: 'a' | 'b', n = 0, fault: 'contactOpen' | 'contactWelded' = 'contactOpen'): Finder =>
  (c) => ({ kind: fault, compId: comp(c, (k) => k.kind === 'contact' && k.tag === tag && k.device === device && k.type === type, n).id })

const burnt =
  (tag: string): Finder =>
  (c) => ({ kind: 'coilBurnt', compId: comp(c, (k) => k.kind === 'coil' && k.tag === tag && k.device !== 'eocr').id })

/** 부품 단자(pin)에 끝이 닿은 배선 단선 */
const wireTo =
  (kind: Component['kind'], tag: string, pin = '1'): Finder =>
  (c) => {
    const k = comp(c, (x) => x.kind === kind && 'tag' in x && x.tag === tag)
    const p = pinsOf(k).find((q) => q.name === pin)!
    const w = c.wires.find((x) => [x.points[0]!, x.points[x.points.length - 1]!].some((q) => q.x === p.x && q.y === p.y))
    if (!w) throw new Error('고장 심을 배선을 찾지 못함')
    return { kind: 'wireOpen', wireId: w.id }
  }

function problem(answer: () => Circuit, title: string, normal: string, symptom: string, faults: Finder[]): () => Circuit {
  return () => {
    const c = answer()
    return {
      ...c,
      name: `고장진단: ${title}`,
      faults: faults.map((f) => f(c)),
      faultInfo: { title, description: `증상: ${symptom}\n\n정상 동작\n${normal}` },
    }
  }
}

const BASIC: FaultProblem[] = [
  {
    key: 'f-selfHold',
    group: '기초 회로',
    title: '자기유지 회로',
    make: problem(
      selfHoldCircuit,
      '자기유지 회로',
      '(1) PB1을 누르면 X가 여자되어 RL 점등, GL 소등. PB1에서 손을 떼도 X의 a접점으로 유지된다.\n(2) PB0을 누르면 X가 소자되어 RL 소등, GL 점등.',
      'PB1을 누르는 동안만 RL이 켜지고, 손을 떼면 꺼진다.',
      [contact('X', 'relay', 'a', 0)],
    ),
  },
  {
    key: 'f-interlock',
    group: '기초 회로',
    title: '인터록 회로',
    make: problem(
      interlockCircuit,
      '인터록 회로',
      '(1) PB1 → X1 자기유지, RL 점등. (2) PB2 → X2 자기유지, GL 점등. (3) 한쪽이 동작 중이면 다른 쪽은 동작하지 않는다. (4) PB0 → 정지.',
      'PB1 쪽은 정상인데, PB2를 눌러도 GL이 켜지지 않는다.',
      [burnt('X2')],
    ),
  },
  {
    key: 'f-timer',
    group: '기초 회로',
    title: '타이머 회로',
    make: problem(
      timerCircuit,
      '타이머 회로',
      '(1) PB1 → X 자기유지, T 여자, RL·YL 점등. (2) T 설정시간(3초) 후 GL 점등, YL 소등. (3) PB0 → 정지.',
      '3초가 지나 YL은 꺼지는데 GL이 켜지지 않는다.',
      [wireTo('lamp', 'GL', '2')],
    ),
  },
  {
    key: 'f-counter',
    group: '기초 회로',
    title: '카운터 회로',
    make: problem(
      counterCircuit,
      '카운터 회로',
      '(1) 처음에는 GL 점등. (2) PB1을 3번 누르면 RL 점등, GL 소등. (3) PB2 → 처음 상태.',
      '처음부터 RL이 켜져 있다.',
      [contact('C', 'counter', 'a', 0, 'contactWelded')],
    ),
  },
  {
    key: 'f-motorStartStop',
    group: '전동기 회로',
    title: '전동기 기동·정지',
    make: problem(
      motorStartStopCircuit,
      '전동기 기동·정지',
      '(1) MCCB를 넣으면 GL 점등. (2) PB1 → MC 자기유지, 전동기 회전, RL 점등. (3) PB0 → 정지. (4) THR 트립 → 정지, YL 점등.',
      'PB1을 누르고 있는 동안만 전동기가 돈다.',
      [contact('MC', 'mc', 'a', 0)],
    ),
  },
  {
    key: 'f-motorReversing',
    group: '전동기 회로',
    title: '전동기 정·역 운전',
    make: problem(
      motorReversingCircuit,
      '전동기 정·역 운전',
      '(1) MCCB를 넣고 PB1 → 정회전, RL. (2) PB2 → 역회전, GL. (3) 운전 중 반대쪽 버튼은 인터록으로 막힌다. (4) PB0 → 정지.',
      '정회전은 되는데, 정지 후 PB2를 눌러도 역회전하지 않는다.',
      [contact('MC1', 'mc', 'b', 0)],
    ),
  },
]

const EXAM: FaultProblem[] = (
  [
    [0, P.exam01, '수동 운전에서 T 설정시간이 지나도 M2가 돌지 않는다.', [contact('T', 'timer', 'a')]],
    [1, P.exam02, 'T 설정시간 후 RL·GL이 번갈아 켜지지 않는다 (전동기가 돌지 않음).', [burnt('FR')]],
    [9, P.exam10, 'PB1로 X1은 동작하는데, LS1을 감지시켜도 M1이 돌지 않는다.', [wireTo('coil', 'T1')]],
    [11, P.exam12, '고장이 2개 있습니다. PB1을 누르면 WL이 켜지지 않고, LS1을 감지시켜 M1이 돌 때 RL이 켜지지 않는다.', [
      contact('MC1', 'mc', 'b'),
      wireTo('lamp', 'RL'),
    ]],
  ] as const
).map(([i, answer, symptom, finders]) => ({
  key: `f-exam${i + 1}`,
  group: '전기기능사 공개문제',
  title: `공개문제 ${i + 1}번`,
  make: problem(answer, `공개문제 ${i + 1}번`, EXAM_OPERATIONS[i]!, symptom, [...finders]),
}))

export const FAULT_PROBLEMS: FaultProblem[] = [...BASIC, ...EXAM]
