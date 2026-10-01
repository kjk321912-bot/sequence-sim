// 공개문제 1~18번: 문제지의 "제어회로의 동작 사항"대로 움직이는지 확인
import { describe, expect, it } from 'vitest'
import { Simulator, type Circuit } from '../../engine'
import * as P from '../exam/problems'

function setup(make: () => Circuit) {
  const circuit = make()
  const sim = new Simulator(circuit)
  const comp = (kind: string, tag: string) => circuit.components.find((c) => c.kind === kind && 'tag' in c && c.tag === tag)
  const lamp = (tag: string) => !!sim.last.solution.energized[comp('lamp', tag)!.id]
  const bz = () => !!sim.last.solution.energized[comp('buzzer', 'BZ')!.id]
  const motor = (tag: string) => sim.last.solution.motors[comp('motor', tag)!.id]
  const coil = (tag: string) => !!sim.state.coils[tag]
  /** 켜져 있는 것만 모아 비교하기 쉽게 */
  const on = (...tags: string[]) => tags.filter((t) => (t.endsWith('L') ? lamp(t) : coil(t)))
  const click = (tag: string) => {
    sim.act({ type: 'press', tag })
    sim.act({ type: 'release', tag })
  }
  const toggle = (tag: string) => sim.act({ type: 'toggle', tag })
  toggle('MCCB')
  const noFault = () => {
    expect(sim.last.solution.shorts).toEqual([])
    expect(sim.last.oscillating).toEqual([])
  }
  return { circuit, sim, lamp, bz, motor, coil, on, click, toggle, noFault, run: (ms: number) => sim.run(ms) }
}

const ALL = Object.entries(P)

describe('공개문제 공통', () => {
  it.each(ALL)('%s: MCCB를 넣으면 단락·발진·직렬 경고 없이 EOCR에 전원이 들어온다', (_, make) => {
    const t = setup(make)
    t.noFault()
    expect(t.sim.last.solution.seriesLoads).toEqual([])
    expect(t.coil('EOCR#전원')).toBe(true)
  })

  it.each(ALL)('%s: EOCR이 트립하면 전동기가 멈추고, 리셋하면 초기 상태로', (_, make) => {
    const t = setup(make)
    const initial = JSON.stringify(t.sim.state.coils)
    t.sim.act({ type: 'thrTrip', tag: 'EOCR' })
    expect(t.motor('M1')).toBe('stop')
    expect(t.motor('M2')).toBe('stop')
    expect(t.lamp('YL') || t.bz()).toBe(true)
    t.sim.act({ type: 'thrReset', tag: 'EOCR' })
    expect(JSON.stringify(t.sim.state.coils)).toBe(initial)
  })
})

describe('공개문제 1번', () => {
  it('자동: FLS 감지 → X, MC1 → M1·RL,  감지 해제 → 정지', () => {
    const t = setup(P.exam01)
    t.toggle('SS')
    t.toggle('FLS')
    expect(t.on('X', 'MC1', 'MC2', 'RL')).toEqual(['X', 'MC1', 'RL'])
    expect(t.motor('M1')).toBe('fwd')
    t.toggle('FLS')
    expect(t.on('X', 'MC1', 'RL')).toEqual([])
  })
  it('수동: PB1 → T, MC1 → t초 후 MC2·GL,  PB0 → 정지', () => {
    const t = setup(P.exam01)
    t.click('PB1')
    expect(t.on('T', 'MC1', 'MC2', 'RL')).toEqual(['T', 'MC1', 'RL'])
    t.run(3000)
    expect(t.on('MC2', 'GL')).toEqual(['MC2', 'GL'])
    expect(t.motor('M2')).toBe('fwd')
    t.click('PB0')
    expect(t.on('T', 'MC1', 'MC2')).toEqual([])
  })
  it('EOCR: 트립 → FR 여자, BZ부터 YL과 교대', () => {
    const t = setup(P.exam01)
    t.click('PB1')
    t.sim.act({ type: 'thrTrip', tag: 'EOCR' })
    expect([t.coil('FR'), t.bz(), t.lamp('YL')]).toEqual([true, true, false])
    t.run(1000)
    expect([t.bz(), t.lamp('YL')]).toEqual([false, true])
  })
})

