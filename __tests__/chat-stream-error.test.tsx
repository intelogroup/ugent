import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@workos-inc/authkit-nextjs/components', () => ({
  useAuth: () => ({ user: { email: 'u@test.com' }, loading: false }),
}));
vi.mock('convex/react', () => ({
  useQuery: vi.fn((_query: unknown, args?: unknown) => {
    // When args is the string "skip", the query is skipped — return undefined
    if (args === 'skip') return undefined;
    // getCurrentUser call (no args) — return minimal user
    if (args === undefined) return { tokenIdentifier: 'tok_test' };
    // listByThread (args is object with threadId) — return empty array
    return [];
  }),
  useMutation: vi.fn(() => vi.fn().mockResolvedValue('thread_123' as any)),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}));

let capturedOnError: ((err: Error) => void) | undefined;
vi.mock('ai/react', () => ({
  useChat: vi.fn((opts: { onError?: (err: Error) => void }) => {
    capturedOnError = opts?.onError;
    return {
      messages: [],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      setMessages: vi.fn(),
      append: vi.fn(),
    };
  }),
}));

import { render, act, screen } from '@testing-library/react';
import { ChatInterface } from '@/components/chat/chat-interface';

describe('ChatInterface stream error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnError = undefined;
  });

  it('registers an onError handler with useChat', () => {
    render(<ChatInterface />);
    expect(capturedOnError).toBeTypeOf('function');
  });

  it('displays an error message when the stream fails with 401', async () => {
    render(<ChatInterface />);
    await act(async () => {
      capturedOnError?.(new Error('Unauthorized'));
    });
    expect(screen.getByText(/session expired/i)).toBeTruthy();
  });
});
