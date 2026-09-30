import { describe, expect, it } from 'vitest'
import { parseCircuit, Simulator, stringifyCircuit, type Circuit } from '../../engine'
import { EXAMPLES } from '../index'

const byKey = (key: string) => EXAMPLES.find((e) => e.key === key)!.make()
const idOf = (c: Circuit, kind: string, tag: string) => c.components.find((k) => k.kind === kind && 'tag' in k && k.tag === tag)!.id

function setup(key: string) {
  const circuit = byKey(key)
  const sim = new Simulator(circuit)
  const lamp = (tag: string) => !!sim.last.solution.energized[idOf(circuit, 'lamp', tag)]
  const motor = () => sim.last.solution.motors[idOf(circuit, 'motor', 'M')]
  const click = (tag: string) => {
    sim.act({ type: 'press', tag })
    return sim.act({ type: 'release', tag })
  }
  return { circuit, sim, lamp, motor, click }
}

describe('내장 예제 공통', () => {
  it.each(EXAMPLES.map((e) => [e.title, e] as const))('%s: 단락·발진·직렬 경고 없이 시작하고 파일로 저장·불러오기 된다', (_, e) => {
    const circuit = e.make()
    const sim = new Simulator(circuit)
    expect(sim.last.solution.shorts).toEqual([])
    expect(sim.last.oscillating).toEqual([])
    expect(sim.last.solution.seriesLoads).toEqual([])
    const back = parseCircuit(stringifyCircuit(circuit))
    expect(back.ok).toBe(true)
  })

  it('키가 겹치지 않는다', () => {
    expect(new Set(EXAMPLES.map((e) => e.key)).size).toBe(EXAMPLES.length)
  })
})

describe('자기유지 회로', () => {
  it('PB1로 자기유지, PB0으로 해제', () => {
    const { lamp, click } = setup('selfHold')
    expect([lamp('RL'), lamp('GL')]).toEqual([false, true])
    click('PB1')
    expect([lamp('RL'), lamp('GL')]).toEqual([true, false])
    click('PB0')
    expect([lamp('RL'), lamp('GL')]).toEqual([false, true])
  })
})

describe('인터록 회로', () => {
  it('먼저 동작한 쪽이 우선하고, PB0으로 둘 다 정지', () => {
    const { lamp, click, sim } = setup('interlock')
    click('PB1')
    click('PB2')
    expect([lamp('RL'), lamp('GL')]).toEqual([true, false])
    click('PB0')
    expect(sim.state.coils.X1).toBe(false)
    click('PB2')
    click('PB1')
    expect([lamp('RL'), lamp('GL')]).toEqual([false, true])
  })
})

describe('타이머 회로', () => {
  it('3초 뒤 GL이 켜지고 YL이 꺼진다', () => {
    const { lamp, click, sim } = setup('timer')
    click('PB1')
    expect([lamp('RL'), lamp('YL'), lamp('GL')]).toEqual([true, true, false])
    sim.run(2900)
    expect(lamp('GL')).toBe(false)
    sim.run(200)
    expect([lamp('RL'), lamp('YL'), lamp('GL')]).toEqual([true, false, true])
    click('PB0')
    expect([lamp('RL'), lamp('YL'), lamp('GL')]).toEqual([false, false, false])
  })
})

describe('카운터 회로', () => {
  it('세 번째에 RL이 켜지고 리셋하면 돌아온다', () => {
    const { lamp, click } = setup('counter')
    click('PB1')
    click('PB1')
    expect([lamp('RL'), lamp('GL')]).toEqual([false, true])
    click('PB1')
    expect([lamp('RL'), lamp('GL')]).toEqual([true, false])
    click('PB2')
    expect([lamp('RL'), lamp('GL')]).toEqual([false, true])
  })
})

describe('전동기 기동·정지', () => {
  it('MCCB를 켜야 조작 전원이 들어오고, PB1로 정회전·PB0으로 정지', () => {
    const { lamp, click, motor, sim } = setup('motorStartStop')
    click('PB1')
    expect(motor()).toBe('stop')
    expect(lamp('GL')).toBe(false)
    sim.act({ type: 'toggle', tag: 'MCCB' })
    expect([lamp('RL'), lamp('GL'), lamp('YL')]).toEqual([false, true, false])
    click('PB1')
    expect(motor()).toBe('fwd')
    expect([lamp('RL'), lamp('GL')]).toEqual([true, false])
    click('PB0')
    expect(motor()).toBe('stop')
  })

  it('THR이 트립하면 정지하고 YL이 켜진다', () => {
    const { lamp, click, motor, sim } = setup('motorStartStop')
    sim.act({ type: 'toggle', tag: 'MCCB' })
    click('PB1')
    sim.act({ type: 'thrTrip', tag: 'THR' })
    expect(motor()).toBe('stop')
    expect(lamp('YL')).toBe(true)
    sim.act({ type: 'thrReset', tag: 'THR' })
    expect(lamp('YL')).toBe(false)
  })
})

describe('전동기 정·역 운전', () => {
  it('PB1은 정회전, PB2는 역회전, 운전 중 반대 버튼은 인터록으로 막힌다', () => {
    const { lamp, click, motor, sim } = setup('motorReversing')
    sim.act({ type: 'toggle', tag: 'MCCB' })
    click('PB1')
    expect(motor()).toBe('fwd')
    expect(lamp('RL')).toBe(true)
    click('PB2')
    expect(motor()).toBe('fwd')
    expect(sim.last.solution.shorts).toEqual([])
    click('PB0')
    click('PB2')
    expect(motor()).toBe('rev')
    expect([lamp('RL'), lamp('GL')]).toEqual([false, true])
  })

  it('두 MC가 함께 붙으면 L1–L3 선간 단락 (인터록이 필요한 이유)', () => {
    const { circuit } = setup('motorReversing')
    // 인터록 접점을 융착시켜 항상 닫히게 하면 두 MC가 함께 동작한다
    const interlocks = circuit.components.filter((c) => c.kind === 'contact' && c.device === 'mc' && c.type === 'b')
    const faulty = { ...circuit, faults: interlocks.map((c) => ({ kind: 'contactWelded' as const, compId: c.id })) }
    const sim = new Simulator(faulty)
    sim.act({ type: 'toggle', tag: 'MCCB' })
    sim.act({ type: 'press', tag: 'PB1' })
    const r = sim.act({ type: 'press', tag: 'PB2' })
    expect(r.solution.shorts.length).toBeGreaterThan(0)
  })
})
