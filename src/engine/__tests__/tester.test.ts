import { describe, expect, it } from 'vitest'
import { faultKindsFor, faultLabel, matchFault, randomFaults, wireLabel } from '../diagnosis'
import { pinsOf } from '../geometry'
import type { Circuit, Component, Fault } from '../model'
import { Simulator } from '../scan'
import { measureResistance, measureVoltage, probeNode } from '../tester'
import { BOTTOM, controlBoard, selfHoldRung, TOP } from './helpers'

/** 자기유지: PB0(b) → PB1(a) ∥ X-a → X,  X-a → RL */
function board(faults: (ids: { holdId: string; coilId: string; lampWire: string }) => Fault[] = () => []) {
  const b = controlBoard()
  const { holdId, coilId } = selfHoldRung(b, 2, { start: 'PB1', stop: 'PB0', coil: 'X' })
  b.contact(10, 1, 'relay', 'a', 'X')
  b.wire([10, TOP], [10, 1])
  const lampWire = b.wire([10, 4], [10, 8])
  b.lamp(10, 8, 'RL')
  b.wire([10, 11], [10, BOTTOM])
  const c = b.build()
  c.faults = faults({ holdId, coilId, lampWire })
  return c
}

function tester(c: Circuit) {
  const sim = new Simulator(c)
  const pin = (comp: Component, name: string) => {
    const p = pinsOf(comp).find((x) => x.name === name)!
    return probeNode(c, sim.graph, p)
  }
  const find = (pred: (k: Component) => boolean) => c.components.find(pred)!
  const volt = (x: number | null, y: number | null) => measureVoltage(c, sim.graph, sim.last.solution, x, y).text
  const ohm = (x: number | null, y: number | null) => measureResistance(c, sim.graph, sim.last.solution, x, y).result
  return { sim, pin, find, volt, ohm }
}

const isTag = (tag: string, kind: string, type?: string) => (k: Component) =>
  k.kind === kind && 'tag' in k && k.tag === tag && (type === undefined || (k.kind === 'contact' && k.type === type))

describe('테스터', () => {
  it('열린 접점 양단은 220 V (아래쪽은 코일을 거쳐 N 전위), 닫힌 접점 양단은 0 V', () => {
    const t = tester(board())
    const pb1 = t.find(isTag('PB1', 'contact'))
    const pb0 = t.find(isTag('PB0', 'contact'))
    expect(t.volt(t.pin(pb1, '1'), t.pin(pb1, '2'))).toBe('220 V')
    expect(t.volt(t.pin(pb0, '1'), t.pin(pb0, '2'))).toBe('0 V')
  })

  it('코일이 소손되면 코일 양단에 220 V가 걸려도 동작하지 않고, 도통을 재면 끊김', () => {
    const c = board(({ coilId }) => [{ kind: 'coilBurnt', compId: coilId }])
    const t = tester(c)
    t.sim.act({ type: 'press', tag: 'PB1' })
    const coil = t.find(isTag('X', 'coil'))
    expect(t.sim.state.coils.X).toBe(false)
    expect(t.volt(t.pin(coil, '1'), t.pin(coil, '2'))).toBe('220 V')
    // 전원이 있으면 도통 측정을 막는다
    expect(t.ohm(t.pin(coil, '1'), t.pin(coil, '2'))).toBe('live')
    const off = tester({ ...c, components: c.components.filter((k) => k.kind !== 'bus') })
    const coil2 = off.find(isTag('X', 'coil'))
    expect(off.ohm(off.pin(coil2, '1'), off.pin(coil2, '2'))).toBe('open')
  })

  it('전원을 끄면 도통: 닫힌 접점 0 Ω, 열린 접점 ∞, 코일·램프는 저항 있음', () => {
    const c = board()
    const off = tester({ ...c, components: c.components.filter((k) => k.kind !== 'bus') })
    const pb0 = off.find(isTag('PB0', 'contact'))
    const pb1 = off.find(isTag('PB1', 'contact'))
    const rl = off.find(isTag('RL', 'lamp'))
    expect(off.ohm(off.pin(pb0, '1'), off.pin(pb0, '2'))).toBe('zero')
    expect(off.ohm(off.pin(pb1, '1'), off.pin(pb1, '2'))).toBe('open')
    expect(off.ohm(off.pin(rl, '1'), off.pin(rl, '2'))).toBe('load')
  })

  it('접점 접촉 불량: 자기유지 접점이 붙어 보여도 양단에 220 V, 단선: 배선 양 끝 사이 220 V', () => {
    const c = board(({ holdId, lampWire }) => [
      { kind: 'contactOpen', compId: holdId },
      { kind: 'wireOpen', wireId: lampWire },
    ])
    const t = tester(c)
    t.sim.act({ type: 'press', tag: 'PB1' })
    t.sim.act({ type: 'release', tag: 'PB1' })
    expect(t.sim.state.coils.X).toBe(false)
    t.sim.act({ type: 'press', tag: 'PB1' })
    // PB1을 누르고 있는 동안: X 여자, 램프 쪽 배선은 끊겨 RL이 켜지지 않는다
    expect(t.sim.state.coils.X).toBe(true)
    const xa = c.components.find((k) => k.kind === 'contact' && k.tag === 'X' && k.x === 10)!
    const rl = t.find(isTag('RL', 'lamp'))
    expect(t.volt(t.pin(xa, '2'), t.pin(rl, '1'))).toBe('220 V')
    t.sim.act({ type: 'release', tag: 'PB1' })
    const hold = t.find((k) => k.kind === 'contact' && k.tag === 'X' && k.x === 4)
    t.sim.act({ type: 'press', tag: 'PB1' })
    expect(t.volt(t.pin(hold, '1'), t.pin(hold, '2'))).toBe('0 V') // PB1이 눌려 있어 양단이 같은 전위
  })
})

describe('고장 이름·지목·무작위', () => {
  it('고장 이름과 심을 수 있는 종류', () => {
    const c = board(({ holdId, lampWire }) => [
      { kind: 'contactOpen', compId: holdId },
      { kind: 'wireOpen', wireId: lampWire },
    ])
    expect(faultLabel(c, c.faults![0]!)).toBe('X a접점 접촉 불량')
    expect(wireLabel(c, c.faults![1]!.kind === 'wireOpen' ? c.faults![1]!.wireId : '')).toBe('배선 (X a접점 ↔ RL)')
    const coil = c.components.find((k) => k.kind === 'coil')!
    expect(faultKindsFor(c, coil.id)).toEqual(['coilBurnt'])
    expect(faultKindsFor(c, c.wires[0]!.id)).toEqual(['wireOpen'])
  })

  it('지목한 대상과 종류가 맞아야 정답', () => {
    const c = board(({ holdId }) => [{ kind: 'contactOpen', compId: holdId }])
    const holdId = (c.faults![0] as { compId: string }).compId
    expect(matchFault(c, holdId, 'contactOpen')).not.toBeNull()
    expect(matchFault(c, holdId, 'contactWelded')).toBeNull()
  })

  it('무작위 고장은 조작회로 부품·배선에서 겹치지 않게 고른다', () => {
    const c = board()
    let seed = 0.37
    const rand = () => (seed = (seed * 9301 + 0.49297) % 1)
    const fs = randomFaults(c, 3, rand)
    expect(fs).toHaveLength(3)
    const targets = fs.map((f) => (f.kind === 'wireOpen' ? f.wireId : f.compId))
    expect(new Set(targets).size).toBe(3)
  })
})
