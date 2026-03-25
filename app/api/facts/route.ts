import { unstable_cache } from 'next/cache';
import { generateFacts } from '@/lib/facts-agent';
import { withAuth } from '@workos-inc/authkit-nextjs';

// Cache facts for 2 hours; invalidated by cron via revalidateTag('facts')
const getCachedFacts = unstable_cache(generateFacts, ['high-yield-facts'], {
  revalidate: 7200,
  tags: ['facts'],
});

export async function GET() {
  const { user } = await withAuth();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const facts = await getCachedFacts();
    return Response.json({ facts });
  } catch (error) {
    console.error('Error fetching facts:', error);
    return Response.json({ error: 'Failed to generate facts' }, { status: 500 });
  }
}
