import { describe, expect, it } from 'vitest'
import { CircuitBuilder } from '../builder'
import { missingPower } from '../hints'
import { Simulator } from '../scan'
import { a, BOTTOM, bc, controlBoard, TOP } from './helpers'

/** 주회로 R·T에서 MCCB → 퓨즈 F1을 거쳐 조작 전원을 따오는 회로: EOCR-b → PB1 → X */
function fedFromMccb() {
  const b = new CircuitBuilder()
  b.bus('R', 0, 0, 10)
  b.bus('S', 0, 1, 10)
  b.bus('T', 0, 2, 10)
  b.add({ kind: 'mccb', x: 2, y: 4, tag: 'MCCB' })
  b.wire([2, 0], [2, 4])
  b.wire([4, 1], [4, 4])
  b.wire([6, 2], [6, 4])
  // MCCB 2차 L1 → F1 → 위 제어선(y=20),  L3 → 아래 제어선(y=40)
  b.add({ kind: 'fuse', x: 2, y: 7, tag: 'F1' })
  b.wire([2, 10], [2, 20], [12, 20])
  b.wire([6, 7], [8, 7], [8, 40], [12, 40])
  b.add({ kind: 'thrHeater', relay: 'eocr', x: 20, y: 4, tag: 'EOCR', tripTime: 1000 }) // 트립 조작용
  const [, pb] = b.rung(12, 20, 40, [bc(b, 'eocr', 'EOCR'), a(b, 'pb', 'PB1'), (x, y) => b.coil(x, y, 'relay', 'X')])
  return { circuit: b.build(), pb: pb!.id }
}

describe('조작 전원 없음 안내', () => {
  it('MCCB가 꺼져 있으면 원인으로 알려 주고, 켜면 안내하지 않는다', () => {
    const { circuit, pb } = fedFromMccb()
    const sim = new Simulator(circuit)
    expect(missingPower(circuit, sim.graph, sim.last, pb)).toEqual([{ kind: 'mccbOff', tags: ['MCCB'] }])
    sim.act({ type: 'toggle', tag: 'MCCB' })
    expect(missingPower(circuit, sim.graph, sim.last, pb)).toEqual([])
  })

  it('보호계전기 트립으로 전원이 끊기면 리셋하라고 알려 준다', () => {
    const { circuit, pb } = fedFromMccb()
    const sim = new Simulator(circuit)
    sim.act({ type: 'toggle', tag: 'MCCB' })
    sim.act({ type: 'thrTrip', tag: 'EOCR' })
    expect(missingPower(circuit, sim.graph, sim.last, pb)).toEqual([{ kind: 'tripped', tags: ['EOCR'] }])
  })

  it('앞쪽 접점이 열려서 무전압인 것은 정상 동작이므로 안내하지 않는다', () => {
    const b = controlBoard()
    const [, pb] = b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB0'), a(b, 'pb', 'PB1'), (x, y) => b.coil(x, y, 'relay', 'X')])
    const circuit = b.build()
    const sim = new Simulator(circuit)
    // PB1은 열린 PB0 뒤라 무전압이지만, 전원 쪽(차단기·퓨즈·트립) 원인이 없다
    expect(missingPower(circuit, sim.graph, sim.last, pb!.id)).toEqual([])
  })

  it('전원 모선이 하나도 없으면 모선을 놓으라고 알려 준다', () => {
    const b = new CircuitBuilder()
    const pb = b.contact(2, 2, 'pb', 'a', 'PB1')
    const circuit = b.build()
    const sim = new Simulator(circuit)
    expect(missingPower(circuit, sim.graph, sim.last, pb)).toEqual([{ kind: 'noSource' }])
  })
})
