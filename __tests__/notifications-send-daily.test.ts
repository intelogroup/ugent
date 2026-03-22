import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/facts-agent', () => ({
  generateFacts: vi.fn(),
}));
vi.mock('@/lib/send-push-notifications', () => ({
  sendPushNotificationsToAll: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from '@/app/api/notifications/send-daily/route';
import { generateFacts } from '@/lib/facts-agent';
import { sendPushNotificationsToAll } from '@/lib/send-push-notifications';

const VALID_SECRET = 'test-cron-secret';

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/notifications/send-daily', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/notifications/send-daily', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = VALID_SECRET;
  });

  it('returns 401 when no auth header', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe('Unauthorized');
  });

  it('returns 401 when wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with factCount on success', async () => {
    const fakeFacts = ['Fact 1', 'Fact 2'];
    vi.mocked(generateFacts).mockResolvedValue(fakeFacts as any);

    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.factCount).toBe(2);
    expect(body.sentAt).toBeDefined();
  });

  it('calls sendPushNotificationsToAll with generated facts', async () => {
    const fakeFacts = ['Fact A', 'Fact B', 'Fact C'];
    vi.mocked(generateFacts).mockResolvedValue(fakeFacts as any);

    await GET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(sendPushNotificationsToAll).toHaveBeenCalledOnce();
    expect(sendPushNotificationsToAll).toHaveBeenCalledWith(fakeFacts);
  });

  it('returns 500 when generateFacts throws', async () => {
    vi.mocked(generateFacts).mockRejectedValue(new Error('AI service down'));

    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('AI service down');
  });

  it('returns 500 when sendPushNotificationsToAll throws', async () => {
    vi.mocked(generateFacts).mockResolvedValue(['Fact'] as any);
    vi.mocked(sendPushNotificationsToAll).mockRejectedValue(new Error('Push delivery failed'));

    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Push delivery failed');
  });
});
