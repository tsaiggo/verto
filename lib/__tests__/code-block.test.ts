import { describe, it, expect } from 'vitest';
import { stripNotationComments } from '@/components/mdx/CodeBlock';

describe('stripNotationComments', () => {
  it('removes // [!code ++] markers', () => {
    const input = `const a = 1; // [!code ++]\nconst b = 2;`;
    expect(stripNotationComments(input)).toBe(`const a = 1;\nconst b = 2;`);
  });

  it('removes # [!code highlight] markers', () => {
    const input = `print("x") # [!code highlight]`;
    expect(stripNotationComments(input)).toBe(`print("x")`);
  });

  it('removes <!-- [!code focus] --> markers', () => {
    const input = `<div /> <!-- [!code focus] -->`;
    expect(stripNotationComments(input)).toBe(`<div />`);
  });

  it('removes /* [!code --] */ block markers', () => {
    const input = `const x = 1; /* [!code --] */`;
    expect(stripNotationComments(input)).toBe(`const x = 1;`);
  });

  it('leaves real comments untouched', () => {
    const input = `// real comment\nconst x = 1; // not a marker`;
    expect(stripNotationComments(input)).toBe(input);
  });

  it('handles multi-line input', () => {
    const input = [
      'const a = 1; // [!code ++]',
      'const b = 2; // [!code --]',
      'const c = 3;',
    ].join('\n');
    const expected = ['const a = 1;', 'const b = 2;', 'const c = 3;'].join('\n');
    expect(stripNotationComments(input)).toBe(expected);
  });
});
