// 부품 팔레트 정의와 번호(tag) 자동 부여
//
// 번호 규칙
// - 코일·입력 장치는 새로 놓을 때마다 다음 번호 (X1 → X2, PB1 → PB2)
// - 접점은 같은 종류 코일 중 가장 최근 번호를 따른다 (X2 코일을 놓은 뒤 X 접점을 놓으면 X2)

import type { Circuit, Component, ContactDevice, LampColor, Phase } from '../engine'

type NewComp = Component extends infer C ? (C extends Component ? Omit<C, 'id' | 'x' | 'y' | 'rot'> : never) : never

export interface PaletteItem {
  key: string
  name: string
  group: PaletteGroup
  make: (circuit: Circuit) => NewComp
}

export type PaletteGroup = '전원' | '입력' | '릴레이' | '타이머·카운터' | '출력' | '주회로'
export const PALETTE_GROUPS: PaletteGroup[] = ['전원', '입력', '릴레이', '타이머·카운터', '출력', '주회로']

/** 회로에 쓰인 tag들 */
function tagsOf(circuit: Circuit): string[] {
  return circuit.components.flatMap((c) => ('tag' in c ? [c.tag] : []))
}

/** prefix 뒤에 붙일 다음 번호 (PB1, PB2가 있으면 PB3) */
export function nextTag(circuit: Circuit, prefix: string): string {
  const re = new RegExp(`^${prefix}(\\d+)$`)
  let max = 0
  for (const t of tagsOf(circuit)) {
    const m = re.exec(t)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}${max + 1}`
}

/** 가장 최근에 놓인 해당 prefix 번호. 없으면 1번 */
export function latestTag(circuit: Circuit, prefix: string): string {
  const re = new RegExp(`^${prefix}\\d+$`)
  const found = tagsOf(circuit).filter((t) => re.test(t))
  return found[found.length - 1] ?? `${prefix}1`
}

/** 입력 장치 접점: 새 번호 */
const inputContact = (device: ContactDevice, type: 'a' | 'b', prefix: string) => (c: Circuit): NewComp => ({
  kind: 'contact',
  device,
  type,
  tag: nextTag(c, prefix),
})

/** 코일에 딸린 접점: 최근 코일 번호 */
const linkedContact = (device: ContactDevice, type: 'a' | 'b', prefix: string) => (c: Circuit): NewComp => ({
  kind: 'contact',
  device,
  type,
  tag: latestTag(c, prefix),
})

const bus = (phase: Phase) => (): NewComp => ({ kind: 'bus', phase, length: 24 })

const lamp = (color: LampColor) => (c: Circuit): NewComp => {
  const used = tagsOf(c).includes(color)
  return { kind: 'lamp', color, tag: used ? nextTag(c, color) : color }
}

export const PALETTE: PaletteItem[] = [
  { key: 'busP', name: 'P모선', group: '전원', make: bus('P') },
  { key: 'busN', name: 'N모선', group: '전원', make: bus('N') },

  { key: 'pbA', name: 'PB-a', group: '입력', make: inputContact('pb', 'a', 'PB') },
  { key: 'pbB', name: 'PB-b', group: '입력', make: inputContact('pb', 'b', 'PB') },
  { key: 'ssA', name: '셀렉터-a', group: '입력', make: inputContact('selector', 'a', 'SS') },
  { key: 'ssB', name: '셀렉터-b', group: '입력', make: inputContact('selector', 'b', 'SS') },
  { key: 'lsA', name: '리밋-a', group: '입력', make: inputContact('limit', 'a', 'LS') },
  { key: 'lsB', name: '리밋-b', group: '입력', make: inputContact('limit', 'b', 'LS') },

  { key: 'xCoil', name: '릴레이 X', group: '릴레이', make: (c) => ({ kind: 'coil', device: 'relay', tag: nextTag(c, 'X') }) },
  { key: 'xA', name: 'X-a', group: '릴레이', make: linkedContact('relay', 'a', 'X') },
  { key: 'xB', name: 'X-b', group: '릴레이', make: linkedContact('relay', 'b', 'X') },
  { key: 'mcCoil', name: 'MC 코일', group: '릴레이', make: (c) => ({ kind: 'coil', device: 'mc', tag: nextTag(c, 'MC') }) },
  { key: 'mcA', name: 'MC-a', group: '릴레이', make: linkedContact('mc', 'a', 'MC') },
  { key: 'mcB', name: 'MC-b', group: '릴레이', make: linkedContact('mc', 'b', 'MC') },
  { key: 'thrB', name: 'THR-b', group: '릴레이', make: linkedContact('thr', 'b', 'THR') },
  { key: 'thrA', name: 'THR-a', group: '릴레이', make: linkedContact('thr', 'a', 'THR') },

  { key: 'tCoil', name: '타이머 T', group: '타이머·카운터', make: (c) => ({ kind: 'coil', device: 'timer', tag: nextTag(c, 'T'), preset: 3000 }) },
  { key: 'tA', name: 'T-a', group: '타이머·카운터', make: linkedContact('timer', 'a', 'T') },
  { key: 'tB', name: 'T-b', group: '타이머·카운터', make: linkedContact('timer', 'b', 'T') },
  { key: 'cCoil', name: '카운터 C', group: '타이머·카운터', make: (c) => ({ kind: 'coil', device: 'counter', tag: nextTag(c, 'C'), preset: 3 }) },
  { key: 'cReset', name: 'C 리셋', group: '타이머·카운터', make: (c) => ({ kind: 'coil', device: 'counterReset', tag: latestTag(c, 'C') }) },
  { key: 'cA', name: 'C-a', group: '타이머·카운터', make: linkedContact('counter', 'a', 'C') },
  { key: 'cB', name: 'C-b', group: '타이머·카운터', make: linkedContact('counter', 'b', 'C') },

  { key: 'RL', name: '적색등 RL', group: '출력', make: lamp('RL') },
  { key: 'GL', name: '녹색등 GL', group: '출력', make: lamp('GL') },
  { key: 'YL', name: '황색등 YL', group: '출력', make: lamp('YL') },
  { key: 'WL', name: '백색등 WL', group: '출력', make: lamp('WL') },
  { key: 'bz', name: '부저 BZ', group: '출력', make: (c) => ({ kind: 'buzzer', tag: tagsOf(c).includes('BZ') ? nextTag(c, 'BZ') : 'BZ' }) },

  { key: 'busR', name: 'L1상', group: '주회로', make: bus('R') },
  { key: 'busS', name: 'L2상', group: '주회로', make: bus('S') },
  { key: 'busT', name: 'L3상', group: '주회로', make: bus('T') },
  { key: 'mccb', name: 'MCCB', group: '주회로', make: (c) => ({ kind: 'mccb', tag: tagsOf(c).includes('MCCB') ? nextTag(c, 'MCCB') : 'MCCB' }) },
  { key: 'mcMain', name: 'MC 주접점', group: '주회로', make: (c) => ({ kind: 'mcMain', tag: latestTag(c, 'MC') }) },
  { key: 'thrHeater', name: 'THR 히터', group: '주회로', make: (c) => ({ kind: 'thrHeater', tag: nextTag(c, 'THR'), tripTime: 5000 }) },
  { key: 'motor', name: '전동기 M', group: '주회로', make: (c) => ({ kind: 'motor', tag: nextTag(c, 'M') }) },
]

/** 팔레트 아이콘 미리보기용 부품 */
export function previewComponent(item: PaletteItem): Component {
  const empty: Circuit = { version: 1, name: '', components: [], wires: [] }
  return { ...item.make(empty), id: 'preview', x: 0, y: 0, rot: 0 } as Component
}
