import { describe, expect, it } from 'vitest'
import { Simulator } from '../scan'
import { a, bc, BOTTOM, click, controlBoard, selfHoldRung, TOP } from './helpers'

describe('단락', () => {
  it('부하 없이 P모선과 N모선이 이어지면 단락으로 판정하고 단락 경로를 표시한다', () => {
    const b = controlBoard()
    b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB1')])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.shorts).toEqual([])
    const r = sim.act({ type: 'press', tag: 'PB1' })
    expect(r.solution.shorts).toEqual([['N', 'P']])
    const segs = r.solution.segments
    expect(segs.length).toBeGreaterThan(0)
    expect(segs.every((s) => s.state === 'short')).toBe(true)
  })

  it('단락된 쪽과 연결된 부하는 여자되지 않는다', () => {
    const b = controlBoard()
    b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB1')])
    const [lamp] = b.rung(6, TOP, BOTTOM, [(x, y) => b.lamp(x, y, 'RL')])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[lamp!.id]).toBe(true)
    const r = sim.act({ type: 'press', tag: 'PB1' })
    expect(r.solution.energized[lamp!.id]).toBe(false)
  })
})

describe('발진', () => {
  it('코일이 자기 b접점을 거쳐 여자되면 발진 경고를 낸다', () => {
    const b = controlBoard()
    b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB1'), bc(b, 'relay', 'X1'), (x, y) => b.coil(x, y, 'relay', 'X1')])
    const sim = new Simulator(b.build())
    expect(sim.last.oscillating).toEqual([])
    const r = sim.act({ type: 'press', tag: 'PB1' })
    expect(r.oscillating).toEqual(['X1'])
  })

  it('정상 회로는 발진 경고가 없다', () => {
    const b = controlBoard()
    selfHoldRung(b, 2, { start: 'PB1', stop: 'PB0', coil: 'X1' })
    const sim = new Simulator(b.build())
    expect(click(sim, 'PB1').oscillating).toEqual([])
  })
})

describe('부하 직렬 연결', () => {
  it('램프 두 개를 직렬로 연결하면 켜지지 않는다 (교재 범위 밖)', () => {
    const b = controlBoard()
    const [l1, l2] = b.rung(2, TOP, BOTTOM, [(x, y) => b.lamp(x, y, 'RL'), (x, y) => b.lamp(x, y, 'GL')])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[l1!.id]).toBe(false)
    expect(sim.last.solution.energized[l2!.id]).toBe(false)
  })
})
