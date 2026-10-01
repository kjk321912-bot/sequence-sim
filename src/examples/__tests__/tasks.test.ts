import { describe, expect, it } from 'vitest'
import { gradeTask } from '../../engine'
import { EXAMPLES } from '../index'
import { BUILTIN_TASKS } from '../tasks'

describe('기본 과제', () => {
  it.each(BUILTIN_TASKS.map((t) => [t.title, t] as const))('%s: 정답 회로는 합격, 시작 회로는 불합격', (_, t) => {
    const start = t.make()
    const task = start.task!
    expect(task.steps.some((s) => s.kind === 'check')).toBe(true)
    // 정답 회로 = 같은 이름의 예제
    const answer = EXAMPLES.find((e) => e.key === t.key)!.make()
    const ok = gradeTask(answer, task)
    expect(ok.problems).toEqual([])
    expect(ok.passed).toBe(true)
    expect(gradeTask(start, task).passed).toBe(false)
  })

  it('시나리오 중 단락·발진이 없다', () => {
    for (const t of BUILTIN_TASKS) {
      const answer = EXAMPLES.find((e) => e.key === t.key)!.make()
      const g = gradeTask(answer, t.make().task!)
      expect(g.checks.flatMap((c) => c.notes), t.title).toEqual([])
    }
  })
})
