import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Convex auth server helpers — these run server-side with a deploy key
vi.mock('@/lib/auth-server', () => ({
  fetchAuthMutation: vi.fn(),
}));

// Mock the generated Convex API so imports resolve in test env
vi.mock('@/convex/_generated/api', () => ({
  api: {
    pushSubscriptions: {
      saveSubscription: 'pushSubscriptions:saveSubscription',
      removeSubscription: 'pushSubscriptions:removeSubscription',
    },
  },
}));

import { GET, POST, DELETE } from '@/app/api/notifications/subscribe/route';
import { fetchAuthMutation } from '@/lib/auth-server';

const VALID_SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'p256dhKey', auth: 'authKey' },
};

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/notifications/subscribe', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/notifications/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 when VAPID_PUBLIC_KEY is not set', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('not configured');
  });

  it('returns publicKey when VAPID_PUBLIC_KEY is set', async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-vapid-public-key';
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.publicKey).toBe('test-vapid-public-key');
    delete process.env.VAPID_PUBLIC_KEY;
  });
});

describe('POST /api/notifications/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAuthMutation).mockResolvedValue(undefined as any);
  });

  it('returns 400 when endpoint is missing', async () => {
    const res = await POST(makeRequest('POST', { keys: VALID_SUB.keys }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when keys are missing', async () => {
    const res = await POST(makeRequest('POST', { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(400);
  });

  it('returns 200 and calls fetchAuthMutation on valid subscription', async () => {
    const res = await POST(makeRequest('POST', VALID_SUB));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(fetchAuthMutation).toHaveBeenCalledOnce();
  });

  it('returns 401 when fetchAuthMutation throws Unauthenticated', async () => {
    vi.mocked(fetchAuthMutation).mockRejectedValue(new Error('Unauthenticated'));
    const res = await POST(makeRequest('POST', VALID_SUB));
    expect(res.status).toBe(401);
  });

  it('returns 500 when fetchAuthMutation throws other error', async () => {
    vi.mocked(fetchAuthMutation).mockRejectedValue(new Error('Database error'));
    const res = await POST(makeRequest('POST', VALID_SUB));
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/notifications/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAuthMutation).mockResolvedValue(undefined as any);
  });

  it('returns 400 when endpoint is missing', async () => {
    const res = await DELETE(makeRequest('DELETE', {}));
    expect(res.status).toBe(400);
  });

  it('returns 200 and calls fetchAuthMutation on valid endpoint', async () => {
    const res = await DELETE(makeRequest('DELETE', { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(fetchAuthMutation).toHaveBeenCalledOnce();
  });

  it('returns 401 when fetchAuthMutation throws Unauthenticated', async () => {
    vi.mocked(fetchAuthMutation).mockRejectedValue(new Error('Unauthenticated'));
    const res = await DELETE(makeRequest('DELETE', { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(401);
  });
});
