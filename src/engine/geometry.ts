// 부품의 핀(단자) 위치 정의
// 도면은 P모선이 위, N모선이 아래인 세로 방식이므로 부품 기본 방향도 세로(위 단자 → 아래 단자)다.

import type { Component, Point, Rotation } from './model'

/** 2단자 부품의 세로 길이(격자 칸) */
export const TWO_TERMINAL_SPAN = 3
/** 3극 부품의 극 간격(격자 칸) */
export const POLE_PITCH = 2

export interface Pin {
  /** 핀 이름. 2단자: '1'(위) '2'(아래), 3극: 'L1'~'L3'(위) 'T1'~'T3'(아래), 모터: 'U' 'V' 'W' */
  name: string
  x: number
  y: number
}

export function rotate(p: Point, rot: Rotation): Point {
  switch (rot) {
    case 0:
      return { x: p.x, y: p.y }
    case 90:
      return { x: -p.y, y: p.x }
    case 180:
      return { x: -p.x, y: -p.y }
    case 270:
      return { x: p.y, y: -p.x }
  }
}

/** 회전 전 기준 핀 배치 (기준점 0,0 기준) */
function localPins(c: Component): Pin[] {
  switch (c.kind) {
    case 'bus':
      // 모선은 핀 대신 선분 전체가 단자다 (netlist에서 별도 처리)
      return []
    case 'contact':
    case 'coil':
    case 'lamp':
    case 'buzzer':
      return [
        { name: '1', x: 0, y: 0 },
        { name: '2', x: 0, y: TWO_TERMINAL_SPAN },
      ]
    case 'mccb':
    case 'mcMain':
    case 'thrHeater':
      return [0, 1, 2].flatMap((i) => [
        { name: `L${i + 1}`, x: i * POLE_PITCH, y: 0 },
        { name: `T${i + 1}`, x: i * POLE_PITCH, y: TWO_TERMINAL_SPAN },
      ])
    case 'motor':
      return [
        { name: 'U', x: 0, y: 0 },
        { name: 'V', x: POLE_PITCH, y: 0 },
        { name: 'W', x: 2 * POLE_PITCH, y: 0 },
      ]
  }
}

/** 부품 핀의 격자 좌표 (회전·위치 반영) */
export function pinsOf(c: Component): Pin[] {
  return localPins(c).map((p) => {
    const r = rotate(p, c.rot)
    return { name: p.name, x: c.x + r.x, y: c.y + r.y }
  })
}

/** 모선 선분의 양 끝점 */
export function busSegment(c: Component & { kind: 'bus' }): [Point, Point] {
  const end = rotate({ x: c.length, y: 0 }, c.rot)
  return [
    { x: c.x, y: c.y },
    { x: c.x + end.x, y: c.y + end.y },
  ]
}

/**
 * 도체로 동작하는 부품의 극(도통 경로) 목록. [위 핀, 아래 핀] 쌍.
 * 접점·차단기·주접점·히터가 해당한다. 부하(코일·램프 등)는 도체가 아니다.
 */
export function polesOf(c: Component): [string, string][] {
  switch (c.kind) {
    case 'contact':
      return [['1', '2']]
    case 'mccb':
    case 'mcMain':
    case 'thrHeater':
      return [
        ['L1', 'T1'],
        ['L2', 'T2'],
        ['L3', 'T3'],
      ]
    default:
      return []
  }
}

export const pointKey = (p: Point) => `${p.x},${p.y}`

/** 점 p가 선분 a-b 위에 있는가 (직교 선분 전제, 끝점 포함) */
export function onSegment(p: Point, a: Point, b: Point): boolean {
  if (a.x === b.x) return p.x === a.x && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
  if (a.y === b.y) return p.y === a.y && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
  return false
}
