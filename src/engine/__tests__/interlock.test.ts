import { describe, expect, it } from 'vitest'
import { Simulator } from '../scan'
import { bc, click, controlBoard, selfHoldRung } from './helpers'

/** 인터록 회로: X1 줄에 X2-b, X2 줄에 X1-b를 넣어 동시 동작을 막는다 */
function interlockCircuit() {
  const b = controlBoard()
  selfHoldRung(b, 2, { start: 'PB1', stop: 'PB0', coil: 'X1', before: [bc(b, 'relay', 'X2')] })
  selfHoldRung(b, 8, { start: 'PB2', stop: 'PB0', coil: 'X2', before: [bc(b, 'relay', 'X1')] })
  return b.build('인터록')
}

describe('인터록 회로', () => {
  it('X1이 동작 중이면 PB2를 눌러도 X2가 동작하지 않는다', () => {
    const sim = new Simulator(interlockCircuit())
    click(sim, 'PB1')
    expect(sim.state.coils.X1).toBe(true)
    sim.act({ type: 'press', tag: 'PB2' })
    expect(sim.state.coils.X2).toBe(false)
    expect(sim.state.coils.X1).toBe(true)
  })

  it('정지 후에는 반대쪽이 동작할 수 있다', () => {
    const sim = new Simulator(interlockCircuit())
    click(sim, 'PB1')
    click(sim, 'PB0')
    click(sim, 'PB2')
    expect(sim.state.coils.X1).toBe(false)
    expect(sim.state.coils.X2).toBe(true)
  })

  it('두 기동 버튼을 누르고 있으면 먼저 누른 쪽이 우선한다', () => {
    const sim = new Simulator(interlockCircuit())
    sim.act({ type: 'press', tag: 'PB1' })
    const r = sim.act({ type: 'press', tag: 'PB2' })
    expect(r.state.coils.X1).toBe(true)
    expect(r.state.coils.X2).toBe(false)
    expect(r.oscillating).toEqual([])
  })
})
