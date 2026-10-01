import { beforeEach, describe, expect, it } from 'vitest'
import { emptyCircuit, Simulator } from '../../engine'
import { useEditor } from '../../store/editorStore'

const S = () => useEditor.getState()
const place = (key: string, x = 10, y = 10) => S().addFromPalette(key, { x, y })!
const comp = (id: string) => S().circuit.components.find((c) => c.id === id)!

beforeEach(() => {
  S().setCircuit(emptyCircuit())
  useEditor.setState({ past: [], future: [] })
})

describe('되돌리기·다시하기', () => {
  it('부품 놓기를 되돌리고 다시할 수 있다', () => {
    const id = place('xCoil')
    S().undo()
    expect(S().circuit.components).toHaveLength(0)
    S().redo()
    expect(S().circuit.components.map((c) => c.id)).toEqual([id])
  })

  it('새 작업을 하면 다시하기 기록이 사라진다', () => {
    place('xCoil')
    S().undo()
    place('RL')
    expect(S().future).toHaveLength(0)
  })

  it('끌기 한 번은 되돌리기 한 번으로 돌아간다', () => {
    const id = place('xCoil')
    const before = { ...comp(id) }
    const base = S().beginDrag()
    for (let i = 1; i <= 5; i++) S().dragComponent(base, id, before.x + i, before.y)
    S().undo()
    expect(comp(id)).toMatchObject({ x: before.x, y: before.y })
  })

  it('번호 칸에 연속으로 입력한 것은 한 번에 되돌린다', () => {
    const id = place('xCoil')
    S().updateComponent(id, { tag: 'X' })
    S().updateComponent(id, { tag: 'X5' })
    S().updateComponent(id, { tag: 'X55' })
    S().undo()
    expect(comp(id)).toMatchObject({ tag: 'X1' })
  })
})

