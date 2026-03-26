import { Resend } from 'resend';
import type { Fact } from './facts-agent';

const CATEGORY_COLORS: Record<string, string> = {
  Cardiology: '#ef4444',
  Pulmonology: '#0ea5e9',
  Nephrology: '#3b82f6',
  GI: '#eab308',
  Endocrinology: '#a855f7',
  Hematology: '#f97316',
  'Infectious Disease': '#22c55e',
  Neurology: '#6366f1',
  Oncology: '#ec4899',
  Immunology: '#14b8a6',
  Pharmacology: '#84cc16',
  Pathology: '#6b7280',
};

export function buildEmailHtml(facts: Fact[]): string {
  const generatedAt = facts[0]
    ? new Date(facts[0].generatedAt).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString();

  const factCards = facts
    .map((fact) => {
      const color = CATEGORY_COLORS[fact.category] ?? '#6b7280';
      return `
      <tr>
        <td style="padding: 0 0 16px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1e2e;border-radius:10px;overflow:hidden;border-left:4px solid ${color};">
            <tr>
              <td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="display:inline-block;background:${color}22;color:${color};font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:3px 10px;border-radius:20px;margin-bottom:8px;">${fact.category}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#e2e8f0;font-size:14px;line-height:1.7;padding-bottom:10px;">${fact.fact}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:11px;">📖 ${fact.source}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>High-Yield USMLE Facts</title></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#1e40af);border-radius:12px 12px 0 0;padding:32px 32px 24px;text-align:center;">
              <div style="font-size:28px;margin-bottom:8px;">🩺</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">High-Yield USMLE Facts</h1>
              <p style="margin:8px 0 0;color:#93c5fd;font-size:13px;">Your 2-hour study boost · ${generatedAt}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#13131f;padding:24px 32px;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
              <p style="margin:0 0 20px;color:#94a3b8;font-size:13px;line-height:1.6;">
                Researched from <strong style="color:#60a5fa;">First Aid</strong>, <strong style="color:#60a5fa;">Pathoma</strong>, and live community discussions on Reddit &amp; medical forums.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${factCards}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0d1a;border-radius:0 0 12px 12px;border:1px solid #1e293b;border-top:none;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:11px;line-height:1.6;">
                UGent MedBot · Delivered every 2 hours<br>
                <a href="#" style="color:#3b82f6;text-decoration:none;">Open Chat</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendFactsEmail(facts: Fact[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FACTS_EMAIL_TO ?? 'jimkalinov@gmail.com';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email');
    return;
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: 'UGent MedBot <onboarding@resend.dev>',
    to,
    subject: `🩺 ${facts.length} High-Yield USMLE Facts — ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    html: buildEmailHtml(facts),
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Resend failed: ${error.message}`);
  }

}
