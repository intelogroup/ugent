/**
 * Tests for /api/notifications/subscribe
 *
 * Covers: GET (returns VAPID key), POST (saves subscription via auth mutation),
 * DELETE (removes subscription via auth mutation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth-server module
vi.mock('@/lib/auth-server', () => ({
  fetchAuthMutation: vi.fn(),
}));

// Mock Next.js env
process.env.VAPID_PUBLIC_KEY = 'test-vapid-public-key';

import { GET, POST, DELETE } from '../app/api/notifications/subscribe/route';
import { fetchAuthMutation } from '@/lib/auth-server';

describe('GET /api/notifications/subscribe', () => {
  it('returns VAPID public key when configured', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.publicKey).toBe('test-vapid-public-key');
  });

  it('returns 503 when VAPID_PUBLIC_KEY is not set', async () => {
    const original = process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    const res = await GET();
    expect(res.status).toBe(503);
    process.env.VAPID_PUBLIC_KEY = original;
  });
});

describe('POST /api/notifications/subscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  const makeRequest = (body: object) =>
    new Request('http://localhost/api/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

  it('returns 400 when subscription object is missing endpoint', async () => {
    const res = await POST(makeRequest({ keys: { p256dh: 'x', auth: 'y' } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when subscription is missing keys', async () => {
    const res = await POST(makeRequest({ endpoint: 'https://push.example.com/sub' }));
    expect(res.status).toBe(400);
  });

  it('calls fetchAuthMutation with valid subscription', async () => {
    vi.mocked(fetchAuthMutation).mockResolvedValue(undefined);
    const res = await POST(
      makeRequest({
        endpoint: 'https://push.example.com/sub',
        keys: { p256dh: 'abc', auth: 'def' },
      })
    );
    expect(fetchAuthMutation).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('returns 401 when fetchAuthMutation throws an auth error', async () => {
    vi.mocked(fetchAuthMutation).mockRejectedValue(new Error('Unauthorized'));
    const res = await POST(
      makeRequest({
        endpoint: 'https://push.example.com/sub',
        keys: { p256dh: 'abc', auth: 'def' },
      })
    );
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/notifications/subscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls fetchAuthMutation to remove subscription', async () => {
    vi.mocked(fetchAuthMutation).mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/notifications/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: 'https://push.example.com/sub' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await DELETE(req);
    expect(fetchAuthMutation).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(fetchAuthMutation).mockRejectedValue(new Error('Unauthenticated'));
    const req = new Request('http://localhost/api/notifications/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: 'https://push.example.com/sub' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });
});
