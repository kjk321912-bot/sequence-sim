// 부품 팔레트 정의와 번호(tag) 규칙
//
// 번호 규칙
// - 코일·입력 장치는 새로 놓을 때마다 다음 번호 (X1 → X2, PB1 → PB2)
// - 접점은 같은 계열 코일 중 가장 최근 번호를 따른다 (X2 코일을 놓은 뒤 X 접점을 놓으면 X2)
// - EOCR·FR·FLS·BZ처럼 보통 하나만 쓰는 기기는 번호 없이 시작 (두 번째부터 EOCR2 …)
// 놓은 뒤에는 속성 창에서 번호를 직접 입력하거나 같은 계열 번호 중에서 고를 수 있다.

import type { Circuit, Component, ContactDevice, LampColor, Phase } from '../engine'

type NewComp = Component extends infer C ? (C extends Component ? Omit<C, 'id' | 'x' | 'y' | 'rot'> : never) : never

export type PaletteGroup = '전원' | '입력' | '릴레이' | '타이머·카운터' | '보호계전기' | '출력' | '주회로'
export const PALETTE_GROUPS: PaletteGroup[] = ['전원', '입력', '릴레이', '타이머·카운터', '보호계전기', '출력', '주회로']

export interface PaletteItem {
  key: string
  name: string
  group: PaletteGroup
  make: (circuit: Circuit) => NewComp
}

// ─── 번호 계열 ─────────────────────────────────────────

/**
 * 번호 계열: 같은 계열끼리 번호를 공유한다.
 * 예) 릴레이 코일 X1과 릴레이 접점 X1-a·X1-b는 'relay' 계열, 타이머 코일·한시접점·순시접점은 'timer' 계열
 */
export type TagFamily =
  | 'pb'
  | 'selector'
  | 'limit'
  | 'relay'
  | 'mc'
  | 'timer'
  | 'counter'
  | 'flicker'
  | 'thr'
  | 'eocr'
  | 'fls'
  | 'lamp'
  | 'buzzer'
  | 'mccb'
  | 'motor'
  | 'fuse'
  | 'terminalBlock'

const CONTACT_FAMILY: Record<ContactDevice, TagFamily> = {
  pb: 'pb',
  selector: 'selector',
  limit: 'limit',
  relay: 'relay',
  mc: 'mc',
  timer: 'timer',
  timerInst: 'timer',
  counter: 'counter',
  flicker: 'flicker',
  thr: 'thr',
  eocr: 'eocr',
  fls: 'fls',
}

export function tagFamily(c: Component): TagFamily | null {
  switch (c.kind) {
    case 'contact':
      return CONTACT_FAMILY[c.device]
    case 'coil':
      return c.device === 'counterReset' ? 'counter' : c.device
    case 'mcMain':
      return 'mc'
    case 'thrHeater':
      return c.relay === 'eocr' ? 'eocr' : 'thr'
    case 'lamp':
    case 'buzzer':
    case 'mccb':
    case 'motor':
    case 'fls':
    case 'fuse':
    case 'terminalBlock':
      return c.kind === 'lamp' ? 'lamp' : c.kind
    case 'bus':
    case 'ground':
      return null
  }
}

/** 계열별 기본 머리글자 */
export const FAMILY_PREFIX: Record<TagFamily, string> = {
  pb: 'PB',
  selector: 'SS',
  limit: 'LS',
  relay: 'X',
  mc: 'MC',
  timer: 'T',
  counter: 'C',
  flicker: 'FR',
  thr: 'THR',
  eocr: 'EOCR',
  fls: 'FLS',
  lamp: 'L',
  buzzer: 'BZ',
  mccb: 'MCCB',
  motor: 'M',
  fuse: 'F',
  terminalBlock: 'TB',
}

/** 회로에서 해당 계열이 쓰는 번호 목록 (놓인 순서, 중복 제거) */
export function familyTags(circuit: Circuit, family: TagFamily, exceptId?: string): string[] {
  const out: string[] = []
  for (const c of circuit.components) {
    if (c.id === exceptId || !('tag' in c)) continue
    if (tagFamily(c) === family && !out.includes(c.tag)) out.push(c.tag)
  }
  return out
}

/** 회로에 쓰인 모든 tag */
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
  const re = new RegExp(`^${prefix}\\d*$`)
  const found = tagsOf(circuit).filter((t) => re.test(t))
  return found[found.length - 1] ?? `${prefix}1`
}

/** 번호 없는 이름부터 시작 (EOCR → EOCR2 → EOCR3) */
function plainOrNext(circuit: Circuit, base: string): string {
  if (!tagsOf(circuit).includes(base)) return base
  let n = 2
  while (tagsOf(circuit).includes(`${base}${n}`)) n++
  return `${base}${n}`
}

