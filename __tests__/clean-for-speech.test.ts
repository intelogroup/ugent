import { describe, it, expect } from 'vitest';
import { cleanForSpeech } from '@/lib/clean-for-speech';

describe('cleanForSpeech', () => {
  it('strips [Image: ID] tags', () => {
    expect(cleanForSpeech('Hello [Image: abc123] world')).toBe('Hello  world');
  });

  it('strips markdown images', () => {
    expect(cleanForSpeech('Text ![alt](http://img.png) end')).toBe('Text  end');
  });

  it('replaces markdown links with label only', () => {
    expect(cleanForSpeech('See [First Aid](http://link.com) here')).toBe('See First Aid here');
  });

  it('strips headings', () => {
    expect(cleanForSpeech('## Cardiology\nContent')).toBe('Cardiology Content');
  });

  it('strips bold markers', () => {
    expect(cleanForSpeech('**important** fact')).toBe('important fact');
  });

  it('strips italic markers', () => {
    expect(cleanForSpeech('*mild* finding')).toBe('mild finding');
  });

  it('strips inline code', () => {
    expect(cleanForSpeech('Use `npm run build` to compile')).toBe('Use  to compile');
  });

  it('strips list bullets', () => {
    expect(cleanForSpeech('- item one\n- item two')).toBe('item one item two');
  });

  it('converts double newlines to period-space pause', () => {
    expect(cleanForSpeech('Para one\n\nPara two')).toBe('Para one. Para two');
  });

  it('converts single newlines to spaces', () => {
    expect(cleanForSpeech('Line one\nLine two')).toBe('Line one Line two');
  });

  it('trims leading and trailing whitespace', () => {
    expect(cleanForSpeech('  hello  ')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(cleanForSpeech('')).toBe('');
  });
});
