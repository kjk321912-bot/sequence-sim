import { beforeEach, describe, expect, it } from 'vitest'
import { pinsOf, type Component } from '../../../engine'
import { FAULT_PROBLEMS } from '../../../examples/faults'
import { useEditor } from '../../../store/editorStore'
import { useFault } from '../../../store/faultStore'
import { useSim } from '../../../store/simStore'

const circuit = () => useEditor.getState().circuit
const find = (pred: (k: Component) => boolean) => circuit().components.find(pred)!
const pin = (c: Component, name: string) => pinsOf(c).find((p) => p.name === name)!
const none = { compId: null, wireId: null }

beforeEach(() => {
  useSim.getState().setMode('edit')
  useEditor.getState().setCircuit(FAULT_PROBLEMS.find((p) => p.key === 'f-selfHold')!.make())
  useFault.getState().resetProgress()
  useSim.getState().setMode('fault')
  useEditor.setState({ view: { x: 0, y: 0, scale: 1 } })
})

describe('고장진단 탭', () => {
  it('전압 측정: 두 점을 누르면 측정값, 다음 누름은 새 측정', () => {
    const f = useFault.getState()
    f.setTool('volt')
    const pb1 = find((k) => k.kind === 'contact' && k.tag === 'PB1')
    f.pick(pin(pb1, '1'), none)
    expect(useFault.getState().probes).toHaveLength(1)
    f.pick(pin(pb1, '2'), none)
    expect(useFault.getState().reading!.text).toBe('220 V')
    expect(useFault.getState().measurements).toBe(1)
    f.pick(pin(pb1, '1'), none)
    expect(useFault.getState().probes).toHaveLength(1)
  })

  it('도통 측정은 전원이 있으면 막는다', () => {
    const f = useFault.getState()
    f.setTool('ohm')
    const pb0 = find((k) => k.kind === 'contact' && k.tag === 'PB0')
    f.pick(pin(pb0, '1'), none)
    f.pick(pin(pb0, '2'), none)
    expect(useFault.getState().reading!.refused).toBe(true)
  })

  it('틀린 지목은 횟수만 늘고, 맞는 지목은 고장을 고친다', () => {
    const f = useFault.getState()
    f.setTool('point')
    const pb1 = find((k) => k.kind === 'contact' && k.tag === 'PB1')
    f.pick(pin(pb1, '1'), { compId: pb1.id, wireId: null })
    expect(useFault.getState().target!.kinds).toEqual(['contactOpen', 'contactWelded'])
    useFault.getState().choose('contactOpen')
    expect(useFault.getState().wrongGuesses).toBe(1)
    expect(circuit().faults).toHaveLength(1)

    const faultId = (circuit().faults![0] as { compId: string }).compId
    useFault.getState().pick({ x: 0, y: 0 }, { compId: faultId, wireId: null })
    useFault.getState().choose('contactOpen')
    expect(circuit().faults).toEqual([])
    expect(useFault.getState().found).toEqual(['X a접점 접촉 불량'])
  })

  it('조작 도구가 아니면 버튼을 눌러도 조작되지 않는다 (톡 치기가 측정)', () => {
    useFault.getState().setTool('volt')
    expect(useFault.getState().tool).toBe('volt')
    useFault.getState().setTool('operate')
    expect(useFault.getState().probes).toEqual([])
  })

  it('교사: 고장 심기와 무작위 고장', () => {
    const f = useFault.getState()
    f.setTool('plant')
    const coil = find((k) => k.kind === 'coil' && k.tag === 'X')
    f.pick(pin(coil, '1'), { compId: coil.id, wireId: null })
    useFault.getState().choose('coilBurnt')
    expect(circuit().faults!.some((x) => x.kind === 'coilBurnt')).toBe(true)
    const before = circuit().faults!.length
    expect(useFault.getState().plantRandom(1)).toBe(1)
    expect(circuit().faults).toHaveLength(before + 1)
  })
})