describe('공개문제 2번', () => {
  it('수동: PB1 → X, T → t초 후 FR, MC1 → MC1·MC2 교대', () => {
    const t = setup(P.exam02)
    t.click('PB1')
    expect(t.on('X', 'T', 'FR', 'MC1')).toEqual(['X', 'T'])
    t.run(3000)
    expect(t.on('FR', 'MC1', 'MC2', 'RL')).toEqual(['FR', 'MC1', 'RL'])
    t.run(2000)
    expect(t.on('MC1', 'MC2', 'GL')).toEqual(['MC2', 'GL'])
    t.click('PB0')
    expect(t.on('X', 'T', 'FR', 'MC1', 'MC2')).toEqual([])
  })
  it('자동: FLS 감지 → X, T,  SS를 M으로 → 정지', () => {
    const t = setup(P.exam02)
    t.toggle('SS')
    t.toggle('FLS')
    expect(t.on('X', 'T')).toEqual(['X', 'T'])
    t.toggle('SS')
    expect(t.on('X', 'T')).toEqual([])
  })
})

describe('공개문제 3번', () => {
  it('자동: FLS 감지 → FR, MC1 → MC1·MC2 교대', () => {
    const t = setup(P.exam03)
    t.toggle('SS')
    t.toggle('FLS')
    expect(t.on('FR', 'MC1', 'MC2', 'X')).toEqual(['FR', 'MC1'])
    t.run(2000)
    expect(t.on('MC1', 'MC2')).toEqual(['MC2'])
  })
  it('수동: PB1 → T → t초 후 X, FR, MC1', () => {
    const t = setup(P.exam03)
    t.click('PB1')
    expect(t.on('T', 'X', 'FR', 'MC1')).toEqual(['T'])
    t.run(3000)
    expect(t.on('T', 'X', 'FR', 'MC1')).toEqual(['T', 'X', 'FR', 'MC1'])
  })
})

describe('공개문제 4번', () => {
  it('① M1 → ② M2 → ③ 정지 순서로 반복 (T 설정 < FR 설정)', () => {
    const t = setup(P.exam04)
    t.toggle('SS')
    t.toggle('FLS')
    expect(t.on('X', 'FR', 'MC1', 'MC2')).toEqual(['X', 'FR', 'MC1'])
    t.run(4000)
    expect(t.on('MC1', 'MC2', 'T')).toEqual(['MC2', 'T'])
    t.run(2000)
    expect(t.on('MC1', 'MC2')).toEqual([])
    t.run(2000)
    expect(t.on('MC1', 'MC2')).toEqual(['MC1'])
  })
  it('수동: PB1 → X, FR', () => {
    const t = setup(P.exam04)
    t.click('PB1')
    expect(t.on('X', 'FR', 'MC1')).toEqual(['X', 'FR', 'MC1'])
  })
})

describe('공개문제 5번', () => {
  it('FLS 감지 → T, X, FR → MC1·MC2 교대 → t초 후 FR 소자, MC1·MC2 함께 운전', () => {
    const t = setup(P.exam05)
    t.toggle('SS')
    t.toggle('FLS')
    expect(t.on('T', 'X', 'FR', 'MC1', 'MC2')).toEqual(['T', 'X', 'FR', 'MC1'])
    t.run(2000)
    expect(t.on('MC1', 'MC2')).toEqual(['MC2'])
    t.run(1000)
    expect(t.on('FR', 'MC1', 'MC2', 'RL', 'GL')).toEqual(['MC1', 'MC2', 'RL', 'GL'])
  })
  it('수동: PB1로 같은 동작', () => {
    const t = setup(P.exam05)
    t.click('PB1')
    expect(t.on('T', 'X', 'FR', 'MC1')).toEqual(['T', 'X', 'FR', 'MC1'])
  })
})

