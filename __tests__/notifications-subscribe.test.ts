import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: vi.fn(),
}));

vi.mock('convex/nextjs', () => ({
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

vi.mock('@/convex/_generated/api', () => ({
  api: {
    auth: { getByEmail: 'auth:getByEmail' },
    pushSubscriptions: {
      saveSubscription: 'pushSubscriptions:saveSubscription',
      removeSubscription: 'pushSubscriptions:removeSubscription',
    },
  },
}));

import { withAuth } from '@workos-inc/authkit-nextjs';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { GET, POST, DELETE } from '@/app/api/notifications/subscribe/route';

const AUTHED = { user: { email: 'test@example.com' }, accessToken: 'tok' };
const CONVEX_USER = { _id: 'users:abc123', email: 'test@example.com' };

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
    vi.mocked(withAuth).mockResolvedValue(AUTHED as any);
    vi.mocked(fetchQuery).mockResolvedValue(CONVEX_USER as any);
    vi.mocked(fetchMutation).mockResolvedValue(undefined as any);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(withAuth).mockResolvedValue({ user: null, accessToken: null } as any);
    const res = await POST(makeRequest('POST', VALID_SUB));
    expect(res.status).toBe(401);
  });

  it('returns 400 when endpoint is missing', async () => {
    const res = await POST(makeRequest('POST', { keys: VALID_SUB.keys }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when keys are missing', async () => {
    const res = await POST(makeRequest('POST', { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found in Convex', async () => {
    vi.mocked(fetchQuery).mockResolvedValue(null as any);
    const res = await POST(makeRequest('POST', VALID_SUB));
    expect(res.status).toBe(404);
  });

  it('returns 200 and calls fetchMutation on valid subscription', async () => {
    const res = await POST(makeRequest('POST', VALID_SUB));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(fetchMutation).toHaveBeenCalledOnce();
  });

  it('returns 500 when fetchMutation throws', async () => {
    vi.mocked(fetchMutation).mockRejectedValue(new Error('Database error'));
    const res = await POST(makeRequest('POST', VALID_SUB));
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/notifications/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withAuth).mockResolvedValue(AUTHED as any);
    vi.mocked(fetchQuery).mockResolvedValue(CONVEX_USER as any);
    vi.mocked(fetchMutation).mockResolvedValue(undefined as any);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(withAuth).mockResolvedValue({ user: null, accessToken: null } as any);
    const res = await DELETE(makeRequest('DELETE', { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when endpoint is missing', async () => {
    const res = await DELETE(makeRequest('DELETE', {}));
    expect(res.status).toBe(400);
  });

  it('returns 200 and calls fetchMutation on valid endpoint', async () => {
    const res = await DELETE(makeRequest('DELETE', { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(fetchMutation).toHaveBeenCalledOnce();
  });

  it('returns 500 when fetchMutation throws', async () => {
    vi.mocked(fetchMutation).mockRejectedValue(new Error('Database error'));
    const res = await DELETE(makeRequest('DELETE', { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(500);
  });
});
