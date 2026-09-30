import { describe, expect, it } from 'vitest'
import { Simulator } from '../scan'
import { a, bc, BOTTOM, click, controlBoard, selfHoldRung, TOP } from './helpers'

/** 자기유지 회로 + 운전 표시등(RL) + 정지 표시등(GL) */
function selfHoldCircuit() {
  const b = controlBoard()
  const { holdId, coilId } = selfHoldRung(b, 2, { start: 'PB1', stop: 'PB0', coil: 'X1' })
  const [, rl] = b.rung(6, TOP, BOTTOM, [a(b, 'relay', 'X1'), (x, y) => b.lamp(x, y, 'RL')])
  const [, gl] = b.rung(8, TOP, BOTTOM, [bc(b, 'relay', 'X1'), (x, y) => b.lamp(x, y, 'GL')])
  return { circuit: b.build('자기유지'), holdId, coilId, rl: rl!.id, gl: gl!.id }
}

describe('자기유지 회로', () => {
  it('처음에는 코일이 소자되어 있고 정지 표시등(GL)만 켜진다', () => {
    const { circuit, coilId, rl, gl } = selfHoldCircuit()
    const sim = new Simulator(circuit)
    expect(sim.last.solution.energized[coilId]).toBe(false)
    expect(sim.last.solution.energized[rl]).toBe(false)
    expect(sim.last.solution.energized[gl]).toBe(true)
  })

  it('기동 버튼을 눌렀다 떼도 자기유지 접점으로 계속 여자된다', () => {
    const { circuit, coilId, rl, gl } = selfHoldCircuit()
    const sim = new Simulator(circuit)
    sim.act({ type: 'press', tag: 'PB1' })
    expect(sim.state.coils.X1).toBe(true)
    const r = sim.act({ type: 'release', tag: 'PB1' })
    expect(r.solution.energized[coilId]).toBe(true)
    expect(r.solution.energized[rl]).toBe(true)
    expect(r.solution.energized[gl]).toBe(false)
  })

  it('정지 버튼을 누르면 자기유지가 풀리고, 떼어도 다시 켜지지 않는다', () => {
    const { circuit, coilId } = selfHoldCircuit()
    const sim = new Simulator(circuit)
    click(sim, 'PB1')
    sim.act({ type: 'press', tag: 'PB0' })
    expect(sim.state.coils.X1).toBe(false)
    const r = sim.act({ type: 'release', tag: 'PB0' })
    expect(r.solution.energized[coilId]).toBe(false)
  })

  it('정지와 기동을 동시에 누르면 정지가 우선한다', () => {
    const { circuit } = selfHoldCircuit()
    const sim = new Simulator(circuit)
    sim.act({ type: 'press', tag: 'PB0' })
    sim.act({ type: 'press', tag: 'PB1' })
    expect(sim.state.coils.X1).toBe(false)
  })

  it('한 번에 안정되며 발진·단락이 없다', () => {
    const { circuit } = selfHoldCircuit()
    const sim = new Simulator(circuit)
    const r = click(sim, 'PB1')
    expect(r.oscillating).toEqual([])
    expect(r.solution.shorts).toEqual([])
  })

  it('자기유지 접점이 통전 표시된다', () => {
    const { circuit, holdId } = selfHoldCircuit()
    const sim = new Simulator(circuit)
    expect(sim.last.solution.conducting[holdId]).toBeFalsy()
    const r = click(sim, 'PB1')
    expect(r.solution.closed[holdId]).toEqual([true])
    expect(r.solution.conducting[holdId]).toBe(true)
  })

  it('부품 배치 순서가 달라도 결과가 같다', () => {
    const { circuit, coilId } = selfHoldCircuit()
    const reversed = { ...circuit, components: [...circuit.components].reverse(), wires: [...circuit.wires].reverse() }
    for (const c of [circuit, reversed]) {
      const sim = new Simulator(c)
      const r = click(sim, 'PB1')
      expect(r.solution.energized[coilId]).toBe(true)
    }
  })
})

describe('배선 통전 표시', () => {
  it('램프 줄의 배선은 여자되면 통전(flow), 아래쪽 배선은 위→아래 방향으로 흐른다', () => {
    const { circuit } = selfHoldCircuit()
    const sim = new Simulator(circuit)
    const bottomWire = (r: ReturnType<typeof sim.tick>) =>
      r.solution.segments.find((s) => s.from.x === 6 && s.to.x === 6 && s.to.y === BOTTOM)!

    expect(bottomWire(sim.last).state).toBe('live') // N 전위만 있음
    const r = click(sim, 'PB1')
    const seg = bottomWire(r)
    expect(seg.state).toBe('flow')
    // from(6,7) → to(6,24): 아래쪽으로 흐름
    expect(seg.from.y).toBeLessThan(seg.to.y)
    expect(seg.dir).toBe(1)
  })

  it('한쪽 끝이 막힌 곁가지 배선은 통전이 아니라 활선으로 표시된다', () => {
    const { circuit } = selfHoldCircuit()
    // 램프 줄 중간(6,4)에서 왼쪽 빈 곳으로 뻗은 끝이 막힌 배선
    circuit.wires.push({ id: 'stub', points: [{ x: 6, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 12 }] })
    const sim = new Simulator(circuit)
    const r = click(sim, 'PB1')
    const stub = r.solution.segments.find((s) => s.wireId === 'stub')!
    expect(stub.state).toBe('live')
    expect(stub.potential).toBe('P')
  })

  it('아무 곳에도 연결되지 않은 배선은 무전압', () => {
    const { circuit } = selfHoldCircuit()
    circuit.wires.push({ id: 'float', points: [{ x: 30, y: 10 }, { x: 34, y: 10 }] })
    const sim = new Simulator(circuit)
    expect(sim.last.solution.segments.find((s) => s.wireId === 'float')!.state).toBe('dead')
  })

  it('교차만 하는 배선은 연결되지 않는다', () => {
    const b = controlBoard()
    // P모선에서 내려오는 선과, 그 선을 가로지르는 떠 있는 선
    b.wire([2, TOP], [2, 10])
    const cross = b.wire([0, 5], [4, 5])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.segments.find((s) => s.wireId === cross)!.state).toBe('dead')
  })
})
