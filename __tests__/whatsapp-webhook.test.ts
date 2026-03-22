import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const originalEnv = process.env;

describe('GET /api/whatsapp/webhook — verification', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, WHATSAPP_VERIFY_TOKEN: 'test-token' };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns challenge on valid subscribe request', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route');
    const url = 'http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=abc123';
    const req = new Request(url);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('abc123');
  });

  it('returns 403 on wrong verify token', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route');
    const url = 'http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123';
    const req = new Request(url);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is not subscribe', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route');
    const url = 'http://localhost/api/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=test-token&hub.challenge=abc123';
    const req = new Request(url);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/whatsapp/webhook — incoming messages', () => {
  it('returns 200 for valid message payload', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const body = {
      entry: [{ changes: [{ value: { messages: [{ from: '15551234567', text: { body: 'Hello' } }] } }] }],
    };
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 200 for malformed JSON (no retry)', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 200 when entry has no messages', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const body = { entry: [{ changes: [{ value: {} }] }] };
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
