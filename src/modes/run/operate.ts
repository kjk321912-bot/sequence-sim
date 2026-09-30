// 실행 모드 조작: 부품을 톡 치면(또는 누르고 있으면) 어떤 조작이 되는가
import type { Action, Component, PowerCause, SimState } from '../../engine'

export type Operation =
  /** 누르는 동안만 동작 (푸시버튼) */
  | { kind: 'momentary'; tag: string }
  /** 톡 칠 때마다 한 번 */
  | { kind: 'tap'; action: Action }

export function operationOf(c: Component, s: SimState): Operation | null {
  const tripAction = (tag: string): Operation => ({
    kind: 'tap',
    action: s.thr[tag]?.tripped ? { type: 'thrReset', tag } : { type: 'thrTrip', tag },
  })
  switch (c.kind) {
    case 'contact':
      switch (c.device) {
        case 'pb':
          return { kind: 'momentary', tag: c.tag }
        case 'selector': // 셀렉터: 수동(M) ↔ 자동(A)
        case 'limit': // 리밋 스위치: 물체가 닿은 상태를 유지하도록 톡 칠 때마다 전환
        case 'fls': // 플로트레스 접점: 수위 감지 ↔ 없음
          return { kind: 'tap', action: { type: 'toggle', tag: c.tag } }
        case 'thr':
        case 'eocr':
          return tripAction(c.tag)
        default:
          return null // 릴레이·타이머 접점은 코일이 움직인다
      }
    case 'fls':
    case 'mccb':
      return { kind: 'tap', action: { type: 'toggle', tag: c.tag } }
    case 'thrHeater':
      return tripAction(c.tag)
    case 'coil':
      return c.device === 'eocr' ? tripAction(c.tag) : null
    case 'fuse':
      return s.blownFuses[c.id] ? { kind: 'tap', action: { type: 'fuseReplace' } } : null
    default:
      return null
  }
}

/** 입력 장치 조작인가 (차단기·보호계전기·퓨즈 조작은 전원 쪽이므로 안내하지 않는다) */
export function isInputAction(c: Component, a: Action): boolean {
  if (a.type !== 'press' && a.type !== 'toggle') return false
  return c.kind === 'contact' || c.kind === 'fls'
}

/** 받침 을/를: 한글은 받침으로, 영문·숫자는 읽는 소리로 정한다 (MCCB를, F1을, EOCR을) */
export function objJosa(word: string): string {
  const ch = word.trim().slice(-1)
  const code = ch.charCodeAt(0)
  let batchim: boolean
  if (code >= 0xac00 && code <= 0xd7a3) batchim = (code - 0xac00) % 28 !== 0
  else if (/[0-9]/.test(ch)) batchim = '013678'.includes(ch) // 영·일·삼·육·칠·팔
  else batchim = /[lmnrLMNR]/.test(ch) // 엘·엠·엔·알
  return word + (batchim ? '을' : '를')
}

/** 전원 없음 원인을 안내 문구로 */
export function powerHintText(causes: PowerCause[]): string | null {
  if (!causes.length) return null
  if (causes.some((c) => c.kind === 'noSource')) {
    return '전원 모선이 없습니다 — 편집 모드에서 P·N 모선(또는 L1·L2·L3)을 놓고 연결하세요'
  }
  const todo = causes.map((c) => {
    switch (c.kind) {
      case 'mccbOff':
        return `${objJosa(c.tags.join(', '))} 먼저 켜세요`
      case 'fuseBlown':
        return `용단된 퓨즈 ${objJosa(c.tags.join(', '))} 톡 쳐서 교체하세요`
      case 'tripped':
        return `트립된 ${objJosa(c.tags.join(', '))} 톡 쳐서 리셋하세요`
      default:
        return ''
    }
  })
  return `조작 전원이 없습니다 — ${todo.join(' · ')}`
}
