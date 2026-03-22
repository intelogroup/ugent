import { describe, it, expect } from 'vitest';
import { expandChapterQuery } from '../lib/pinecone';

describe('expandChapterQuery', () => {
  // Pathoma — numeric
  it('expands "chapter 1 of Pathoma"', () => {
    const result = expandChapterQuery('chapter 1 of Pathoma');
    expect(result).toContain('Growth Adaptations');
  });

  it('expands "Pathoma chapter 3"', () => {
    const result = expandChapterQuery('Pathoma chapter 3');
    expect(result).toContain('Principles of Neoplasia');
  });

  it('expands "chapter 5 pathoma"', () => {
    const result = expandChapterQuery('chapter 5 pathoma');
    expect(result).toContain('Red Blood Cell Disorders');
  });

  // Pathoma — ordinal
  it('expands "first chapter of pathoma"', () => {
    const result = expandChapterQuery('first chapter of pathoma');
    expect(result).toContain('Growth Adaptations');
  });

  it('expands "second chapter pathoma"', () => {
    const result = expandChapterQuery('second chapter pathoma');
    expect(result).toContain('Inflammation');
  });

  // First Aid — uses First Aid map when explicitly mentioned
  it('expands "first aid chapter 2"', () => {
    const result = expandChapterQuery('first aid chapter 2');
    expect(result).toContain('Biochemistry');
  });

  it('expands "chapter 8 first aid"', () => {
    const result = expandChapterQuery('chapter 8 first aid');
    expect(result).toContain('Cardiovascular');
  });

  // No chapter reference — passes through unchanged
  it('leaves plain content queries unchanged', () => {
    const query = 'What is apoptosis?';
    expect(expandChapterQuery(query)).toBe(query);
  });

  // Out-of-range chapter — passes through unchanged
  it('leaves out-of-range chapter numbers unchanged', () => {
    const query = 'pathoma chapter 99';
    expect(expandChapterQuery(query)).toBe(query);
  });

  // Preserves original query text
  it('preserves original query text when expanding', () => {
    const query = 'chapter 1 of pathoma';
    const result = expandChapterQuery(query);
    expect(result).toContain(query);
  });
});
