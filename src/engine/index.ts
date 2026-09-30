// 시뮬레이션 엔진 공개 API (UI는 이 파일을 통해서만 엔진을 사용한다)

export * from './model'
export { pinsOf, polesOf, busSegment, rotate, onSegment, pointKey, TWO_TERMINAL_SPAN, POLE_PITCH, type Pin } from './geometry'
export { buildGraph, terminalKey, type Graph } from './netlist'
export { solve, isPowered, type Solution, type WireSegment, type WireState, type MotorRun, type Potential } from './solver'
export { applyAction, initialState, resetKey, powerKey, type Action, type SimState } from './state'
export { step, Simulator, MAX_ITERATIONS, type StepResult } from './scan'
export { CircuitBuilder } from './builder'
export { parseCircuit, stringifyCircuit, FILE_EXTENSION, type ParseResult } from './serialize'
