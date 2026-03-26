import { NextRequest, NextResponse } from 'next/server';
import { sealData } from 'iron-session';
import { cookies } from 'next/headers';
import { WorkOS } from '@workos-inc/node';

const COOKIE_NAME = process.env.WORKOS_COOKIE_NAME ?? 'wos-session';
const COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD!;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { email, password } = (await request.json()) as { email: string; password: string };

  let data: { accessToken: string; refreshToken: string; user: Record<string, unknown> };
  try {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);
    const result = await workos.userManagement.authenticateWithPassword({
      clientId: process.env.WORKOS_CLIENT_ID!,
      email,
      password,
    });
    data = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 401 });
  }

  const session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
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
