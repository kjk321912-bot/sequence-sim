import { beforeEach, describe, expect, it } from 'vitest'
import { emptyCircuit, type Circuit } from '../../engine'
import { componentCenter, useEditor } from '../../store/editorStore'
import { familyTags, latestTag, nextTag, PALETTE, stepTag, suggestTag, tagFamily } from '../palette'

const place = (key: string, x = 10, y = 10) => useEditor.getState().addFromPalette(key, { x, y })!
const comp = (id: string) => useEditor.getState().circuit.components.find((c) => c.id === id)!

describe('번호 자동 부여', () => {
  const circuit: Circuit = {
    ...emptyCircuit(),
    components: [
      { id: 'a', kind: 'coil', device: 'relay', tag: 'X1', x: 0, y: 0, rot: 0 },
      { id: 'b', kind: 'coil', device: 'relay', tag: 'X3', x: 0, y: 0, rot: 0 },
      { id: 'c', kind: 'coil', device: 'mc', tag: 'MC1', x: 0, y: 0, rot: 0 },
      { id: 'd', kind: 'mccb', tag: 'MCCB', x: 0, y: 0, rot: 0 },
    ],
  }

  it('다음 번호는 가장 큰 번호 + 1', () => {
    expect(nextTag(circuit, 'X')).toBe('X4')
    expect(nextTag(circuit, 'PB')).toBe('PB1')
  })

  it('MC와 MCCB, T와 THR처럼 앞글자가 겹쳐도 구분한다', () => {
    expect(nextTag(circuit, 'MC')).toBe('MC2')
    expect(nextTag(circuit, 'T')).toBe('T1')
  })

  it('접점은 가장 최근에 놓은 코일 번호를 따른다', () => {
    expect(latestTag(circuit, 'X')).toBe('X3')
    expect(latestTag(circuit, 'C')).toBe('C1')
  })

  it('팔레트 항목 key가 겹치지 않는다', () => {
    expect(new Set(PALETTE.map((p) => p.key)).size).toBe(PALETTE.length)
  })
})

describe('편집 동작', () => {
  beforeEach(() => useEditor.getState().setCircuit(emptyCircuit()))

  it('팔레트로 놓으면 부품 중심이 놓은 자리에 오고 선택된다', () => {
    const id = place('xCoil', 10, 10)
    const c = comp(id)
    const center = componentCenter(c)
    expect(Math.abs(center.x - 10)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(center.y - 10)).toBeLessThanOrEqual(0.5)
    expect(useEditor.getState().selection).toBe(id)
  })

  it('코일을 놓고 접점을 놓으면 같은 번호가 붙는다', () => {
    place('xCoil')
    const coil2 = place('xCoil')
    const contact = place('xA')
    expect(comp(coil2)).toMatchObject({ tag: 'X2' })
    expect(comp(contact)).toMatchObject({ tag: 'X2', type: 'a' })
  })

  it('네 번 돌리면 제자리로 돌아온다', () => {
    const id = place('pbA', 20, 20)
    const before = comp(id)
    for (let i = 0; i < 4; i++) useEditor.getState().rotateSelected()
    expect(comp(id)).toMatchObject({ x: before.x, y: before.y, rot: 0 })
  })

  it('삭제하면 선택도 풀린다', () => {
    const id = place('RL')
    useEditor.getState().deleteSelected()
    expect(useEditor.getState().circuit.components.some((c) => c.id === id)).toBe(false)
    expect(useEditor.getState().selection).toBeNull()
  })
})

describe('번호 계열 (속성 창의 번호 선택지)', () => {
  beforeEach(() => useEditor.getState().setCircuit(emptyCircuit()))

  it('릴레이 코일과 릴레이 접점은 같은 계열로 묶인다', () => {
    place('xCoil')
    place('xCoil')
    const contact = place('xB')
    const circuit = useEditor.getState().circuit
    expect(familyTags(circuit, tagFamily(comp(contact))!)).toEqual(['X1', 'X2'])
  })

  it('타이머 코일·한시접점·순시접점은 같은 계열', () => {
    place('tCoil')
    const inst = place('tiA')
    expect(tagFamily(comp(inst))).toBe('timer')
    expect(comp(inst)).toMatchObject({ tag: 'T1', device: 'timerInst' })
  })

  it('EOCR·FR처럼 하나만 쓰는 기기는 번호 없이 시작하고 두 번째부터 번호가 붙는다', () => {
    const e1 = place('eocrMain')
    const e2 = place('eocrMain')
    expect(comp(e1)).toMatchObject({ tag: 'EOCR' })
    expect(comp(e2)).toMatchObject({ tag: 'EOCR2' })
    expect(suggestTag(useEditor.getState().circuit, 'eocr')).toBe('EOCR3')
    expect(suggestTag(useEditor.getState().circuit, 'relay')).toBe('X1')
  })

  it('속성 변경으로 번호와 a/b를 바꿀 수 있다', () => {
    const id = place('xA')
    useEditor.getState().updateComponent(id, { tag: 'X7', type: 'b' })
    expect(comp(id)).toMatchObject({ tag: 'X7', type: 'b', kind: 'contact' })
  })
})

describe('번호 올리기·내리기 (▲▼)', () => {
  it('번호를 1씩 올리고 내린다', () => {
    expect(stepTag('X1', 1)).toBe('X2')
    expect(stepTag('X2', -1)).toBe('X1')
    expect(stepTag('PB0', 1)).toBe('PB1')
  })

  it('1에서 내리면 번호 없는 이름, 번호 없는 이름에서 올리면 1', () => {
    expect(stepTag('X1', -1)).toBe('X')
    expect(stepTag('X', -1)).toBe('X')
    expect(stepTag('EOCR', 1)).toBe('EOCR1')
  })

  it('숫자만 있으면 1 아래로 내려가지 않는다', () => {
    expect(stepTag('1', -1)).toBe('1')
    expect(stepTag('9', 1)).toBe('10')
  })
})
