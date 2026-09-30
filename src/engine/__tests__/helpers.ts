// 테스트용 회로 조립 도우미

import { CircuitBuilder } from '../builder'
import type { ContactDevice } from '../model'
import { Simulator } from '../scan'

export const TOP = 0
export const BOTTOM = 24

/** P모선(위)·N모선(아래)이 있는 빈 조작회로 */
export function controlBoard(width = 40) {
  const b = new CircuitBuilder()
  b.bus('P', 0, TOP, width)
  b.bus('N', 0, BOTTOM, width)
  return b
}

type Part = (x: number, y: number) => string
export const a = (b: CircuitBuilder, device: ContactDevice, tag: string): Part => (x, y) => b.contact(x, y, device, 'a', tag)
export const bc = (b: CircuitBuilder, device: ContactDevice, tag: string): Part => (x, y) => b.contact(x, y, device, 'b', tag)

/**
 * 자기유지 회로 한 줄: [앞쪽 직렬 접점들] → PB-b(정지) → PB-a(기동) ∥ 자기유지 a접점 → 코일
 * 자기유지 접점은 x+2 위치에 기동 버튼과 병렬로 놓는다.
 */
export function selfHoldRung(
  b: CircuitBuilder,
  x: number,
  opts: { start: string; stop: string; coil: string; coilDevice?: 'relay' | 'mc'; before?: Part[] },
) {
  const device = opts.coilDevice ?? 'relay'
  const before = opts.before ?? []
  const placed = b.rung(x, TOP, BOTTOM, [
    ...before,
    bc(b, 'pb', opts.stop),
    a(b, 'pb', opts.start),
    (x, y) => b.coil(x, y, device, opts.coil),
  ])
  const startTop = placed[before.length + 1]!.top
  const holdId = b.contact(x + 2, startTop, device, 'a', opts.coil)
  b.wire([x, startTop], [x + 2, startTop])
  b.wire([x + 2, startTop + 3], [x, startTop + 3])
  return { holdId, coilId: placed[placed.length - 1]!.id }
}

/** 버튼을 눌렀다 뗀다 */
export function click(sim: Simulator, tag: string) {
  sim.act({ type: 'press', tag })
  return sim.act({ type: 'release', tag })
}
