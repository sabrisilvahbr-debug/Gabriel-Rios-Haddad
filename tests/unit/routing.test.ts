import { describe, expect, it } from 'vitest';
import { isAppHost, parseAppHosts, resolveRequest } from '@/lib/routing';

describe('isAppHost', () => {
  it('treats vercel.app, localhost and configured hosts as the app', () => {
    expect(isAppHost('zapflow.vercel.app', [])).toBe(true);
    expect(isAppHost('localhost:3000', [])).toBe(true);
    expect(isAppHost('painel.agencia.com', ['painel.agencia.com'])).toBe(true);
    expect(isAppHost('PAINEL.agencia.com:443', ['painel.agencia.com'])).toBe(true);
  });

  it('treats any other host as a client domain', () => {
    expect(isAppHost('padaria.com.br', [])).toBe(false);
  });
});

describe('parseAppHosts', () => {
  it('splits and trims a comma-separated list', () => {
    expect(parseAppHosts(' painel.a.com , b.com ,')).toEqual(['painel.a.com', 'b.com']);
    expect(parseAppHosts(undefined)).toEqual([]);
  });
});

describe('resolveRequest', () => {
  const base = { appHosts: [], hasSession: false };

  it('sends visitors without a session to the login page', () => {
    expect(resolveRequest({ ...base, host: 'zapflow.vercel.app', pathname: '/painel/empresas' })).toEqual({
      action: 'redirect',
      to: '/login?next=%2Fpainel%2Fempresas',
    });
  });

  it('lets a logged-in user into the panel', () => {
    expect(
      resolveRequest({ ...base, hasSession: true, host: 'zapflow.vercel.app', pathname: '/painel' }),
    ).toEqual({ action: 'next' });
  });

  it('rewrites client domains to the site route', () => {
    expect(resolveRequest({ ...base, host: 'padaria.com.br', pathname: '/' })).toEqual({
      action: 'rewrite',
      to: '/dominio/padaria.com.br',
    });
    expect(resolveRequest({ ...base, host: 'www.padaria.com.br', pathname: '/' })).toEqual({
      action: 'rewrite',
      to: '/dominio/www.padaria.com.br',
    });
    expect(resolveRequest({ ...base, host: 'padaria.com.br', pathname: '/contato' })).toEqual({
      action: 'rewrite',
      to: '/dominio/padaria.com.br/contato',
    });
  });

  it('serves robots.txt and Next assets directly on client domains', () => {
    expect(resolveRequest({ ...base, host: 'padaria.com.br', pathname: '/robots.txt' })).toEqual({ action: 'next' });
    expect(resolveRequest({ ...base, host: 'padaria.com.br', pathname: '/_next/static/a.js' })).toEqual({
      action: 'next',
    });
  });

  it('never exposes the panel on a client domain', () => {
    expect(resolveRequest({ ...base, hasSession: true, host: 'padaria.com.br', pathname: '/painel' })).toEqual({
      action: 'rewrite',
      to: '/dominio/padaria.com.br/painel',
    });
  });
});
