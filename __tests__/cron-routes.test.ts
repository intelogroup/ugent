import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/facts-agent', () => ({
  generateFacts: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
  sendFactsEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppFactsToAll: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/telegram', () => ({
  sendTelegramFactsToAll: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/send-push-notifications', () => ({
  sendPushNotificationsToAll: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { GET as cronFactsGET } from '@/app/api/cron/facts/route';
import { GET as cronTelegramGET } from '@/app/api/cron/telegram-facts/route';
import { generateFacts } from '@/lib/facts-agent';
import { sendFactsEmail } from '@/lib/email';
import { sendWhatsAppFactsToAll } from '@/lib/whatsapp';
import { sendTelegramFactsToAll } from '@/lib/telegram';
import { sendPushNotificationsToAll } from '@/lib/send-push-notifications';

const VALID_SECRET = 'test-cron-secret';

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/cron/facts', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/cron/facts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = VALID_SECRET;
  });

  it('returns 401 when no auth header', async () => {
    const res = await cronFactsGET(makeRequest());
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe('Unauthorized');
  });

  it('returns 401 when wrong secret', async () => {
    const res = await cronFactsGET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with factCount on success', async () => {
    const fakeFacts = ['Fact 1', 'Fact 2', 'Fact 3'];
    vi.mocked(generateFacts).mockResolvedValue(fakeFacts as any);

    const res = await cronFactsGET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.factCount).toBe(3);
    expect(body.sentAt).toBeDefined();
  });

  it('fires email, WhatsApp, and push in background (does not await)', async () => {
    vi.mocked(generateFacts).mockResolvedValue(['Fact'] as any);
    await cronFactsGET(makeRequest(`Bearer ${VALID_SECRET}`));
    // All three should be called (fire-and-forget pattern)
    expect(sendFactsEmail).toHaveBeenCalledOnce();
    expect(sendWhatsAppFactsToAll).toHaveBeenCalledOnce();
    expect(sendPushNotificationsToAll).toHaveBeenCalledOnce();
  });
});

describe('GET /api/cron/telegram-facts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = VALID_SECRET;
  });

  it('returns 401 when no auth header', async () => {
    const res = await cronTelegramGET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong secret', async () => {
    const res = await cronTelegramGET(makeRequest('Bearer bad'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with factCount and ok=true on success', async () => {
    vi.mocked(generateFacts).mockResolvedValue(['A', 'B'] as any);
    const res = await cronTelegramGET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.factCount).toBe(2);
    expect(sendTelegramFactsToAll).toHaveBeenCalledOnce();
  });

  it('returns ok=false with error when Telegram send fails', async () => {
    vi.mocked(generateFacts).mockResolvedValue(['Fact'] as any);
    vi.mocked(sendTelegramFactsToAll).mockRejectedValue(new Error('Telegram API down'));

    const res = await cronTelegramGET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(200); // cron still responds 200
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Telegram API down');
  });

  it('returns 500 when generateFacts throws', async () => {
    vi.mocked(generateFacts).mockRejectedValue(new Error('AI service down'));
    const res = await cronTelegramGET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('AI service down');
  });
});