describe('공개문제 6번', () => {
  it('자동: FLS 감지 → X, MC1, MC2', () => {
    const t = setup(P.exam06)
    t.toggle('SS')
    t.toggle('FLS')
    expect(t.on('X', 'T', 'MC1', 'MC2', 'RL', 'GL')).toEqual(['X', 'MC1', 'MC2', 'RL', 'GL'])
  })
  it('수동: PB1 → T, MC1, MC2 → t초 후 MC2 소자·FR 여자 → MC1·MC2 교대', () => {
    const t = setup(P.exam06)
    t.click('PB1')
    expect(t.on('T', 'FR', 'MC1', 'MC2')).toEqual(['T', 'MC1', 'MC2'])
    t.run(3000)
    expect(t.on('FR', 'MC1', 'MC2')).toEqual(['FR', 'MC1'])
    t.run(2000)
    expect(t.on('MC1', 'MC2', 'GL')).toEqual(['MC2', 'GL'])
  })
})

describe('공개문제 7번', () => {
  it('① M1 → ② M2 → ③ 정지 순서로 반복', () => {
    const t = setup(P.exam07)
    t.click('PB1')
    expect(t.on('X', 'FR', 'T', 'MC1', 'MC2')).toEqual(['X', 'FR', 'T', 'MC1'])
    t.run(2000)
    expect(t.on('MC1', 'MC2')).toEqual(['MC2'])
    t.run(2000)
    expect(t.on('T', 'MC1', 'MC2')).toEqual([])
    t.run(4000)
    expect(t.on('MC1', 'MC2')).toEqual(['MC1'])
  })
})

describe('공개문제 8번', () => {
  it('자동: FLS 감지 → FR, X, MC1, MC2, YL → YL 점멸', () => {
    const t = setup(P.exam08)
    t.toggle('SS')
    t.toggle('FLS')
    expect(t.on('FR', 'X', 'MC1', 'MC2', 'RL', 'GL', 'YL')).toEqual(['FR', 'X', 'MC1', 'MC2', 'RL', 'GL', 'YL'])
    t.run(1000)
    expect(t.lamp('YL')).toBe(false)
  })
  it('수동: PB1 → T, MC1, MC2 → t초 후 MC1·MC2 소자', () => {
    const t = setup(P.exam08)
    t.click('PB1')
    expect(t.on('T', 'MC1', 'MC2')).toEqual(['T', 'MC1', 'MC2'])
    t.run(3000)
    expect(t.on('T', 'MC1', 'MC2')).toEqual(['T'])
  })
})

describe('공개문제 9번', () => {
  it('자동: FLS 감지 → MC1만', () => {
    const t = setup(P.exam09)
    t.toggle('SS')
    t.toggle('FLS')
    expect(t.on('X', 'T', 'MC1', 'MC2')).toEqual(['MC1'])
  })
  it('수동: PB1 → X, T, MC1 → t초 후 MC2', () => {
    const t = setup(P.exam09)
    t.click('PB1')
    expect(t.on('X', 'T', 'MC1', 'MC2')).toEqual(['X', 'T', 'MC1'])
    t.run(3000)
    expect(t.coil('MC2')).toBe(true)
  })
})

describe('공개문제 10번', () => {
  it('PB1 → X1·WL,  LS1 → T1 → t1초 후 MC1·RL, WL 소등,  LS1 해제 → 정지', () => {
    const t = setup(P.exam10)
    t.click('PB1')
    expect(t.on('X1', 'WL')).toEqual(['X1', 'WL'])
    t.toggle('LS1')
    expect(t.on('T1', 'MC1')).toEqual(['T1'])
    t.run(3000)
    expect(t.on('MC1', 'RL', 'WL')).toEqual(['MC1', 'RL'])
    t.toggle('LS1')
    expect(t.on('T1', 'MC1', 'WL')).toEqual(['WL'])
    t.click('PB0')
    expect(t.on('X1', 'WL')).toEqual([])
  })
})

