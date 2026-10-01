// 시뮬레이션 엔진 공개 API (UI는 이 파일을 통해서만 엔진을 사용한다)

export * from './model'
export { pinsOf, polesOf, busSegment, rotate, onSegment, pointKey, TWO_TERMINAL_SPAN, POLE_PITCH, type Pin } from './geometry'
export { buildGraph, terminalKey, type Graph } from './netlist'
export { solve, isPowered, type Solution, type WireSegment, type WireState, type MotorRun, type Potential } from './solver'
export { applyAction, initialState, resetKey, powerKey, type Action, type SimState } from './state'
export { step, operate, contactActivity, Simulator, MAX_ITERATIONS, type StepResult } from './scan'
export { CircuitBuilder } from './builder'
export { parseCircuit, stringifyCircuit, FILE_EXTENSION, type ParseResult } from './serialize'
export { missingPower, type PowerCause } from './hints'
export {
  makeTask,
  gradeTask,
  readOutputs,
  starterCircuit,
  partsSummary,
  describeStep,
  outputText,
  scriptFromRecording,
  TASK_STEP_MS,
  type ScriptItem,
  type Grade,
  type CheckResult,
  type CheckItem,
} from './task'
export { probeNode, measureVoltage, measureResistance, isProbePoint, type VoltReading, type OhmReading, type OhmResult } from './tester'
export {
  FAULT_KIND_TEXT,
  componentLabel,
  wireLabel,
  faultLabel,
  faultKindsFor,
  makeFault,
  matchFault,
  randomFaults,
} from './diagnosis'
