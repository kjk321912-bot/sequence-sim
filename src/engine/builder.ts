// 코드로 회로를 조립하는 도우미 (테스트·내장 예제용)

import { TWO_TERMINAL_SPAN } from './geometry'
import {
  CIRCUIT_VERSION,
  type Circuit,
  type CoilDevice,
  type Component,
  type ContactDevice,
  type Fault,
  type LampColor,
  type Phase,
} from './model'

type XY = [number, number]
type NoId<T> = T extends Component ? Omit<T, 'id' | 'rot'> & { rot?: Component['rot'] } : never

export class CircuitBuilder {
  private components: Component[] = []
  private wires: Circuit['wires'] = []
  private faults: Fault[] = []
  private seq = 0

  add(c: NoId<Component>): string {
    const id = `c${++this.seq}`
    this.components.push({ rot: 0, ...c, id } as Component)
    return id
  }

  bus(phase: Phase, x: number, y: number, length: number) {
    return this.add({ kind: 'bus', phase, x, y, length })
  }

  contact(x: number, y: number, device: ContactDevice, type: 'a' | 'b', tag: string) {
    return this.add({ kind: 'contact', x, y, device, type, tag })
  }

  coil(x: number, y: number, device: CoilDevice, tag: string, preset?: number) {
    return this.add({ kind: 'coil', x, y, device, tag, ...(preset !== undefined ? { preset } : {}) })
  }

  lamp(x: number, y: number, color: LampColor, tag: string = color) {
    return this.add({ kind: 'lamp', x, y, color, tag })
  }

  wire(...points: XY[]): string {
    const id = `w${++this.seq}`
    this.wires.push({ id, points: points.map(([x, y]) => ({ x, y })) })
    return id
  }

  fault(f: Fault) {
    this.faults.push(f)
  }

  /**
   * 세로 한 줄(가로선 하나의 "회로 줄")을 만든다.
   * yTop(P모선)에서 yBottom(N모선)까지 부품을 위에서부터 차례로 붙여 놓고 남는 곳은 배선으로 잇는다.
   * 반환값은 각 부품의 id와 위쪽 핀 y좌표.
   */
  rung(x: number, yTop: number, yBottom: number, parts: ((x: number, y: number) => string)[]) {
    let y = yTop + 1
    this.wire([x, yTop], [x, y])
    const placed = parts.map((make) => {
      const id = make(x, y)
      const top = y
      y += TWO_TERMINAL_SPAN
      return { id, top }
    })
    this.wire([x, y], [x, yBottom])
    return placed
  }

  build(name = '테스트 회로'): Circuit {
    return {
      version: CIRCUIT_VERSION,
      name,
      components: structuredClone(this.components),
      wires: structuredClone(this.wires),
      ...(this.faults.length ? { faults: structuredClone(this.faults) } : {}),
    }
  }
}
