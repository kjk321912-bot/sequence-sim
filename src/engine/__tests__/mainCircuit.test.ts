import { describe, expect, it } from 'vitest'
import { CircuitBuilder } from '../builder'
import { Simulator } from '../scan'
import { bc, click, selfHoldRung } from './helpers'

/**
 * 3상 유도전동기 운전 회로
 *   주회로: R·S·T 모선 → MCCB → MC1 주접점 → THR1 히터 → 모터 M1
 *   조작회로: P모선 → THR1-b → PB0(정지) → PB1(기동) ∥ MC1-a → MC1 코일 → N모선
 */
function motorCircuit(opts: { swapRT?: boolean; overload?: boolean } = {}) {
  const b = new CircuitBuilder()
  b.bus('R', 0, 0, 12)
  b.bus('S', 0, 1, 12)
  b.bus('T', 0, 2, 12)
  const mccb = b.add({ kind: 'mccb', x: 2, y: 4, tag: 'MCCB' })
  // 모선에서 MCCB 1차측까지. 교차하는 모선과는 꼭짓점이 없으므로 연결되지 않는다.
  const wires = opts.swapRT
    ? { L1: b.wire([2, 2], [2, 4]), L2: b.wire([4, 1], [4, 4]), L3: b.wire([6, 0], [6, 4]) }
    : { L1: b.wire([2, 0], [2, 4]), L2: b.wire([4, 1], [4, 4]), L3: b.wire([6, 2], [6, 4]) }
  b.add({ kind: 'mcMain', x: 2, y: 7, tag: 'MC1' })
  b.add({ kind: 'thrHeater', x: 2, y: 10, tag: 'THR1', tripTime: 5000 })
  const motor = b.add({ kind: 'motor', x: 2, y: 13, tag: 'M1', ...(opts.overload ? { overload: true } : {}) })

  b.bus('P', 20, 0, 20)
  b.bus('N', 20, 24, 20)
  selfHoldRung(b, 22, { start: 'PB1', stop: 'PB0', coil: 'MC1', coilDevice: 'mc', before: [bc(b, 'thr', 'THR1')] })
  return { b, mccb, motor, wires }
}

function start(sim: Simulator) {
  sim.act({ type: 'toggle', tag: 'MCCB' })
  return click(sim, 'PB1')
}

describe('3상 주회로', () => {
  it('MCCB가 꺼져 있으면 MC가 동작해도 모터는 돌지 않는다', () => {
    const { b, motor } = motorCircuit()
    const sim = new Simulator(b.build())
    const r = click(sim, 'PB1')
    expect(r.state.coils.MC1).toBe(true)
    expect(r.solution.motors[motor]).toBe('stop')
  })

  it('R-S-T 순서로 연결하면 정회전', () => {
    const { b, motor } = motorCircuit()
    const sim = new Simulator(b.build())
    const r = start(sim)
    expect(r.solution.motors[motor]).toBe('fwd')
    expect(r.solution.shorts).toEqual([])
  })

  it('두 상(R, T)을 바꿔 연결하면 역회전', () => {
    const { b, motor } = motorCircuit({ swapRT: true })
    const sim = new Simulator(b.build())
    expect(start(sim).solution.motors[motor]).toBe('rev')
  })

  it('주회로 배선에 전류 흐름이 표시된다', () => {
    const { b, wires } = motorCircuit()
    const sim = new Simulator(b.build())
    const r = start(sim)
    const seg = r.solution.segments.find((s) => s.wireId === wires.L1)!
    expect(seg.state).toBe('flow')
    expect(seg.potential).toBe('R')
  })

  it('정지 버튼을 누르면 모터가 멈춘다', () => {
    const { b, motor } = motorCircuit()
    const sim = new Simulator(b.build())
    start(sim)
    expect(click(sim, 'PB0').solution.motors[motor]).toBe('stop')
  })

  it('THR 트립 버튼(고장 모의)을 누르면 b접점이 열려 MC가 떨어지고, 리셋 전에는 재기동되지 않는다', () => {
    const { b, motor } = motorCircuit()
    const sim = new Simulator(b.build())
    start(sim)
    let r = sim.act({ type: 'thrTrip', tag: 'THR1' })
    expect(r.state.coils.MC1).toBe(false)
    expect(r.solution.motors[motor]).toBe('stop')
    r = click(sim, 'PB1')
    expect(r.state.coils.MC1).toBe(false)
    sim.act({ type: 'thrReset', tag: 'THR1' })
    r = click(sim, 'PB1')
    expect(r.solution.motors[motor]).toBe('fwd')
  })

  it('과부하 운전이 설정 시간 동안 계속되면 THR이 트립해 모터가 멈춘다', () => {
    const { b, motor } = motorCircuit({ overload: true })
    const sim = new Simulator(b.build())
    start(sim)
    expect(sim.run(4900).solution.motors[motor]).toBe('fwd')
    sim.run(200)
    expect(sim.state.thr.THR1!.tripped).toBe(true)
    expect(sim.run(10).solution.motors[motor]).toBe('stop')
  })

  it('한 상이 끊어지면 결상으로 판정하고, 설정 시간 뒤 THR이 트립한다', () => {
    const { b, motor, wires } = motorCircuit()
    b.fault({ kind: 'wireOpen', wireId: wires.L3 })
    const sim = new Simulator(b.build())
    expect(start(sim).solution.motors[motor]).toBe('singlePhase')
    sim.run(5100)
    expect(sim.state.thr.THR1!.tripped).toBe(true)
    expect(sim.last.solution.motors[motor]).toBe('stop')
  })

  it('서로 다른 상이 이어지면 선간 단락', () => {
    const { b } = motorCircuit()
    // R모선 ─ PB9 ─ S모선
    b.contact(10, 3, 'pb', 'a', 'PB9')
    b.wire([10, 0], [10, 3])
    b.wire([10, 6], [11, 6], [11, 1])
    const sim = new Simulator(b.build())
    expect(sim.act({ type: 'press', tag: 'PB9' }).solution.shorts).toEqual([['R', 'S']])
  })

  it('조작회로 전원을 주회로 R-T에서 따와도 부하가 동작한다', () => {
    const b = new CircuitBuilder()
    b.bus('R', 0, 0, 12)
    b.bus('S', 0, 1, 12)
    b.bus('T', 0, 2, 12)
    const lamp = b.lamp(8, 4, 'WL')
    b.wire([8, 0], [8, 4])
    b.wire([8, 7], [9, 7], [9, 2])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[lamp]).toBe(true)
  })

  it('P모선과 R상 사이의 부하는 동작하지 않는다 (계통이 다름)', () => {
    const b = new CircuitBuilder()
    b.bus('R', 0, 0, 12)
    b.bus('P', 0, 20, 12)
    const lamp = b.lamp(4, 5, 'RL')
    b.wire([4, 0], [4, 5])
    b.wire([4, 8], [4, 20])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[lamp]).toBe(false)
  })
})
