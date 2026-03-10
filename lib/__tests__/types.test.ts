import { describe, it, expect } from 'vitest';
import type { InlineCommentRefNode, InlineCommentDefNode } from '@/lib/types';

describe('Custom AST Node Types', () => {
  it('InlineCommentRefNode has required fields', () => {
    const node: InlineCommentRefNode = {
      type: 'inlineCommentRef',
      commentId: '1',
      children: [],
    };
    expect(node.type).toBe('inlineCommentRef');
    expect(node.commentId).toBe('1');
    expect(node.children).toEqual([]);
  });

  it('InlineCommentDefNode has required fields', () => {
    const node: InlineCommentDefNode = {
      type: 'inlineCommentDef',
      commentId: '1',
      value: 'A comment about this text',
    };
    expect(node.type).toBe('inlineCommentDef');
    expect(node.commentId).toBe('1');
    expect(node.value).toBe('A comment about this text');
  });
});
