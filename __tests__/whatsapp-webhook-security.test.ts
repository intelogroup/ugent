/**
 * Security tests for POST /api/whatsapp/webhook
 * Verifies HMAC signature validation is enforced.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/pinecone', () => ({
  getContext: vi.fn().mockResolvedValue([]),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'Test reply' }),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue('mock-model'),
}));

// Mock WhatsApp message sender
vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../app/api/whatsapp/webhook/route';

function makeRequest(body: object, signature?: string) {
  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature !== undefined) {
    headers['x-hub-signature-256'] = signature;
  }
  return new Request('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers,
    body: bodyStr,
  });
}

describe('POST /api/whatsapp/webhook — security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_APP_SECRET = 'test-secret-12345';
  });

  it('returns 401 when x-hub-signature-256 header is missing', async () => {
    const res = await POST(makeRequest({ entry: [] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/missing signature/i);
  });

  it('returns 401 when signature does not match', async () => {
    const res = await POST(makeRequest({ entry: [] }, 'sha256=badhash000000000000000000000000000000000000000000000000000000000000'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid signature/i);
  });

  it('returns 200 for valid payload with no messages (entry missing)', async () => {
    // Compute valid HMAC for this payload
    const { createHmac } = await import('crypto');
    const payload = JSON.stringify({ entry: [] });
    const sig = 'sha256=' + createHmac('sha256', 'test-secret-12345').update(payload).digest('hex');
    const req = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
      body: payload,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
