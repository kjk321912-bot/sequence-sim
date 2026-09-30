// 전기기능사 공개도면에 나오는 기기: 타이머 순시접점, 플리커릴레이, 플로트레스, EOCR, 퓨즈
import { describe, expect, it } from 'vitest'
import { CircuitBuilder } from '../builder'
import { Simulator } from '../scan'
import { a, bc, BOTTOM, click, controlBoard, TOP } from './helpers'

describe('타이머 순시접점', () => {
  it('코일과 동시에 동작해 자기유지에 쓸 수 있고, 한시접점은 설정 시간 뒤 동작한다', () => {
    const b = controlBoard()
    // PB1 ∥ T-순시a → T(2초),  T-한시a → GL
    const [pb] = b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB1'), (x, y) => b.coil(x, y, 'timer', 'T', 2000)])
    b.contact(4, pb!.top, 'timerInst', 'a', 'T')
    b.wire([2, pb!.top], [4, pb!.top])
    b.wire([4, pb!.top + 3], [2, pb!.top + 3])
    const [, gl] = b.rung(8, TOP, BOTTOM, [a(b, 'timer', 'T'), (x, y) => b.lamp(x, y, 'GL')])
    const sim = new Simulator(b.build())
    click(sim, 'PB1')
    expect(sim.state.coils.T).toBe(true) // 순시접점으로 자기유지
    expect(sim.run(1990).solution.energized[gl!.id]).toBe(false)
    expect(sim.run(10).solution.energized[gl!.id]).toBe(true)
  })
})

describe('플리커릴레이', () => {
  /** SS1 → FR(1초),  FR-a → YL,  FR-b → BZ (둘 다 SS1 뒤에 연결) */
  function flicker() {
    const b = controlBoard()
    b.rung(2, TOP, BOTTOM, [a(b, 'selector', 'SS1'), (x, y) => b.coil(x, y, 'flicker', 'FR', 1000)])
    const [, , yl] = b.rung(6, TOP, BOTTOM, [a(b, 'selector', 'SS1'), a(b, 'flicker', 'FR'), (x, y) => b.lamp(x, y, 'YL')])
    const [, , bz] = b.rung(10, TOP, BOTTOM, [
      a(b, 'selector', 'SS1'),
      bc(b, 'flicker', 'FR'),
      (x, y) => b.add({ kind: 'buzzer', x, y, tag: 'BZ' }),
    ])
    return { circuit: b.build(), yl: yl!.id, bz: bz!.id }
  }

  it('여자되면 a접점부터 동작하고, 설정 시간마다 a/b가 번갈아 전환된다', () => {
    const { circuit, yl, bz } = flicker()
    const sim = new Simulator(circuit)
    let r = sim.act({ type: 'toggle', tag: 'SS1' })
    expect([r.solution.energized[yl], r.solution.energized[bz]]).toEqual([true, false])
    r = sim.run(990)
    expect([r.solution.energized[yl], r.solution.energized[bz]]).toEqual([true, false])
    r = sim.run(20)
    expect([r.solution.energized[yl], r.solution.energized[bz]]).toEqual([false, true])
    r = sim.run(1000)
    expect([r.solution.energized[yl], r.solution.energized[bz]]).toEqual([true, false])
  })

  it('소자되면 복귀하고, 다시 여자되면 처음부터 시작한다', () => {
    const { circuit, yl } = flicker()
    const sim = new Simulator(circuit)
    sim.act({ type: 'toggle', tag: 'SS1' })
    sim.run(1500)
    sim.act({ type: 'toggle', tag: 'SS1' })
    expect(sim.state.flickers.FR).toEqual({ elapsed: 0, on: false })
    const r = sim.act({ type: 'toggle', tag: 'SS1' })
    expect(r.solution.energized[yl]).toBe(true)
  })
})

describe('플로트레스 스위치', () => {
  /** SS1 → FLS 전원,  FLS-a → X */
  function fls() {
    const b = controlBoard()
    b.rung(2, TOP, BOTTOM, [a(b, 'selector', 'SS1'), (x, y) => b.add({ kind: 'fls', x, y, tag: 'FLS' })])
    b.rung(6, TOP, BOTTOM, [a(b, 'fls', 'FLS'), (x, y) => b.coil(x, y, 'relay', 'X')])
    return b.build()
  }

  it('전원이 들어오고 수위를 감지해야 접점이 동작한다', () => {
    const sim = new Simulator(fls())
    sim.act({ type: 'toggle', tag: 'FLS' }) // 수위 감지만
    expect(sim.state.coils.X).toBe(false)
    sim.act({ type: 'toggle', tag: 'SS1' }) // 전원 공급
    expect(sim.state.coils.X).toBe(true)
    sim.act({ type: 'toggle', tag: 'FLS' }) // 수위 해제
    expect(sim.state.coils.X).toBe(false)
  })

  it('수위를 감지한 상태에서 전원이 끊기면 접점이 복귀한다', () => {
    const sim = new Simulator(fls())
    sim.act({ type: 'toggle', tag: 'SS1' })
    sim.act({ type: 'toggle', tag: 'FLS' })
    expect(sim.state.coils.X).toBe(true)
    expect(sim.act({ type: 'toggle', tag: 'SS1' }).state.coils.X).toBe(false)
  })
})

