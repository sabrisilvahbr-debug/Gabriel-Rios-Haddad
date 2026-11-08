export type RouteDecision = { action: 'next' } | { action: 'redirect'; to: string } | { action: 'rewrite'; to: string };

export function hostWithoutPort(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function parseAppHosts(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((h) => hostWithoutPort(h))
    .filter(Boolean);
}

/** Hosts onde abre o próprio app (painel, prévias, APIs). Qualquer outro é domínio de cliente. */
export function isAppHost(host: string, appHosts: string[]): boolean {
  const h = hostWithoutPort(host);
  if (!h) return true;
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.vercel.app')) return true;
  return appHosts.map(hostWithoutPort).includes(h);
}

const CLIENT_DOMAIN_PASSTHROUGH = [/^\/_next\//, /^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/favicon\.ico$/];

export function resolveRequest(input: {
  host: string;
  pathname: string;
  hasSession: boolean;
  appHosts: string[];
}): RouteDecision {
  const { host, pathname, hasSession, appHosts } = input;

  if (!isAppHost(host, appHosts)) {
    if (CLIENT_DOMAIN_PASSTHROUGH.some((rule) => rule.test(pathname))) return { action: 'next' };
    const suffix = pathname === '/' ? '' : pathname;
    return { action: 'rewrite', to: `/dominio/${hostWithoutPort(host)}${suffix}` };
  }

  const isPanel = pathname === '/painel' || pathname.startsWith('/painel/');
  if (isPanel && !hasSession) {
    return { action: 'redirect', to: `/login?next=${encodeURIComponent(pathname)}` };
  }
  return { action: 'next' };
}
