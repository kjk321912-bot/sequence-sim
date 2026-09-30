import { describe, expect, it } from 'vitest'
import { Simulator } from '../scan'
import { a, bc, BOTTOM, click, controlBoard, selfHoldRung, TOP } from './helpers'

/** 기동하면 X1 자기유지 → T1 여자, 3초 뒤 T1-a로 GL 점등·T1-b로 RL 소등 */
function timerCircuit(preset = 3000) {
  const b = controlBoard()
  selfHoldRung(b, 2, { start: 'PB1', stop: 'PB0', coil: 'X1' })
  b.rung(6, TOP, BOTTOM, [a(b, 'relay', 'X1'), (x, y) => b.coil(x, y, 'timer', 'T1', preset)])
  const [, gl] = b.rung(8, TOP, BOTTOM, [a(b, 'timer', 'T1'), (x, y) => b.lamp(x, y, 'GL')])
  const [, , rl] = b.rung(10, TOP, BOTTOM, [a(b, 'relay', 'X1'), bc(b, 'timer', 'T1'), (x, y) => b.lamp(x, y, 'RL')])
  return { circuit: b.build('타이머'), gl: gl!.id, rl: rl!.id }
}

describe('ON 딜레이 타이머', () => {
  it('설정 시간 전에는 한시접점이 동작하지 않는다', () => {
    const { circuit, gl, rl } = timerCircuit()
    const sim = new Simulator(circuit)
    click(sim, 'PB1')
    const r = sim.run(2900)
    expect(r.solution.energized[gl]).toBe(false)
    expect(r.solution.energized[rl]).toBe(true)
    expect(r.state.timers.T1!.elapsed).toBe(2900)
  })

  it('설정 시간이 지나면 a접점은 닫히고 b접점은 열린다', () => {
    const { circuit, gl, rl } = timerCircuit()
    const sim = new Simulator(circuit)
    click(sim, 'PB1')
    const r = sim.run(3000)
    expect(r.state.timers.T1!.done).toBe(true)
    expect(r.solution.energized[gl]).toBe(true)
    expect(r.solution.energized[rl]).toBe(false)
  })

  it('코일이 소자되면 한시접점이 즉시 복귀하고 시간이 초기화된다', () => {
    const { circuit, gl } = timerCircuit()
    const sim = new Simulator(circuit)
    click(sim, 'PB1')
    sim.run(3500)
    const r = click(sim, 'PB0')
    expect(r.solution.energized[gl]).toBe(false)
    expect(r.state.timers.T1).toEqual({ elapsed: 0, done: false })
  })

  it('설정 시간 전에 정지했다가 다시 기동하면 처음부터 다시 센다', () => {
    const { circuit, gl } = timerCircuit()
    const sim = new Simulator(circuit)
    click(sim, 'PB1')
    sim.run(2000)
    click(sim, 'PB0')
    click(sim, 'PB1')
    expect(sim.run(2000).solution.energized[gl]).toBe(false)
    expect(sim.run(1000).solution.energized[gl]).toBe(true)
  })

  it('시간 간격(dt)을 크게 해도 같은 결과 (배속 대응)', () => {
    const { circuit, gl } = timerCircuit()
    const sim = new Simulator(circuit)
    click(sim, 'PB1')
    expect(sim.run(3000, 50).solution.energized[gl]).toBe(true)
  })

  it('타이머 출력으로 자기 자신을 끊는 플리커 회로는 발진 없이 주기적으로 동작한다', () => {
    // T1-b → T1 코일: 설정 시간마다 한 번씩 리셋되는 펄스 발생 회로
    const b = controlBoard()
    b.rung(2, TOP, BOTTOM, [bc(b, 'timer', 'T1'), (x, y) => b.coil(x, y, 'timer', 'T1', 500)])
    const sim = new Simulator(b.build())
    const r = sim.run(2000)
    expect(r.oscillating).toEqual([])
    expect(r.state.timers.T1!.elapsed).toBeLessThan(500)
  })
})

/** PB1 누를 때마다 계수, 3회에 C1-a로 램프, PB2로 리셋 */
function counterCircuit(preset = 3) {
  const b = controlBoard()
  b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB1'), (x, y) => b.coil(x, y, 'counter', 'C1', preset)])
  b.rung(4, TOP, BOTTOM, [a(b, 'pb', 'PB2'), (x, y) => b.coil(x, y, 'counterReset', 'C1')])
  const [, lamp] = b.rung(6, TOP, BOTTOM, [a(b, 'counter', 'C1'), (x, y) => b.lamp(x, y, 'YL')])
  const [, off] = b.rung(8, TOP, BOTTOM, [bc(b, 'counter', 'C1'), (x, y) => b.lamp(x, y, 'WL')])
  return { circuit: b.build('카운터'), lamp: lamp!.id, off: off!.id }
}

describe('카운터', () => {
  it('입력이 들어올 때마다(상승 에지) 1씩 센다', () => {
    const { circuit } = counterCircuit()
    const sim = new Simulator(circuit)
    sim.act({ type: 'press', tag: 'PB1' })
    sim.run(500) // 누르고 있는 동안에는 한 번만 센다
    expect(sim.state.counters.C1!.count).toBe(1)
    sim.act({ type: 'release', tag: 'PB1' })
    click(sim, 'PB1')
    expect(sim.state.counters.C1!.count).toBe(2)
  })

  it('설정값에 도달하면 a접점이 닫히고 b접점이 열린다', () => {
    const { circuit, lamp, off } = counterCircuit()
    const sim = new Simulator(circuit)
    click(sim, 'PB1')
    let r = click(sim, 'PB1')
    expect(r.solution.energized[lamp]).toBe(false)
    expect(r.solution.energized[off]).toBe(true)
    r = click(sim, 'PB1')
    expect(r.solution.energized[lamp]).toBe(true)
    expect(r.solution.energized[off]).toBe(false)
  })

  it('리셋하면 0으로 돌아가고 접점이 복귀한다', () => {
    const { circuit, lamp } = counterCircuit()
    const sim = new Simulator(circuit)
    for (let i = 0; i < 3; i++) click(sim, 'PB1')
    const r = click(sim, 'PB2')
    expect(r.state.counters.C1!.count).toBe(0)
    expect(r.solution.energized[lamp]).toBe(false)
  })

  it('리셋 입력이 들어와 있는 동안에는 세지 않는다', () => {
    const { circuit } = counterCircuit()
    const sim = new Simulator(circuit)
    sim.act({ type: 'press', tag: 'PB2' })
    click(sim, 'PB1')
    expect(sim.state.counters.C1!.count).toBe(0)
  })
})
