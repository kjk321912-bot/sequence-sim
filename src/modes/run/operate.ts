// 실행 모드 조작: 부품을 톡 치면(또는 누르고 있으면) 어떤 조작이 되는가
import type { Action, Component, SimState } from '../../engine'

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
