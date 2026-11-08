import { domainToASCII } from 'node:url';

export const DEFAULT_A_RECORD = '76.76.21.21';
export const DEFAULT_CNAME = 'cname.vercel-dns.com';

/** Sufixos de segundo nível comuns (ex.: .com.br), para saber se o domínio é a raiz. */
const SECOND_LEVEL = new Set([
  'com', 'net', 'org', 'art', 'blog', 'eco', 'emp', 'eti', 'ind', 'inf', 'med', 'adv', 'arq', 'eng', 'imb',
  'srv', 'tur', 'tv', 'app', 'dev', 'log', 'rec', 'seg', 'gov', 'edu', 'co', 'nom', 'psi', 'odo', 'vet',
]);

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** "https://www.Padaria.com.br/contato" → "padaria.com.br". Inválido → null. */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value || /\s/.test(value)) return null;
  value = value
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');

  const ascii = domainToASCII(value);
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split('.');
  if (labels.length < 2 || labels.some((label) => !LABEL.test(label))) return null;
  if (!/^(xn--[a-z0-9-]+|[a-z]{2,63})$/.test(labels[labels.length - 1])) return null;
  if (ascii.endsWith('.vercel.app') || ascii.endsWith('.localhost')) return null;
  return ascii;
}

export function apexOf(domain: string): string {
  const labels = domain.split('.');
  const n = labels.length;
  const suffixLabels = n >= 3 && labels[n - 1].length === 2 && SECOND_LEVEL.has(labels[n - 2]) ? 3 : 2;
  return labels.slice(-suffixLabels).join('.');
}

export function isApexDomain(domain: string): boolean {
  return apexOf(domain) === domain;
}

export interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
}

export interface DnsConfigHint {
  recommendedIPv4?: string;
  recommendedCNAME?: string;
  verification?: Array<{ type: string; domain: string; value: string }>;
}

function relativeName(host: string, apex: string): string {
  if (host === apex) return '@';
  return host.endsWith(`.${apex}`) ? host.slice(0, -(apex.length + 1)) : host;
}

/** Registros que a empresa (ou quem cuida do domínio dela) precisa criar no DNS. */
export function dnsInstructions(domain: string, config: DnsConfigHint = {}): DnsRecord[] {
  const ip = config.recommendedIPv4 ?? DEFAULT_A_RECORD;
  const cname = (config.recommendedCNAME ?? DEFAULT_CNAME).replace(/\.$/, '');
  const apex = apexOf(domain);
  const records: DnsRecord[] = isApexDomain(domain)
    ? [
        { type: 'A', name: '@', value: ip },
        { type: 'CNAME', name: 'www', value: cname },
      ]
    : [{ type: 'CNAME', name: relativeName(domain, apex), value: cname }];

  for (const item of config.verification ?? []) {
    if (item.type === 'TXT') records.push({ type: 'TXT', name: relativeName(item.domain, apex), value: item.value });
  }
  return records;
}
