// 내장 예제의 배선 상태 검사: 끝이 떠 있는 선, 겹쳐 그린 선, 연결 안 된 단자, 단자 위를 지나가기만 하는 선
import { describe, expect, it } from 'vitest'
import { busSegment, onSegment, pinsOf, type Circuit, type Point } from '../../engine'
import { EXAMPLES } from '../index'

const key = (p: Point) => `${p.x},${p.y}`

function wiringIssues(c: Circuit): string[] {
  const issues: string[] = []
  const pins = c.components.flatMap((comp) => pinsOf(comp).map((p) => ({ ...p, owner: 'tag' in comp ? comp.tag : comp.kind })))
  const buses = c.components.flatMap((comp) => (comp.kind === 'bus' ? [busSegment(comp)] : []))
  const segs = c.wires.flatMap((w) => w.points.slice(1).map((b, i) => ({ w: w.id, a: w.points[i]!, b })))
  const verts = c.wires.flatMap((w) => w.points.map((p, i) => ({ w: w.id, p, end: i === 0 || i === w.points.length - 1 })))
  const range = (s: (typeof segs)[0], vertical: boolean) =>
    vertical ? [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)] : [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)]

  for (const s of segs) if (key(s.a) === key(s.b)) issues.push(`길이 0인 선 ${s.w}`)
  segs.forEach((s, i) => {
    for (const t of segs.slice(i + 1)) {
      const sv = s.a.x === s.b.x
      if (sv !== (t.a.x === t.b.x) || (sv ? s.a.x !== t.a.x : s.a.y !== t.a.y)) continue
      const [s0, s1] = range(s, sv) as [number, number]
      const [t0, t1] = range(t, sv) as [number, number]
      if (Math.min(s1, t1) > Math.max(s0, t0)) issues.push(`겹친 선 ${s.w}·${t.w}`)
    }
  })
  for (const v of verts) {
    if (!v.end) continue
    const touches =
      pins.some((p) => key(p) === key(v.p)) ||
      verts.some((u) => u.w !== v.w && key(u.p) === key(v.p)) ||
      segs.some((s) => s.w !== v.w && onSegment(v.p, s.a, s.b)) ||
      buses.some(([a, b]) => onSegment(v.p, a, b))
    if (!touches) issues.push(`끝이 떠 있는 선 ${v.w} (${key(v.p)})`)
  }
  for (const p of pins) {
    const touches =
      pins.some((q) => q !== p && key(q) === key(p)) || verts.some((u) => key(u.p) === key(p)) || buses.some(([a, b]) => onSegment(p, a, b))
    if (!touches) issues.push(`연결 안 된 단자 ${p.owner}:${p.name}`)
    for (const s of segs) if (onSegment(p, s.a, s.b) && key(p) !== key(s.a) && key(p) !== key(s.b)) issues.push(`단자 위를 지나가는 선 ${p.owner}:${p.name}`)
  }
  return issues
}

describe('내장 예제 배선', () => {
  it.each(EXAMPLES.map((e) => [e.title, e] as const))('%s: 끊긴 곳·남는 선 없음', (_, e) => {
    expect(wiringIssues(e.make())).toEqual([])
  })
})
