import { createHmac } from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function makeSignature(secret: string, body: string) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

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
  const SECRET = 'test-app-secret';

  beforeEach(() => {
    process.env = { ...originalEnv, WHATSAPP_APP_SECRET: SECRET };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 200 for valid message payload', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const bodyStr = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ from: '15551234567', text: { body: 'Hello' } }] } }] }],
    });
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': makeSignature(SECRET, bodyStr) },
      body: bodyStr,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 200 for malformed JSON (no retry)', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const bodyStr = 'not-json';
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': makeSignature(SECRET, bodyStr) },
      body: bodyStr,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 200 when entry has no messages', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const bodyStr = JSON.stringify({ entry: [{ changes: [{ value: {} }] }] });
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': makeSignature(SECRET, bodyStr) },
      body: bodyStr,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 401 when signature is missing', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when signature is invalid', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=badhash00000000000000000000000000000000000000000000000000000000' },
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
