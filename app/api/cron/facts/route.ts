import { revalidateTag } from 'next/cache';
import { generateFacts } from '@/lib/facts-agent';
import { sendFactsEmail } from '@/lib/email';
import { sendWhatsAppFactsToAll } from '@/lib/whatsapp';

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Generate fresh facts first, then bust the cache so next API fetch returns them
  const facts = await generateFacts();
  revalidateTag('facts');

  // Fire email + WhatsApp in the background — don't fail the cron if either fails
  sendFactsEmail(facts).catch((err) =>
    console.error('[cron/facts] Email send failed:', err)
  );
  sendWhatsAppFactsToAll(facts).catch((err) =>
    console.error('[cron/facts] WhatsApp send failed:', err)
  );

  return Response.json({
    ok: true,
    factCount: facts.length,
    sentAt: new Date().toISOString(),
  });
}
