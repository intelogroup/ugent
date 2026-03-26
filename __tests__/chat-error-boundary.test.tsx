import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatErrorBoundary } from '@/components/chat/chat-error-boundary';

function Bomb() {
  throw new Error('[CONVEX Q(messages:listByThread)] Server Error');
  return null;
}

describe('ChatErrorBoundary', () => {
  it('renders fallback UI when child throws a Convex error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ChatErrorBoundary>
        <Bomb />
      </ChatErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
    spy.mockRestore();
  });

  it('renders children normally when no error', () => {
    render(
      <ChatErrorBoundary>
        <div>Chat loaded</div>
      </ChatErrorBoundary>
    );
    expect(screen.getByText('Chat loaded')).toBeTruthy();
  });
});
