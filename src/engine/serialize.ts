// 회로 파일 저장·불러오기 (과제 배포, 학생 제출)
// 불러올 때는 형식을 검사해서 잘못된 파일이면 이유를 알려 준다.

import { CIRCUIT_VERSION, type Circuit, type Component, type ComponentKind } from './model'

export const FILE_EXTENSION = '.seq.json'

/** 파일로 저장할 문자열 */
export function stringifyCircuit(c: Circuit): string {
  return JSON.stringify({ ...c, version: CIRCUIT_VERSION }, null, 1)
}

export type ParseResult = { ok: true; circuit: Circuit } | { ok: false; error: string }

const KINDS: ComponentKind[] = [
  'bus',
  'contact',
  'coil',
  'lamp',
  'buzzer',
  'mccb',
  'mcMain',
  'thrHeater',
  'motor',
  'fls',
  'fuse',
  'terminalBlock',
  'ground',
]

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** 파일 내용을 회로로 읽는다 */
export function parseCircuit(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: '회로 파일 형식이 아닙니다 (JSON을 읽을 수 없음)' }
  }
  if (!isObj(data)) return { ok: false, error: '회로 파일 형식이 아닙니다' }
  if (!isNum(data.version)) return { ok: false, error: '회로 파일 버전 정보가 없습니다' }
  if (data.version > CIRCUIT_VERSION) {
    return { ok: false, error: '더 새로운 버전의 앱에서 만든 파일입니다. 앱을 업데이트해 주세요' }
  }
  if (!Array.isArray(data.components) || !Array.isArray(data.wires)) {
    return { ok: false, error: '부품 또는 배선 목록이 없습니다' }
  }

  const ids = new Set<string>()
  for (const [i, c] of data.components.entries()) {
    if (!isObj(c) || typeof c.id !== 'string' || !KINDS.includes(c.kind as ComponentKind) || !isNum(c.x) || !isNum(c.y)) {
      return { ok: false, error: `${i + 1}번째 부품 정보가 올바르지 않습니다` }
    }
    if (![0, 90, 180, 270].includes(c.rot as number)) c.rot = 0
    if (ids.has(c.id)) return { ok: false, error: `부품 id가 겹칩니다: ${c.id}` }
    ids.add(c.id)
  }
  for (const [i, w] of data.wires.entries()) {
    if (!isObj(w) || typeof w.id !== 'string' || !Array.isArray(w.points) || w.points.length < 2) {
      return { ok: false, error: `${i + 1}번째 배선 정보가 올바르지 않습니다` }
    }
    if (!w.points.every((p) => isObj(p) && isNum(p.x) && isNum(p.y))) {
      return { ok: false, error: `${i + 1}번째 배선 좌표가 올바르지 않습니다` }
    }
    if (ids.has(w.id)) return { ok: false, error: `배선 id가 겹칩니다: ${w.id}` }
    ids.add(w.id)
  }

  let task: Circuit['task']
  if (data.task !== undefined) {
    const t = data.task
    const stepOk = (s: unknown) =>
      isObj(s) &&
      ((s.kind === 'wait' && isNum(s.ms)) ||
        (s.kind === 'action' && isObj(s.action) && typeof s.action.tag === 'string' && typeof s.action.type === 'string') ||
        (s.kind === 'check' && Array.isArray(s.expect)))
    if (!isObj(t) || typeof t.title !== 'string' || typeof t.description !== 'string' || !Array.isArray(t.steps) || !t.steps.every(stepOk)) {
      return { ok: false, error: '과제 정보가 올바르지 않습니다' }
    }
    task = t as unknown as Circuit['task']
  }

  return {
    ok: true,
    circuit: {
      version: CIRCUIT_VERSION,
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '불러온 회로',
      components: data.components as unknown as Component[],
      wires: data.wires as unknown as Circuit['wires'],
      ...(Array.isArray(data.faults) ? { faults: data.faults as Circuit['faults'] } : {}),
      ...(task ? { task } : {}),
      ...(isObj(data.faultInfo) && typeof data.faultInfo.title === 'string' && typeof data.faultInfo.description === 'string'
        ? { faultInfo: { title: data.faultInfo.title, description: data.faultInfo.description } }
        : {}),
    },
  }
}