describe('공개문제 11번', () => {
  it('PB1을 t1초 이상 눌러야 자기유지, PB2로 넘어가면 X1 소자', () => {
    const t = setup(P.exam11)
    t.click('PB1')
    expect(t.coil('X1')).toBe(false)
    t.sim.act({ type: 'press', tag: 'PB1' })
    t.run(3000)
    t.sim.act({ type: 'release', tag: 'PB1' })
    expect(t.on('X1', 'T1', 'WL')).toEqual(['X1', 'T1', 'WL'])
    t.toggle('LS1')
    expect(t.on('MC1', 'RL', 'WL')).toEqual(['MC1', 'RL'])
    t.toggle('LS1')
    t.sim.act({ type: 'press', tag: 'PB2' })
    t.run(3000)
    t.sim.act({ type: 'release', tag: 'PB2' })
    expect(t.on('X1', 'T1', 'X2', 'T2')).toEqual(['X2', 'T2'])
  })
})

describe('공개문제 12번', () => {
  it('PB1 → X1, T1, WL,  LS1 감지 → MC1 (T1 소자)', () => {
    const t = setup(P.exam12)
    t.click('PB1')
    expect(t.on('X1', 'T1', 'WL')).toEqual(['X1', 'T1', 'WL'])
    t.toggle('LS1')
    expect(t.on('MC1', 'T1', 'RL', 'WL')).toEqual(['MC1', 'RL'])
    t.toggle('LS1')
    expect(t.on('MC1', 'T1', 'WL')).toEqual(['T1', 'WL'])
  })
  it('LS1 감지가 없으면 t1초 후 X2, MC2', () => {
    const t = setup(P.exam12)
    t.click('PB1')
    t.run(3000)
    expect(t.on('X2', 'MC2', 'GL')).toEqual(['X2', 'MC2', 'GL'])
  })
  it('PB2 → X2, MC2 → LS2 → T2·WL → t2초 후 X1, T1', () => {
    const t = setup(P.exam12)
    t.click('PB2')
    expect(t.on('X2', 'MC2')).toEqual(['X2', 'MC2'])
    t.toggle('LS2')
    expect(t.on('T2', 'WL')).toEqual(['T2', 'WL'])
    t.run(3000)
    expect(t.on('X1', 'T1')).toEqual(['X1', 'T1'])
  })
})

describe('공개문제 13번', () => {
  it('LS1 순간 감지 → X1, T1, WL', () => {
    const t = setup(P.exam13)
    t.toggle('LS1')
    t.toggle('LS1')
    expect(t.on('X1', 'T1', 'WL')).toEqual(['X1', 'T1', 'WL'])
  })
  it('LS2 감지가 없으면 t1초 후 X2, T2, MC2 → t2초 후 X1, T1, T2 소자', () => {
    const t = setup(P.exam13)
    t.click('PB1')
    t.run(3000)
    expect(t.on('X2', 'T2', 'MC2')).toEqual(['X2', 'T2', 'MC2'])
    t.run(3000)
    expect(t.on('X1', 'T1', 'T2', 'WL', 'MC2')).toEqual(['MC2'])
  })
  it('LS2 감지 → MC1 (T1 소자)', () => {
    const t = setup(P.exam13)
    t.click('PB1')
    t.toggle('LS2')
    expect(t.on('MC1', 'T1', 'RL', 'WL')).toEqual(['MC1', 'RL'])
  })
})

describe('공개문제 14번', () => {
  it('MCCB → WL,  LS1·LS2 모두 감지 + PB1 → MC1 → t1초 후 정지', () => {
    const t = setup(P.exam14)
    expect(t.lamp('WL')).toBe(true)
    t.toggle('LS1')
    t.click('PB1')
    expect(t.coil('MC1')).toBe(false)
    t.toggle('LS2')
    t.click('PB1')
    expect(t.on('T1', 'MC1', 'RL', 'WL')).toEqual(['T1', 'MC1', 'RL'])
    t.run(3000)
    expect(t.on('T1', 'MC1', 'WL')).toEqual(['WL'])
  })
  it('LS 하나 이상 + PB2 → MC2,  LS 모두 해제 → 정지', () => {
    const t = setup(P.exam14)
    t.toggle('LS2')
    t.click('PB2')
    expect(t.on('T2', 'MC2', 'GL')).toEqual(['T2', 'MC2', 'GL'])
    t.toggle('LS2')
    expect(t.on('T2', 'MC2')).toEqual([])
  })
})

