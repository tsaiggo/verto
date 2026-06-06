import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { renderToStaticMarkup } from 'react-dom/server'

describe('compileMDXContent helper', () => {
  it('exists and is exported from lib/mdx', async () => {
    const mod = await import('@/lib/mdx');
    expect(typeof mod.compileMDXContent).toBe('function');
  });

  it('renders open Accordion content inside AccordionGroup through the MDX pipeline', async () => {
    const { compileMDXContent } = await import('@/lib/mdx');
    const { content } = await compileMDXContent(`
<AccordionGroup>
  <Accordion title="First panel" defaultOpen>First body</Accordion>
  <Accordion title="Second panel">Second body</Accordion>
</AccordionGroup>
`);

    const html = renderToStaticMarkup(content);

    expect(html).toContain('First panel');
    expect(html).toContain('Second panel');
    expect(html).toContain('First body');
  });

  it('renders active Tab content inside Tabs through the MDX pipeline', async () => {
    const { compileMDXContent } = await import('@/lib/mdx');
    const { content } = await compileMDXContent(`
<Tabs defaultValue="usage">
  <Tab label="Install">npm install verto</Tab>
  <Tab label="Usage">Run the reader</Tab>
</Tabs>
`);

    const html = renderToStaticMarkup(content);

    expect(html).toContain('Install');
    expect(html).toContain('Usage');
    expect(html).toContain('Run the reader');
  });

});

describe('getDocumentBySlug', () => {
  it('returns null for nonexistent slug', async () => {
    const { getDocumentBySlug } = await import('@/lib/mdx');
    const result = await getDocumentBySlug(['nonexistent', 'definitely-missing-path']);
    expect(result).toBeNull();
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
