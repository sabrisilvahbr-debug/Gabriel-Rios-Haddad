import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { isAppHost, parseAppHosts, resolveRequest } from '@/lib/routing';

export async function proxy(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const pathname = request.nextUrl.pathname;
  const appHosts = parseAppHosts(process.env.APP_HOSTS);

  const needsSession = isAppHost(host, appHosts) && pathname.startsWith('/painel');
  const hasSession = needsSession ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value) : false;

  const decision = resolveRequest({ host, pathname, hasSession, appHosts });
  if (decision.action === 'redirect') {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  if (decision.action === 'rewrite') {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