/** 가장 최근의 해당 이름 (없으면 base) — 번호 없는 기기의 접점용 */
function latestPlain(circuit: Circuit, base: string): string {
  const re = new RegExp(`^${base}\\d*$`)
  const found = tagsOf(circuit).filter((t) => re.test(t))
  return found[found.length - 1] ?? base
}

/** 보통 하나만 쓰는 기기: 번호 없는 이름부터 */
const PLAIN_FAMILIES: TagFamily[] = ['selector', 'flicker', 'eocr', 'fls', 'buzzer', 'mccb', 'lamp']

/** 속성 창의 "새 번호" 추천 */
export function suggestTag(circuit: Circuit, family: TagFamily, lampColor?: string): string {
  const prefix = family === 'lamp' ? (lampColor ?? 'RL') : FAMILY_PREFIX[family]
  return PLAIN_FAMILIES.includes(family) ? plainOrNext(circuit, prefix) : nextTag(circuit, prefix)
}

// ─── 팔레트 항목 ───────────────────────────────────────

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

/** 번호 없이 쓰는 기기의 접점 (EOCR, FR, FLS) */
const plainContact = (device: ContactDevice, type: 'a' | 'b', base: string) => (c: Circuit): NewComp => ({
  kind: 'contact',
  device,
  type,
  tag: latestPlain(c, base),
})

const bus = (phase: Phase) => (): NewComp => ({ kind: 'bus', phase, length: 24 })

const lamp = (color: LampColor) => (c: Circuit): NewComp => ({ kind: 'lamp', color, tag: plainOrNext(c, color) })

