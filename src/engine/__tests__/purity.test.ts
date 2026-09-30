import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 엔진은 React·DOM과 완전히 분리되어야 한다 (CLAUDE.md 설계 원칙 1)
describe('엔진 분리 규칙', () => {
  const dir = join(import.meta.dirname, '..')
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'))

  it.each(files)('%s 는 React·Konva·DOM에 의존하지 않는다', (file) => {
    const src = readFileSync(join(dir, file), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|react-konva|konva|zustand)/)
    expect(src).not.toMatch(/\b(window|document|Date\.now|performance\.now)\b/)
  })
})