describe('공개문제 15번', () => {
  it('LS 하나 이상 + PB1 → MC1, LS 해제해도 계속 → t1초 후 정지', () => {
    const t = setup(P.exam15)
    t.toggle('LS1')
    t.click('PB1')
    expect(t.on('T1', 'MC1', 'WL')).toEqual(['T1', 'MC1'])
    t.toggle('LS1')
    expect(t.coil('MC1')).toBe(true)
    t.run(3000)
    expect(t.on('MC1', 'WL')).toEqual(['WL'])
  })
  it('LS 모두 감지 + PB2 → MC2', () => {
    const t = setup(P.exam15)
    t.toggle('LS1')
    t.click('PB2')
    expect(t.coil('MC2')).toBe(false)
    t.toggle('LS2')
    t.click('PB2')
    expect(t.on('T2', 'MC2', 'GL')).toEqual(['T2', 'MC2', 'GL'])
  })
})

describe('공개문제 16번', () => {
  it('LS1 감지 → T1 → t1초 후 X1, MC1', () => {
    const t = setup(P.exam16)
    t.toggle('LS1')
    expect(t.on('T1', 'MC1')).toEqual(['T1'])
    t.run(3000)
    expect(t.on('X1', 'MC1', 'RL')).toEqual(['X1', 'MC1', 'RL'])
    t.toggle('LS1')
    expect(t.coil('MC1')).toBe(true)
  })
  it('LS1 감지 상태에서 LS2 → T2, X2, MC2 → t2초 후 MC2 소자·WL → LS2 해제 → MC2', () => {
    const t = setup(P.exam16)
    t.toggle('LS1')
    t.toggle('LS2')
    expect(t.on('T2', 'X2', 'MC2', 'GL')).toEqual(['T2', 'X2', 'MC2', 'GL'])
    t.run(3000)
    expect(t.on('MC2', 'WL')).toEqual(['WL'])
    t.toggle('LS2')
    expect(t.on('MC2', 'GL', 'WL')).toEqual(['MC2', 'GL'])
  })
})

describe('공개문제 17번', () => {
  it('LS 하나만 감지 + PB1 → MC1,  t1초 후 PB2 → MC2 → t2초 후 정지·WL', () => {
    const t = setup(P.exam17)
    t.toggle('LS1')
    t.click('PB1')
    expect(t.on('T1', 'MC1', 'RL')).toEqual(['T1', 'MC1', 'RL'])
    t.click('PB2')
    expect(t.coil('MC2')).toBe(false)
    t.run(3000)
    t.click('PB2')
    expect(t.on('T2', 'MC2', 'GL')).toEqual(['T2', 'MC2', 'GL'])
    t.run(3000)
    expect(t.on('MC2', 'WL')).toEqual(['WL'])
  })
  it('LS1·LS2가 모두 감지되면 MC1 정지', () => {
    const t = setup(P.exam17)
    t.toggle('LS1')
    t.click('PB1')
    t.toggle('LS2')
    expect(t.on('T1', 'MC1')).toEqual([])
  })
})

describe('공개문제 18번', () => {
  it('LS1 감지·LS2 해제 + PB1 → MC1 → t1초 후 WL, LS가 바뀌어도 계속', () => {
    const t = setup(P.exam18)
    t.toggle('LS1')
    t.click('PB1')
    expect(t.on('T1', 'MC1', 'RL', 'WL')).toEqual(['T1', 'MC1', 'RL'])
    t.run(3000)
    expect(t.lamp('WL')).toBe(true)
    t.toggle('LS2')
    expect(t.coil('MC1')).toBe(true)
  })
  it('LS1 해제·LS2 감지 + PB2 → MC2', () => {
    const t = setup(P.exam18)
    t.toggle('LS2')
    t.click('PB1')
    expect(t.coil('MC1')).toBe(false)
    t.click('PB2')
    expect(t.on('T2', 'MC2', 'GL')).toEqual(['T2', 'MC2', 'GL'])
  })
})
