import { describe, expect, it } from 'vitest'
import { contactActivity, Simulator } from '../scan'
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
  it('램프 두 개를 직렬로 연결하면 전압을 나눠 받아 둘 다 흐리게 켜진다', () => {
    const b = controlBoard()
    const [l1, l2] = b.rung(2, TOP, BOTTOM, [(x, y) => b.lamp(x, y, 'RL'), (x, y) => b.lamp(x, y, 'GL')])
    const sol = new Simulator(b.build()).last.solution
    expect(sol.energized[l1!.id]).toBe(false)
    expect(sol.energized[l2!.id]).toBe(false)
    expect(sol.dim[l1!.id]).toBe(true)
    expect(sol.dim[l2!.id]).toBe(true)
    expect(sol.seriesLoads).toEqual([])
    // 두 램프 사이 배선까지 전류가 흐르는 것으로 표시
    expect(sol.segments.length).toBeGreaterThan(0)
    expect(sol.segments.every((s) => s.state === 'flow')).toBe(true)
  })

  it('코일과 램프를 직렬로 연결하면 동작하지 않고 경고한다 (코일 전압 부족)', () => {
    const b = controlBoard()
    const [x1, l1] = b.rung(2, TOP, BOTTOM, [(x, y) => b.coil(x, y, 'relay', 'X1'), (x, y) => b.lamp(x, y, 'RL')])
    const sol = new Simulator(b.build()).last.solution
    expect(sol.energized[x1!.id]).toBe(false)
    expect(sol.dim[l1!.id]).toBeFalsy()
    expect(sol.seriesLoads).toEqual([x1!.id, l1!.id])
  })

  it('정상 회로와 배선 안 된 부하는 직렬 경고를 내지 않는다', () => {
    const b = controlBoard()
    b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB1'), (x, y) => b.lamp(x, y, 'RL')])
    b.lamp(10, 4, 'GL') // 어디에도 연결되지 않은 램프
    const sim = new Simulator(b.build())
    expect(sim.last.solution.seriesLoads).toEqual([])
    sim.act({ type: 'press', tag: 'PB1' })
    expect(sim.last.solution.seriesLoads).toEqual([])
  })
})

describe('표시용 접점 동작', () => {
  it('접촉 불량 고장이 있어도 접점 막대는 정상처럼 움직인다', () => {
    const b = controlBoard()
    const [pb] = b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB1'), (x, y) => b.lamp(x, y, 'RL')])
    const c = b.build()
    c.faults = [{ kind: 'contactOpen', compId: pb!.id }]
    const sim = new Simulator(c)
    sim.act({ type: 'press', tag: 'PB1' })
    expect(contactActivity(c, sim.state)[pb!.id]).toBe(true)
    expect(sim.last.solution.closed[pb!.id]).toEqual([false])
  })
})
