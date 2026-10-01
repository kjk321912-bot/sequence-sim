import { describe, expect, it } from 'vitest'
import { CircuitBuilder } from '../builder'
import { pinsOf } from '../geometry'
import { buildGraph, terminalKey } from '../netlist'
import { Simulator } from '../scan'

describe('넷리스트', () => {
  it('배선 끝이 다른 배선의 중간에 닿으면 T 접속된다', () => {
    const b = new CircuitBuilder()
    const main = b.wire([0, 0], [10, 0])
    const branch = b.wire([5, 0], [5, 5])
    const g = buildGraph(b.build())
    const n1 = g.pointIndex.get('0,0')!
    const n2 = g.pointIndex.get('5,5')!
    expect(g.staticNet[n1]).toBe(g.staticNet[n2])
    // 가로 배선은 T 접속점에서 두 구간으로 나뉜다
    expect(g.edges.filter((e) => e.kind === 'wire' && e.wireId === main)).toHaveLength(2)
    expect(g.edges.filter((e) => e.kind === 'wire' && e.wireId === branch)).toHaveLength(1)
  })

  it('배선이 접점의 두 핀 위를 지나가기만 해서는 단락되지 않는다', () => {
    const b = new CircuitBuilder()
    b.bus('P', 0, 0, 10)
    b.bus('N', 0, 12, 10)
    const pb = b.contact(2, 4, 'pb', 'a', 'PB1')
    const lamp = b.lamp(2, 7, 'RL')
    // P모선(2,0)에서 램프 위 핀(2,7)까지 곧게 내려오는 배선이 PB1의 두 핀 (2,4)·(2,7) 위를 지난다
    b.wire([2, 0], [2, 7])
    b.wire([2, 10], [2, 12])
    const g = buildGraph(b.build())
    const top = g.terminals.get(terminalKey(pb, '1'))!
    expect(g.staticNet[top]).not.toBe(g.staticNet[g.pointIndex.get('2,0')!])
    // 램프 위 핀은 배선 끝점이므로 연결 → PB1과 무관하게 점등 (배선이 PB1을 우회)
    expect(new Simulator(b.build()).last.solution.energized[lamp]).toBe(true)
  })

  it('가로 배선 중간에 램프 단자를 갖다 대면 연결된다 (편집으로 램프 추가)', () => {
    const b = new CircuitBuilder()
    b.bus('P', 0, 0, 10)
    b.bus('N', 0, 12, 10)
    const old = b.lamp(2, 5, 'RL')
    b.wire([2, 0], [2, 5])
    b.wire([2, 2], [8, 2])
    b.wire([2, 8], [2, 12])
    // 기존 회로에 램프를 더 달았는데, 위 단자 (5,2)가 가로 배선 중간에 닿기만 한 경우
    const added = b.lamp(5, 2, 'GL')
    b.wire([5, 5], [5, 12])
    const sol = new Simulator(b.build()).last.solution
    expect(sol.energized[old]).toBe(true)
    expect(sol.energized[added]).toBe(true)
  })

  it('3극 부품의 핀들을 가로로 지나가는 배선은 연결하지 않는다 (상간 몰래 단락 방지)', () => {
    const b = new CircuitBuilder()
    const mccb = b.add({ kind: 'mccb', x: 2, y: 4, rot: 0, tag: 'MCCB' })
    b.wire([0, 4], [10, 4])
    const g = buildGraph(b.build())
    const l1 = g.terminals.get(terminalKey(mccb, 'L1'))!
    const l2 = g.terminals.get(terminalKey(mccb, 'L2'))!
    expect(g.staticNet[l1]).not.toBe(g.staticNet[l2])
    expect(g.staticNet[l1]).not.toBe(g.staticNet[g.pointIndex.get('0,4')!])
  })

  it('부품을 90° 돌리면 핀이 가로로 놓인다', () => {
    const b = new CircuitBuilder()
    b.add({ kind: 'lamp', x: 5, y: 5, rot: 90, color: 'RL', tag: 'RL' })
    const [c] = b.build().components
    expect(pinsOf(c!)).toEqual([
      { name: '1', x: 5, y: 5 },
      { name: '2', x: 2, y: 5 },
    ])
  })

  it('세로로 놓은 모선에도 연결된다', () => {
    const b = new CircuitBuilder()
    b.add({ kind: 'bus', phase: 'P', x: 0, y: 0, length: 20, rot: 90 })
    b.add({ kind: 'bus', phase: 'N', x: 20, y: 0, length: 20, rot: 90 })
    // 가로로 눕힌 램프: P(왼쪽 세로 모선) ─ 램프 ─ N(오른쪽 세로 모선)
    const lamp = b.add({ kind: 'lamp', x: 8, y: 10, rot: 270, color: 'GL', tag: 'GL' })
    b.wire([0, 10], [8, 10])
    b.wire([11, 10], [20, 10])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[lamp]).toBe(true)
  })

  it('같은 격자점에 놓인 핀끼리는 배선 없이도 연결된다', () => {
    const b = new CircuitBuilder()
    const c1 = b.contact(0, 0, 'pb', 'a', 'PB1')
    const c2 = b.contact(0, 3, 'pb', 'a', 'PB2')
    const g = buildGraph(b.build())
    expect(g.terminals.get(terminalKey(c1, '2'))).toBe(g.terminals.get(terminalKey(c2, '1')))
  })

  it('회로 JSON을 문자열로 저장했다가 불러와도 같게 동작한다', () => {
    const b = new CircuitBuilder()
    b.bus('P', 0, 0, 10)
    b.bus('N', 0, 10, 10)
    const lamp = b.lamp(2, 3, 'YL')
    b.wire([2, 0], [2, 3])
    b.wire([2, 6], [2, 10])
    const restored = JSON.parse(JSON.stringify(b.build()))
    expect(new Simulator(restored).last.solution.energized[lamp]).toBe(true)
  })
})
