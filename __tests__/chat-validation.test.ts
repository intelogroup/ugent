import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: vi.fn(),
}));

vi.mock('@/lib/pinecone', () => ({
  getContext: vi.fn(),
  getImages: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model'),
}));

vi.mock('ai', () => ({
  streamText: vi.fn(),
  StreamData: class {
    appendMessageAnnotation = vi.fn();
    close = vi.fn();
  },
}));

import { withAuth } from '@workos-inc/authkit-nextjs';

describe('POST /api/chat — Zod validation (B2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Auth passes so Zod validation runs — a 400 proves Zod rejected before Pinecone/OpenAI
    vi.mocked(withAuth).mockResolvedValue({ user: { email: 'test@example.com' }, accessToken: 'tok' } as any);
  });

  const makeRequest = (body: unknown) =>
    new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

  it('returns 400 when messages is an empty array', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when a message is missing the role field', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest({ messages: [{ content: 'hello' }] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when messages is not an array (string)', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest({ messages: 'not-an-array' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when messages is not an array (object)', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest({ messages: { role: 'user', content: 'hi' } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request');
  });

  it('reaches auth check with valid messages (returns 401 when auth mock returns unauthenticated)', async () => {
    // Override auth to return null user so we get a clean 401 proving Zod passed
    vi.mocked(withAuth).mockResolvedValue({ user: null, accessToken: null } as any);
    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      makeRequest({ messages: [{ role: 'user', content: 'valid message' }] })
    );
    // A 401 here confirms the request was not rejected by Zod
    expect(res.status).toBe(401);
  });
});
