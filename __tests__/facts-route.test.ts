import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-server', () => ({
  isAuthenticated: vi.fn(),
}));

vi.mock('@/lib/facts-agent', () => ({
  generateFacts: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (_fn: unknown, _key: unknown, _opts: unknown) => _fn,
}));

import { isAuthenticated } from '@/lib/auth-server';
import { generateFacts } from '@/lib/facts-agent';

describe('GET /api/facts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    vi.resetModules();
    const { GET } = await import('@/app/api/facts/route');
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns facts when authenticated', async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(generateFacts).mockResolvedValue(['Fact A', 'Fact B'] as any);
    vi.resetModules();
    const { GET } = await import('@/app/api/facts/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.facts).toEqual(['Fact A', 'Fact B']);
  });

  it('returns 500 when fact generation throws', async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(generateFacts).mockRejectedValue(new Error('AI error'));
    vi.resetModules();
    const { GET } = await import('@/app/api/facts/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to generate facts');
  });
});
