import { describe, expect, it } from 'vitest'
import { Simulator } from '../scan'
import { a, BOTTOM, click, controlBoard, selfHoldRung, TOP } from './helpers'

function base() {
  const b = controlBoard()
  const { holdId, coilId } = selfHoldRung(b, 2, { start: 'PB1', stop: 'PB0', coil: 'X1' })
  const [contact, lamp] = b.rung(6, TOP, BOTTOM, [a(b, 'relay', 'X1'), (x, y) => b.lamp(x, y, 'RL')])
  return { b, holdId, coilId, lampContact: contact!.id, lamp: lamp!.id }
}

describe('고장 주입', () => {
  it('자기유지 접점 접촉 불량: 기동 버튼을 떼면 꺼진다', () => {
    const { b, holdId } = base()
    b.fault({ kind: 'contactOpen', compId: holdId })
    const sim = new Simulator(b.build())
    sim.act({ type: 'press', tag: 'PB1' })
    expect(sim.state.coils.X1).toBe(true)
    expect(sim.act({ type: 'release', tag: 'PB1' }).state.coils.X1).toBe(false)
  })

  it('코일 소손: 기동해도 여자되지 않고 접점도 움직이지 않는다', () => {
    const { b, coilId, lamp } = base()
    b.fault({ kind: 'coilBurnt', compId: coilId })
    const sim = new Simulator(b.build())
    const r = click(sim, 'PB1')
    expect(r.solution.energized[coilId]).toBe(false)
    expect(r.solution.energized[lamp]).toBe(false)
  })

  it('접점 융착: 램프 쪽 a접점이 붙어 있으면 코일과 무관하게 램프가 켜진다', () => {
    const { b, lampContact, lamp } = base()
    b.fault({ kind: 'contactWelded', compId: lampContact })
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[lamp]).toBe(true)
  })

  it('단선: 램프 줄의 N 쪽 배선이 끊기면 램프가 켜지지 않고 그 배선은 무전압', () => {
    const { b, lamp } = base()
    const circuit = b.build()
    const bottom = circuit.wires.find((w) => w.points[0]!.x === 6 && w.points[1]!.y === BOTTOM)!
    circuit.faults = [{ kind: 'wireOpen', wireId: bottom.id }]
    const sim = new Simulator(circuit)
    const r = click(sim, 'PB1')
    expect(r.solution.energized[lamp]).toBe(false)
    // 단선된 배선은 그래프에서 빠지므로 구간 목록에 없다 (UI는 끊어진 선으로 그린다)
    expect(r.solution.segments.some((s) => s.wireId === bottom.id)).toBe(false)
  })
})
