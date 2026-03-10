import { describe, it, expect } from 'vitest'
import type { TOCItem } from '@/lib/types'

describe('Vitest Setup', () => {
  it('runs correctly', () => {
    expect(1 + 1).toBe(2)
  })

  it('resolves @/ path alias', () => {
    const item: TOCItem = { id: 'test', text: 'Test', level: 2 }
    expect(item.id).toBe('test')
  })
})
