import { describe, expect, it } from 'vitest'
import { showcaseCircuit } from '../../examples/showcase'
import { parseCircuit, stringifyCircuit } from '../serialize'

describe('회로 파일', () => {
  it('저장했다가 불러오면 같은 회로가 된다', () => {
    const c = showcaseCircuit()
    const r = parseCircuit(stringifyCircuit(c))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.circuit).toEqual(c)
  })

  it('JSON이 아니면 이유를 알려 준다', () => {
    expect(parseCircuit('hello')).toEqual({ ok: false, error: expect.stringContaining('JSON') })
  })

  it('부품 정보가 잘못되면 몇 번째인지 알려 준다', () => {
    const bad = JSON.stringify({ version: 1, name: 'x', components: [{ id: 'a', kind: 'rocket', x: 0, y: 0 }], wires: [] })
    expect(parseCircuit(bad)).toEqual({ ok: false, error: '1번째 부품 정보가 올바르지 않습니다' })
  })

  it('새 버전 앱에서 만든 파일은 업데이트를 안내한다', () => {
    const r = parseCircuit(JSON.stringify({ version: 99, components: [], wires: [] }))
    expect(r.ok).toBe(false)
  })

  it('이름이 없으면 기본 이름을 붙이고, 회전값이 이상하면 0으로 고친다', () => {
    const r = parseCircuit(
      JSON.stringify({ version: 1, components: [{ id: 'a', kind: 'lamp', color: 'RL', tag: 'RL', x: 1, y: 1, rot: 45 }], wires: [] }),
    )
    expect(r.ok && r.circuit.name).toBe('불러온 회로')
    expect(r.ok && r.circuit.components[0]!.rot).toBe(0)
  })
})
