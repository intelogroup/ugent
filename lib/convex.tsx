'use client';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { useAuth, useAccessToken } from '@workos-inc/authkit-nextjs/components';
import { ReactNode, useCallback } from 'react';

const convex = process.env.NEXT_PUBLIC_CONVEX_URL
  ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  : null;

function useWorkOSAuth() {
  const { user, loading } = useAuth();
  const { getAccessToken } = useAccessToken();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      // getAccessToken() always returns a fresh token when needed
      const token = await getAccessToken();
      return token ?? null;
    },
    [user, getAccessToken],
  );

  return {
    isLoading: loading,
    isAuthenticated: !!user,
    fetchAccessToken,
  };
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useWorkOSAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
