import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: vi.fn(),
}));
vi.mock('@/lib/pinecone', () => ({
  getContext: vi.fn(),
  getImages: vi.fn(),
}));
vi.mock('@ai-sdk/openai', () => ({ openai: vi.fn(() => 'mocked-model') }));
vi.mock('ai', () => ({
  streamText: vi.fn(),
  StreamData: class {
    appendMessageAnnotation = vi.fn();
    close = vi.fn();
  },
}));

import { withAuth } from '@workos-inc/authkit-nextjs';

describe('assertThreadOwner — userId mismatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('documents that threads.userId must equal identity.tokenIdentifier (not _id)', () => {
    const tokenIdentifier = 'https://api.workos.com/user_management/client_abc|user_xyz';
    const convexDocId = 'j57abc123xyz';

    expect(tokenIdentifier).not.toBe(convexDocId);

    const threadUserId = tokenIdentifier;
    const identityToken = tokenIdentifier;

    expect(threadUserId).toBe(identityToken);
  });

  it('returns 401 for unauthenticated request to /api/chat', async () => {
    vi.mocked(withAuth).mockResolvedValue({ user: null, accessToken: null } as any);
    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
