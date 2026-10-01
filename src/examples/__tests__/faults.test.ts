import { describe, expect, it } from 'vitest'
import { gradeTask } from '../../engine'
import { FAULT_PROBLEMS } from '../faults'
import { BUILTIN_TASKS } from '../tasks'

/** 고장 문제 키 → 같은 회로의 기본 과제 (f-selfHold → selfHold, f-exam1 → exam01) */
const taskOf = (key: string) => {
  const k = key.replace(/^f-/, '').replace(/^exam(\d+)$/, (_, n: string) => `exam${n.padStart(2, '0')}`)
  return BUILTIN_TASKS.find((t) => t.key === k)!
}

describe('고장진단 기본 문제', () => {
  it.each(FAULT_PROBLEMS.map((p) => [p.title, p] as const))('%s: 고장이 증상을 만들고, 고치면 정상', (_, p) => {
    const c = p.make()
    expect(c.faults!.length).toBeGreaterThan(0)
    expect(c.faultInfo!.description).toMatch(/^증상: /)
    const task = taskOf(p.key).make().task!
    expect(gradeTask(c, task).passed).toBe(false)
    expect(gradeTask({ ...c, faults: [] }, task).passed).toBe(true)
  })
})
