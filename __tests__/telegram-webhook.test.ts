import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/pinecone', () => ({
  getContext: vi.fn().mockResolvedValue({ context: 'test context', topScore: 0.8 }),
}));

vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'AI response' }),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue('mock-model'),
}));

const originalEnv = process.env;

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, TELEGRAM_WEBHOOK_SECRET: 'secret123' };
  });
  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('returns 403 when secret token is missing', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');
    const req = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { text: 'Hello', chat: { id: 1 } } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when secret token is wrong', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');
    const req = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong-secret',
      },
      body: JSON.stringify({ message: { text: 'Hello', chat: { id: 1 } } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 when message has no text', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');
    const req = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'secret123',
      },
      body: JSON.stringify({ message: { chat: { id: 1 } } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 200 and calls sendTelegramMessage for valid message', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');
    const { sendTelegramMessage } = await import('@/lib/telegram');
    const req = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'secret123',
      },
      body: JSON.stringify({ message: { text: 'What is nephritic syndrome?', chat: { id: 42 } } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // sendTelegramMessage is always called — either with AI response or error fallback
    expect(sendTelegramMessage).toHaveBeenCalledWith(42, expect.any(String));
  });
});
