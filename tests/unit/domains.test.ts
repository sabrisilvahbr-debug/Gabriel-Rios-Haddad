import { describe, expect, it } from 'vitest';
import { dnsInstructions, isApexDomain, normalizeDomain } from '@/lib/domains/normalize';

describe('normalizeDomain', () => {
  it('strips protocol, www, path, port and case', () => {
    expect(normalizeDomain('https://www.Padaria.com.br/contato')).toBe('padaria.com.br');
    expect(normalizeDomain('padaria.com.br:8080')).toBe('padaria.com.br');
    expect(normalizeDomain('  PADARIA.COM.BR.  ')).toBe('padaria.com.br');
  });

  it('keeps subdomains other than www', () => {
    expect(normalizeDomain('http://loja.padaria.com.br')).toBe('loja.padaria.com.br');
  });

  it('converts accented domains to punycode', () => {
    expect(normalizeDomain('açaí.com.br')?.startsWith('xn--')).toBe(true);
  });

  it('rejects invalid domains and app hosts', () => {
    expect(normalizeDomain('padaria')).toBeNull();
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain('x.vercel.app')).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
    expect(normalizeDomain('padaria..com.br')).toBeNull();
    expect(normalizeDomain('padaria com.br')).toBeNull();
  });
});

describe('isApexDomain', () => {
  it('recognizes Brazilian second-level suffixes', () => {
    expect(isApexDomain('padaria.com.br')).toBe(true);
    expect(isApexDomain('padaria.com')).toBe(true);
    expect(isApexDomain('loja.padaria.com.br')).toBe(false);
    expect(isApexDomain('loja.padaria.com')).toBe(false);
  });
});

describe('dnsInstructions', () => {
  it('uses the Vercel defaults for an apex domain', () => {
    expect(dnsInstructions('padaria.com.br')).toEqual([
      { type: 'A', name: '@', value: '76.76.21.21' },
      { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' },
    ]);
  });

  it('prefers the values recommended by Vercel', () => {
    expect(
      dnsInstructions('padaria.com.br', { recommendedIPv4: '216.198.79.1', recommendedCNAME: 'abc.vercel-dns-017.com.' }),
    ).toEqual([
      { type: 'A', name: '@', value: '216.198.79.1' },
      { type: 'CNAME', name: 'www', value: 'abc.vercel-dns-017.com' },
    ]);
  });

  it('uses a CNAME on the subdomain label', () => {
    expect(dnsInstructions('loja.padaria.com.br')).toEqual([
      { type: 'CNAME', name: 'loja', value: 'cname.vercel-dns.com' },
    ]);
  });

  it('adds TXT verification records when Vercel asks for them', () => {
    const records = dnsInstructions('padaria.com.br', {
      verification: [{ type: 'TXT', domain: '_vercel.padaria.com.br', value: 'vc-domain-verify=abc' }],
    });
    expect(records).toContainEqual({ type: 'TXT', name: '_vercel', value: 'vc-domain-verify=abc' });
  });
});