describe('EOCR', () => {
  /** EOCR-b → MC1 (기동 버튼 없이 바로),  EOCR-a → YL,  EOCR 전원 */
  function eocr() {
    const b = controlBoard()
    const [, eocrPower] = b.rung(2, TOP, BOTTOM, [a(b, 'pb', 'PB9'), (x, y) => b.coil(x, y, 'eocr', 'EOCR')])
    b.rung(6, TOP, BOTTOM, [bc(b, 'eocr', 'EOCR'), (x, y) => b.coil(x, y, 'mc', 'MC1')])
    const [, yl] = b.rung(10, TOP, BOTTOM, [a(b, 'eocr', 'EOCR'), (x, y) => b.lamp(x, y, 'YL')])
    return { b, yl: yl!.id, eocrPower: eocrPower!.id }
  }

  it('트립하면 b접점이 열리고 a접점이 닫히며, 리셋하면 복귀한다', () => {
    const { b, yl } = eocr()
    const sim = new Simulator(b.build())
    expect(sim.state.coils.MC1).toBe(true)
    let r = sim.act({ type: 'thrTrip', tag: 'EOCR' })
    expect(r.state.coils.MC1).toBe(false)
    expect(r.solution.energized[yl]).toBe(true)
    r = sim.act({ type: 'thrReset', tag: 'EOCR' })
    expect(r.state.coils.MC1).toBe(true)
    expect(r.solution.energized[yl]).toBe(false)
  })

  it('EOCR 전원 부하는 표시만 하고 동작에는 영향이 없다', () => {
    const { b, eocrPower } = eocr()
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[eocrPower]).toBe(false)
    expect(sim.act({ type: 'press', tag: 'PB9' }).solution.energized[eocrPower]).toBe(true)
    expect(sim.state.coils.MC1).toBe(true)
  })

  it('주회로 EOCR은 결상 시 트립한다 (THR과 같은 보호 동작)', () => {
    const b = new CircuitBuilder()
    b.bus('R', 0, 0, 12)
    b.bus('S', 0, 1, 12)
    b.bus('T', 0, 2, 12)
    b.wire([2, 0], [2, 4])
    b.wire([4, 1], [4, 4])
    // L3 결선 누락 → 결상
    b.add({ kind: 'thrHeater', x: 2, y: 4, tag: 'EOCR', tripTime: 3000, relay: 'eocr' })
    const m = b.add({ kind: 'motor', x: 2, y: 7, tag: 'M1' })
    const sim = new Simulator(b.build())
    expect(sim.last.solution.motors[m]).toBe('singlePhase')
    sim.run(3000)
    expect(sim.state.thr.EOCR!.tripped).toBe(true)
  })
})

describe('퓨즈', () => {
  it('정상 부하 전류로는 끊어지지 않는다', () => {
    const b = controlBoard()
    const [f, lamp] = b.rung(2, TOP, BOTTOM, [(x, y) => b.add({ kind: 'fuse', x, y, tag: 'F1' }), (x, y) => b.lamp(x, y, 'RL')])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[lamp!.id]).toBe(true)
    expect(sim.state.blownFuses[f!.id]).toBeFalsy()
  })

  it('단락 전류가 흐르면 용단되어 단락을 차단하고, 교체하면 다시 도통한다', () => {
    const b = controlBoard()
    const [f] = b.rung(2, TOP, BOTTOM, [(x, y) => b.add({ kind: 'fuse', x, y, tag: 'F1' }), a(b, 'pb', 'PB1')])
    const sim = new Simulator(b.build())
    let r = sim.act({ type: 'press', tag: 'PB1' })
    expect(r.state.blownFuses[f!.id]).toBe(true)
    expect(r.solution.shorts).toEqual([]) // 퓨즈가 끊어져 단락이 해소됨
    sim.act({ type: 'release', tag: 'PB1' })
    r = sim.act({ type: 'fuseReplace' })
    expect(r.state.blownFuses[f!.id]).toBeFalsy()
    expect(r.solution.closed[f!.id]).toEqual([true])
  })

  it('단락 경로에 없는 퓨즈는 끊어지지 않는다', () => {
    const b = controlBoard()
    const [f] = b.rung(2, TOP, BOTTOM, [(x, y) => b.add({ kind: 'fuse', x, y, tag: 'F1' }), (x, y) => b.lamp(x, y, 'RL')])
    b.rung(6, TOP, BOTTOM, [a(b, 'pb', 'PB1')])
    const sim = new Simulator(b.build())
    const r = sim.act({ type: 'press', tag: 'PB1' })
    expect(r.solution.shorts).toEqual([['N', 'P']])
    expect(r.state.blownFuses[f!.id]).toBeFalsy()
  })

  it('공개도면처럼 L1·L3에서 퓨즈를 거쳐 조작회로 전원을 따온다', () => {
    const b = new CircuitBuilder()
    b.bus('R', 0, 0, 6)
    b.bus('S', 0, 1, 6)
    b.bus('T', 0, 2, 6)
    // L1 → F1 → 위쪽 제어 모선(배선),  L3 → F2 → 아래쪽 제어 모선(배선)
    b.wire([2, 0], [2, 4])
    b.add({ kind: 'fuse', x: 2, y: 4, tag: 'F1' })
    b.wire([2, 7], [2, 8], [10, 8], [20, 8])
    b.wire([4, 2], [4, 10])
    b.add({ kind: 'fuse', x: 4, y: 10, tag: 'F2' })
    b.wire([4, 13], [4, 20], [20, 20])
    const lamp = b.lamp(14, 12, 'GL')
    b.wire([14, 8], [14, 12])
    b.wire([14, 15], [14, 20])
    const sim = new Simulator(b.build())
    expect(sim.last.solution.energized[lamp]).toBe(true)
  })
})
