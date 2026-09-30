import { describe, expect, it } from 'vitest'
import { CircuitBuilder, type Component } from '../../engine'
import { chooseRoute, followWires, lRoute, simplify, snapPoint } from '../wiring'

const P = (x: number, y: number) => ({ x, y })

describe('배선 경로', () => {
  it('한 직선 위의 가운데 점과 겹치는 점을 없앤다', () => {
    expect(simplify([P(0, 0), P(0, 2), P(0, 2), P(0, 5), P(3, 5)])).toEqual([P(0, 0), P(0, 5), P(3, 5)])
  })

  it('ㄱ자 경로: 세로 먼저 / 가로 먼저', () => {
    expect(lRoute(P(0, 0), P(4, 6), true)).toEqual([P(0, 0), P(0, 6), P(4, 6)])
    expect(lRoute(P(0, 0), P(4, 6), false)).toEqual([P(0, 0), P(4, 0), P(4, 6)])
    expect(lRoute(P(0, 0), P(0, 6), false)).toEqual([P(0, 0), P(0, 6)])
  })

  it('다른 부품 핀 위를 지나가는 방향은 피한다', () => {
    const b = new CircuitBuilder()
    b.contact(0, 2, 'pb', 'a', 'PB1') // 핀 (0,2), (0,5)
    // (0,0) → (4,6): 세로 먼저 가면 PB1 두 핀 위를 지나므로 가로 먼저를 고른다
    expect(chooseRoute(b.build(), P(0, 0), P(4, 6), true)).toEqual([P(0, 0), P(4, 0), P(4, 6)])
  })
})

describe('스냅', () => {
  const b = new CircuitBuilder()
  b.bus('P', 0, 0, 20)
  const lamp = b.lamp(5, 5, 'RL') // 핀 (5,5), (5,8)
  const wire = b.wire([10, 3], [10, 12])
  const c = b.build()

  it('가까운 핀에 맞춘다', () => {
    expect(snapPoint(c, P(5.3, 7.6), 0.8)).toEqual({ point: P(5, 8), kind: 'pin', refId: lamp })
  })

  it('핀이 없으면 배선 위 격자점에 맞춘다', () => {
    expect(snapPoint(c, P(10.3, 6.4), 0.8)).toEqual({ point: P(10, 6), kind: 'wire', refId: wire })
  })

  it('모선 위 격자점에 맞춘다', () => {
    expect(snapPoint(c, P(14.2, 0.3), 0.8)).toMatchObject({ point: P(14, 0), kind: 'bus' })
  })

  it('아무것도 없으면 가까운 격자점', () => {
    expect(snapPoint(c, P(17.4, 9.6), 0.8)).toEqual({ point: P(17, 10), kind: 'grid' })
  })
})

describe('배선 따라오기', () => {
  const lamp = { id: 'L', kind: 'lamp', color: 'RL', tag: 'RL', x: 5, y: 5, rot: 0 } as Component

  it('같은 세로줄에서 위아래로 옮기면 끝점만 따라간다', () => {
    const wires = [{ id: 'w', points: [P(5, 0), P(5, 5)] }]
    const out = followWires(wires, lamp, { ...lamp, y: 7 })
    expect(out[0]!.points).toEqual([P(5, 0), P(5, 7)])
  })

  it('옆으로 옮기면 꺾인 점이 생기고 마지막 구간 방향(세로)이 유지된다', () => {
    const wires = [{ id: 'w', points: [P(5, 0), P(5, 5)] }]
    const out = followWires(wires, lamp, { ...lamp, x: 8 })
    expect(out[0]!.points).toEqual([P(5, 0), P(8, 0), P(8, 5)])
  })

  it('다른 부품에 붙은 배선은 건드리지 않는다', () => {
    const wires = [{ id: 'w', points: [P(0, 0), P(0, 5)] }]
    expect(followWires(wires, lamp, { ...lamp, x: 8 })[0]).toBe(wires[0])
  })

  it('양 끝이 모두 이 부품 핀이면 배선 전체가 같이 움직인다', () => {
    const wires = [{ id: 'w', points: [P(5, 5), P(7, 5), P(7, 8), P(5, 8)] }]
    const out = followWires(wires, lamp, { ...lamp, x: 6, y: 6 })
    expect(out[0]!.points).toEqual([P(6, 6), P(8, 6), P(8, 9), P(6, 9)])
  })

  it('돌리면 핀 위치가 바뀐 대로 따라간다', () => {
    const wires = [{ id: 'w', points: [P(5, 12), P(5, 8)] }] // 아래 핀(5,8)에 붙은 배선
    const out = followWires(wires, lamp, { ...lamp, rot: 90 }) // 아래 핀이 (2,5)로
    expect(out[0]!.points.at(-1)).toEqual(P(2, 5))
    const pts = out[0]!.points
    for (let i = 0; i + 1 < pts.length; i++) {
      expect(pts[i]!.x === pts[i + 1]!.x || pts[i]!.y === pts[i + 1]!.y).toBe(true) // 직교 유지
    }
  })
})
