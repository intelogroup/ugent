import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-server', () => ({
  isAuthenticated: vi.fn(),
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

import { isAuthenticated } from '@/lib/auth-server';
import { getContext, getImages } from '@/lib/pinecone';
import { streamText } from 'ai';

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeRequest = (body: object = { messages: [{ role: 'user', content: 'test' }] }) =>
    new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('does not return 401 when authenticated (passes auth check)', async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(getContext).mockResolvedValue([]);
    vi.mocked(getImages).mockResolvedValue([]);
    vi.mocked(streamText).mockReturnValue({
      toDataStreamResponse: vi.fn(() => new Response('stream', { status: 200 })),
    } as any);

    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest());
    // Auth guard passed — response is not 401 (may be 200 or 500 depending on AI mock depth)
    expect(res.status).not.toBe(401);
    // Confirm Pinecone was reached (auth guard did not short-circuit)
    expect(getContext).toHaveBeenCalledOnce();
  });
});
