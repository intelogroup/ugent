import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/ui/app-layout';

export default async function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, accessToken } = await withAuth();
  if (!user) redirect('/login');

  // Sync user into Convex DB on every protected page load (idempotent)
  // accessToken is the WorkOS JWT required for ctx.auth.getUserIdentity() inside Convex
  await fetchMutation(
    api.auth.storeUser,
    {
      name: user.firstName ?? undefined,
      email: user.email ?? undefined,
    },
    { token: accessToken }
  );

  return <AppLayout>{children}</AppLayout>;
}
