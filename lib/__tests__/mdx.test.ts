import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'

describe('compileMDXContent helper', () => {
  it('exists and is exported from lib/mdx', async () => {
    const mod = await import('@/lib/mdx');
    expect(typeof mod.compileMDXContent).toBe('function');
  });
});

describe('getDocBySlug', () => {
  it('throws for nonexistent slug', async () => {
    const { getDocBySlug } = await import('@/lib/mdx');
    await expect(getDocBySlug(['nonexistent', 'path'])).rejects.toThrow();
  });
});

describe('gray-matter frontmatter parsing', () => {
  it('parses blog frontmatter correctly', async () => {
    const raw = await fs.readFile(path.join(process.cwd(), 'test/fixtures/sample-blog.mdx'), 'utf-8')
    const { data } = matter(raw)
    expect(data.title).toBe('Test Blog Post')
    expect(data.date).toBe('2026-01-15')  // string, not Date
    expect(data.tags).toEqual(['test', 'vitest'])
    expect(typeof data.author).toBe('string')
  })

  it('parses doc frontmatter correctly', async () => {
    const raw = await fs.readFile(path.join(process.cwd(), 'test/fixtures/sample-doc.mdx'), 'utf-8')
    const { data } = matter(raw)
    expect(data.title).toBe('Test Document')
    expect(data.description).toBe('A test document for vitest')
    expect(data.order).toBe(1)
  })

  it('returns empty data for missing frontmatter', async () => {
    const raw = await fs.readFile(path.join(process.cwd(), 'test/fixtures/invalid.mdx'), 'utf-8')
    const { data } = matter(raw)
    expect(Object.keys(data).length).toBe(0)
  })

  it('handles colons in quoted values', () => {
    const raw = '---\ntitle: "Building Verto: A Guide"\n---\nContent'
    const { data } = matter(raw)
    expect(data.title).toBe('Building Verto: A Guide')
  })
})
