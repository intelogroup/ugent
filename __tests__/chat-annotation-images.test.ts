import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAppendMessageAnnotation } = vi.hoisted(() => ({
  mockAppendMessageAnnotation: vi.fn(),
}));

vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: vi.fn(),
}));

vi.mock('@/lib/pinecone', () => ({
  getContext: vi.fn(),
  getImages: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model'),
}));

vi.mock('ai', () => ({
  streamText: vi.fn(),
  StreamData: class {
    appendMessageAnnotation = mockAppendMessageAnnotation;
    close = vi.fn();
  },
}));

import { withAuth } from '@workos-inc/authkit-nextjs';
import { getImages } from '@/lib/pinecone';
import { streamText } from 'ai';

describe('chat route — image annotation metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes full image metadata objects (not bare IDs) in the annotation', async () => {
    vi.mocked(withAuth).mockResolvedValue({
      user: { email: 'test@example.com' },
      accessToken: 'tok',
    } as any);

    vi.mocked(getImages).mockResolvedValue([
      {
        image_id: 'abc123',
        filename: 'figure_1.png',
        source_book: 'First Aid 2023',
        page_number: 42,
        caption: 'Glycolysis pathway diagram',
        score: 0.82,
      },
    ] as any);

    const { getContext } = await import('@/lib/pinecone');
    vi.mocked(getContext).mockResolvedValue([]);

    vi.mocked(streamText).mockReturnValue({
      toDataStreamResponse: vi.fn(() => new Response('stream', { status: 200 })),
    } as any);

    vi.resetModules();
    const { POST } = await import('@/app/api/chat/route');

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is glycolysis?' }],
      }),
    });

    await POST(req);

    expect(mockAppendMessageAnnotation).toHaveBeenCalledOnce();
    const annotation = mockAppendMessageAnnotation.mock.calls[0][0];

    // images must be objects, not strings
    expect(annotation.images).toHaveLength(1);
    expect(annotation.images[0]).toMatchObject({
      image_id: 'abc123',
      caption: 'Glycolysis pathway diagram',
      source_book: 'First Aid 2023',
      page_number: 42,
    });
    // must NOT be a bare string
    expect(typeof annotation.images[0]).toBe('object');
  });
});
