import { NextRequest, NextResponse } from 'next/server';
import { sealData } from 'iron-session';
import { cookies } from 'next/headers';

const COOKIE_NAME = process.env.WORKOS_COOKIE_NAME ?? 'wos-session';
const COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD!;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { email, password } = (await request.json()) as { email: string; password: string };

  const res = await fetch('https://api.workos.com/user_management/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.WORKOS_CLIENT_ID,
      client_secret: process.env.WORKOS_API_KEY,
      email,
      password,
      grant_type: 'urn:workos:oauth:grant-type:password',
      ip_address: '127.0.0.1',
      user_agent: 'playwright-test',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: body }, { status: 401 });
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    user: Record<string, unknown>;
  };

  const session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
  };

  const sealed = await sealData(session, { password: COOKIE_PASSWORD, ttl: 0 });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: false,
    path: '/',
    sameSite: 'lax',
  });

  return NextResponse.json({ ok: true });
}
