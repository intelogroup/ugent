import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional falsy values', () => {
    expect(cn('base', false && 'hidden', null, undefined)).toBe('base');
  });

  it('deduplicates tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('returns empty string when no args', () => {
    expect(cn()).toBe('');
  });
});
