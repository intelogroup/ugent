import { withAuth, getAuth } from '@workos-inc/authkit-nextjs';

export { withAuth, getAuth };

// Helper: get authenticated user or return 401 response
export async function requireAuth() {
  const { user } = await withAuth();
  if (!user) {
    return { user: null, response: new Response('Unauthorized', { status: 401 }) };
  }
  return { user, response: null };
}