describe('배선', () => {
  it('배선을 추가하고 선택해서 지울 수 있다', () => {
    const id = S().addWire([
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 0, y: 5 },
    ])!
    expect(S().circuit.wires[0]!.points).toHaveLength(2) // 한 직선 위 가운데 점 정리
    S().select(id)
    S().deleteSelected()
    expect(S().circuit.wires).toHaveLength(0)
  })

  it('점 하나짜리 배선은 만들지 않는다', () => {
    expect(S().addWire([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toBeNull()
  })

  it('부품을 끌면 연결된 배선이 따라와서 회로가 끊어지지 않는다', () => {
    // P모선 ─ 배선 ─ 램프 ─ 배선 ─ N모선
    const p = place('busP', 20, 0)
    const n = place('busN', 20, 20)
    const lamp = place('RL', 10, 10)
    const l = comp(lamp)
    S().updateComponent(p, { x: 0, y: 0 })
    S().updateComponent(n, { x: 0, y: 20 })
    S().addWire([{ x: l.x, y: 0 }, { x: l.x, y: l.y }])
    S().addWire([{ x: l.x, y: l.y + 3 }, { x: l.x, y: 20 }])
    expect(new Simulator(S().circuit).last.solution.energized[lamp]).toBe(true)

    const base = S().beginDrag()
    S().dragComponent(base, lamp, l.x + 4, l.y + 2)
    expect(new Simulator(S().circuit).last.solution.energized[lamp]).toBe(true)
  })

  it('배선 위에 램프를 겹쳐 놓으면 배선이 끊기고 램프가 끼워져 직렬로 흐리게 켜진다', () => {
    // P모선 ─ RL ─ 긴 배선 ─ N모선, 긴 배선 위에 GL을 끌어다 놓는다
    const p = place('busP', 20, 0)
    const n = place('busN', 20, 20)
    S().updateComponent(p, { x: 0, y: 0 })
    S().updateComponent(n, { x: 0, y: 20 })
    const rl = place('RL', 10, 4)
    const r = comp(rl)
    S().addWire([{ x: r.x, y: 0 }, { x: r.x, y: r.y }])
    S().addWire([{ x: r.x, y: r.y + 3 }, { x: r.x, y: 20 }])
    const gl = place('GL', 30, 10)
    const base = S().beginDrag()
    S().dragComponent(base, gl, r.x, r.y + 8)
    expect(S().circuit.wires).toHaveLength(3)
    const sol = new Simulator(S().circuit).last.solution
    expect(sol.dim[rl]).toBe(true)
    expect(sol.dim[gl]).toBe(true)
    expect(sol.seriesLoads).toEqual([])

    // 다시 옆으로 빼면 배선은 원래대로 이어진다 (끌기 시작 회로 기준)
    S().dragComponent(base, gl, r.x + 5, r.y + 8)
    expect(S().circuit.wires).toHaveLength(2)
    expect(new Simulator(S().circuit).last.solution.energized[rl]).toBe(true)
  })

  it('팔레트에서 배선 위에 바로 놓아도 끼워진다', () => {
    S().addWire([{ x: 10, y: 0 }, { x: 10, y: 20 }])
    const lamp = place('RL', 10, 10)
    const l = comp(lamp)
    expect(S().circuit.wires.map((w) => w.points)).toEqual([
      [{ x: 10, y: 0 }, { x: 10, y: l.y }],
      [{ x: 10, y: l.y + 3 }, { x: 10, y: 20 }],
    ])
  })

  it('부품을 돌려도 연결된 배선이 따라온다', () => {
    const lamp = place('RL', 10, 10)
    const l = comp(lamp)
    S().addWire([{ x: l.x, y: l.y - 4 }, { x: l.x, y: l.y }])
    S().select(lamp)
    S().rotateSelected()
    const pin1 = { x: comp(lamp).x, y: comp(lamp).y } // 첫 번째 핀 = 기준점
    expect(S().circuit.wires[0]!.points.at(-1)).toEqual(pin1)
  })
})

describe('회로 이름', () => {
  it('이름을 바꾸고 되돌릴 수 있다', () => {
    S().renameCircuit('  과제 1  ')
    expect(S().circuit.name).toBe('과제 1')
    S().undo()
    expect(S().circuit.name).toBe('새 회로')
  })
})

describe('붙어 있던 부품 옮기기', () => {
  it('배선 없이 핀끼리 붙어 있던 부품을 옮기면 이어 주는 배선이 생겨 회로가 유지된다', () => {
    // P모선 ─ 배선 ─ 접점(PB) ─(핀 직결)─ 램프 ─ 배선 ─ N모선
    const p = place('busP', 20, 0)
    const n = place('busN', 20, 20)
    S().updateComponent(p, { x: 0, y: 0 })
    S().updateComponent(n, { x: 0, y: 20 })
    const pb = place('pbA', 10, 5)
    const c = comp(pb)
    const lamp = place('RL', 30, 30)
    S().updateComponent(lamp, { x: c.x, y: c.y + 3 }) // PB 아래 핀에 램프 위 핀을 붙인다
    S().addWire([{ x: c.x, y: 0 }, { x: c.x, y: c.y }])
    S().addWire([{ x: c.x, y: c.y + 6 }, { x: c.x, y: 20 }])
    useEditor.setState({ past: [] })

    const base = S().beginDrag()
    S().dragComponent(base, lamp, c.x + 3, c.y + 5)
    S().dragComponent(base, lamp, c.x + 4, c.y + 6) // 여러 번 움직여도 다리 배선은 하나
    expect(S().circuit.wires).toHaveLength(3)

    // PB를 누르면 램프가 켜진다 = 연결 유지
    const sim = new Simulator(S().circuit)
    expect(comp(pb)).toMatchObject({ tag: 'PB1' })
    expect(sim.act({ type: 'press', tag: 'PB1' }).solution.energized[lamp]).toBe(true)
  })
})
