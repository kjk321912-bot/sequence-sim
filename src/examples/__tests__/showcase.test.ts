import { describe, expect, it } from 'vitest'
import { Simulator, type Circuit } from '../../engine'
import { showcaseCircuit } from '../showcase'

const idOf = (c: Circuit, kind: string, tag: string) => c.components.find((k) => k.kind === kind && 'tag' in k && k.tag === tag)!.id

function setup() {
  const circuit = showcaseCircuit()
  const sim = new Simulator(circuit)
  const lamp = (tag: string) => sim.last.solution.energized[idOf(circuit, 'lamp', tag)]
  const motor = () => sim.last.solution.motors[idOf(circuit, 'motor', 'M1')]
  return { circuit, sim, lamp, motor }
}

describe('첫 화면 예제 회로', () => {
  it('단락·발진 없이 시작하고, MCCB를 넣기 전에는 조작 전원이 없다', () => {
    const { sim, lamp } = setup()
    expect(sim.last.solution.shorts).toEqual([])
    expect(sim.last.oscillating).toEqual([])
    expect(lamp('WL')).toBe(false)
  })

  it('MCCB를 넣으면 정지 표시등(WL)이 켜진다', () => {
    const { sim, lamp } = setup()
    sim.act({ type: 'toggle', tag: 'MCCB' })
    expect(lamp('WL')).toBe(true)
    expect(lamp('RL')).toBe(false)
  })

  it('수동(M): PB1을 누르면 타이머 순시접점으로 MC1이 동작하고, 설정 시간 뒤 GL이 켜진다', () => {
    const { sim, lamp, motor } = setup()
    sim.act({ type: 'toggle', tag: 'MCCB' })
    sim.act({ type: 'press', tag: 'PB1' })
    sim.act({ type: 'release', tag: 'PB1' })
    expect(motor()).toBe('fwd')
    expect(lamp('RL')).toBe(true)
    expect(lamp('GL')).toBe(false)
    sim.run(3000)
    expect(lamp('GL')).toBe(true)
    sim.act({ type: 'press', tag: 'PB0' })
    expect(motor()).toBe('stop')
  })

  it('자동(A): 수위를 감지하면 릴레이 X를 거쳐 MC1이 동작한다', () => {
    const { sim, motor } = setup()
    sim.act({ type: 'toggle', tag: 'MCCB' })
    sim.act({ type: 'toggle', tag: 'SS' })
    expect(motor()).toBe('stop')
    sim.act({ type: 'toggle', tag: 'FLS' })
    expect(sim.state.coils.X).toBe(true)
    expect(motor()).toBe('fwd')
  })

  it('EOCR이 트립하면 전동기가 멈추고 YL과 BZ가 번갈아 동작한다', () => {
    const { sim, lamp, motor, circuit } = setup()
    sim.act({ type: 'toggle', tag: 'MCCB' })
    sim.act({ type: 'press', tag: 'PB1' })
    sim.act({ type: 'thrTrip', tag: 'EOCR' })
    expect(motor()).toBe('stop')
    const bz = () => sim.last.solution.energized[idOf(circuit, 'buzzer', 'BZ')]
    expect([lamp('YL'), bz()]).toEqual([true, false])
    sim.run(1000)
    expect([lamp('YL'), bz()]).toEqual([false, true])
  })
})