export const PALETTE: PaletteItem[] = [
  { key: 'busP', name: 'P모선', group: '전원', make: bus('P') },
  { key: 'busN', name: 'N모선', group: '전원', make: bus('N') },
  { key: 'fuse', name: '퓨즈', group: '전원', make: (c) => ({ kind: 'fuse', tag: nextTag(c, 'F') }) },
  { key: 'ground', name: '접지 PE', group: '전원', make: () => ({ kind: 'ground' }) },
  { key: 'tb4', name: '단자대', group: '전원', make: (c) => ({ kind: 'terminalBlock', tag: nextTag(c, 'TB'), labels: ['1', '2', '3', '4'] }) },

  { key: 'pbA', name: 'PB-a', group: '입력', make: inputContact('pb', 'a', 'PB') },
  { key: 'pbB', name: 'PB-b', group: '입력', make: inputContact('pb', 'b', 'PB') },
  { key: 'ssA', name: '셀렉터-a', group: '입력', make: (c) => ({ kind: 'contact', device: 'selector', type: 'a', tag: plainOrNext(c, 'SS') }) },
  { key: 'ssB', name: '셀렉터-b', group: '입력', make: plainContact('selector', 'b', 'SS') },
  { key: 'lsA', name: '리밋-a', group: '입력', make: inputContact('limit', 'a', 'LS') },
  { key: 'lsB', name: '리밋-b', group: '입력', make: inputContact('limit', 'b', 'LS') },
  { key: 'fls', name: '플로트레스', group: '입력', make: (c) => ({ kind: 'fls', tag: plainOrNext(c, 'FLS') }) },
  { key: 'flsA', name: 'FLS-a', group: '입력', make: plainContact('fls', 'a', 'FLS') },
  { key: 'flsB', name: 'FLS-b', group: '입력', make: plainContact('fls', 'b', 'FLS') },

  { key: 'xCoil', name: '릴레이 X', group: '릴레이', make: (c) => ({ kind: 'coil', device: 'relay', tag: nextTag(c, 'X') }) },
  { key: 'xA', name: 'X-a', group: '릴레이', make: linkedContact('relay', 'a', 'X') },
  { key: 'xB', name: 'X-b', group: '릴레이', make: linkedContact('relay', 'b', 'X') },
  { key: 'mcCoil', name: 'MC 코일', group: '릴레이', make: (c) => ({ kind: 'coil', device: 'mc', tag: nextTag(c, 'MC') }) },
  { key: 'mcA', name: 'MC-a', group: '릴레이', make: linkedContact('mc', 'a', 'MC') },
  { key: 'mcB', name: 'MC-b', group: '릴레이', make: linkedContact('mc', 'b', 'MC') },

  { key: 'tCoil', name: '타이머 T', group: '타이머·카운터', make: (c) => ({ kind: 'coil', device: 'timer', tag: nextTag(c, 'T'), preset: 3000 }) },
  { key: 'tA', name: 'T 한시-a', group: '타이머·카운터', make: linkedContact('timer', 'a', 'T') },
  { key: 'tB', name: 'T 한시-b', group: '타이머·카운터', make: linkedContact('timer', 'b', 'T') },
  { key: 'tiA', name: 'T 순시-a', group: '타이머·카운터', make: linkedContact('timerInst', 'a', 'T') },
  { key: 'tiB', name: 'T 순시-b', group: '타이머·카운터', make: linkedContact('timerInst', 'b', 'T') },
  { key: 'frCoil', name: '플리커 FR', group: '타이머·카운터', make: (c) => ({ kind: 'coil', device: 'flicker', tag: plainOrNext(c, 'FR'), preset: 1000 }) },
  { key: 'frA', name: 'FR-a', group: '타이머·카운터', make: plainContact('flicker', 'a', 'FR') },
  { key: 'frB', name: 'FR-b', group: '타이머·카운터', make: plainContact('flicker', 'b', 'FR') },
  { key: 'cCoil', name: '카운터 C', group: '타이머·카운터', make: (c) => ({ kind: 'coil', device: 'counter', tag: nextTag(c, 'C'), preset: 3 }) },
  { key: 'cReset', name: 'C 리셋', group: '타이머·카운터', make: (c) => ({ kind: 'coil', device: 'counterReset', tag: latestTag(c, 'C') }) },
  { key: 'cA', name: 'C-a', group: '타이머·카운터', make: linkedContact('counter', 'a', 'C') },
  { key: 'cB', name: 'C-b', group: '타이머·카운터', make: linkedContact('counter', 'b', 'C') },

  { key: 'eocrPower', name: 'EOCR 전원', group: '보호계전기', make: (c) => ({ kind: 'coil', device: 'eocr', tag: latestPlain(c, 'EOCR') }) },
  { key: 'eocrA', name: 'EOCR-a', group: '보호계전기', make: plainContact('eocr', 'a', 'EOCR') },
  { key: 'eocrB', name: 'EOCR-b', group: '보호계전기', make: plainContact('eocr', 'b', 'EOCR') },
  { key: 'thrA', name: 'THR-a', group: '보호계전기', make: linkedContact('thr', 'a', 'THR') },
  { key: 'thrB', name: 'THR-b', group: '보호계전기', make: linkedContact('thr', 'b', 'THR') },

  { key: 'RL', name: '적색등 RL', group: '출력', make: lamp('RL') },
  { key: 'GL', name: '녹색등 GL', group: '출력', make: lamp('GL') },
  { key: 'YL', name: '황색등 YL', group: '출력', make: lamp('YL') },
  { key: 'WL', name: '백색등 WL', group: '출력', make: lamp('WL') },
  { key: 'bz', name: '부저 BZ', group: '출력', make: (c) => ({ kind: 'buzzer', tag: plainOrNext(c, 'BZ') }) },

  { key: 'busR', name: 'L1상', group: '주회로', make: bus('R') },
  { key: 'busS', name: 'L2상', group: '주회로', make: bus('S') },
  { key: 'busT', name: 'L3상', group: '주회로', make: bus('T') },
  { key: 'mccb', name: 'MCCB', group: '주회로', make: (c) => ({ kind: 'mccb', tag: plainOrNext(c, 'MCCB') }) },
  { key: 'mcMain', name: 'MC 주접점', group: '주회로', make: (c) => ({ kind: 'mcMain', tag: latestTag(c, 'MC') }) },
  {
    key: 'eocrMain',
    name: 'EOCR(주회로)',
    group: '주회로',
    make: (c) => ({ kind: 'thrHeater', relay: 'eocr', tag: plainOrNext(c, 'EOCR'), tripTime: 3000 }),
  },
  { key: 'thrHeater', name: 'THR 히터', group: '주회로', make: (c) => ({ kind: 'thrHeater', relay: 'thr', tag: nextTag(c, 'THR'), tripTime: 5000 }) },
  { key: 'motor', name: '전동기 M', group: '주회로', make: (c) => ({ kind: 'motor', tag: nextTag(c, 'M') }) },
  { key: 'tbMotor', name: '전동기 단자대', group: '주회로', make: (c) => ({ kind: 'terminalBlock', tag: nextTag(c, 'TB'), labels: ['U', 'V', 'W', 'PE'] }) },
]

/** 팔레트 아이콘 미리보기용 부품 */
export function previewComponent(item: PaletteItem): Component {
  const empty: Circuit = { version: 1, name: '', components: [], wires: [] }
  return { ...item.make(empty), id: 'preview', x: 0, y: 0, rot: 0 } as Component
}
