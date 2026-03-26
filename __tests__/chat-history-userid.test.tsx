import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@workos-inc/authkit-nextjs/components', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' }, loading: false }),
}));

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { useQuery } from 'convex/react';
import { render } from '@testing-library/react';
import { ChatHistory } from '@/components/history/chat-history';

describe('ChatHistory userId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes tokenIdentifier (not _id) to listRecentThreadsWithPreview', () => {
    const TOKEN = 'https://api.workos.com/user_management/client_abc|user_xyz';
    vi.mocked(useQuery)
      .mockReturnValueOnce({ _id: 'convex_doc_id_123', tokenIdentifier: TOKEN } as any)
      .mockReturnValueOnce([] as any);

    render(<ChatHistory onSelectThread={vi.fn()} onBack={vi.fn()} />);

    const calls = vi.mocked(useQuery).mock.calls;
    const listCall = calls[1];
    expect(listCall[1]).toEqual(expect.objectContaining({ userId: TOKEN }));
    expect(listCall[1]).not.toEqual(expect.objectContaining({ userId: 'convex_doc_id_123' }));
  });
});
