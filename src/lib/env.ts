export class MissingEnvError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(
      `Configure a variável de ambiente ${variable} (na Vercel: Settings → Environment Variables) e faça um novo deploy.`,
    );
    this.name = 'MissingEnvError';
    this.variable = variable;
  }
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function env(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new MissingEnvError(name);
  return value;
}

/** URL pública do app, sem barra no final. */
export function appUrl(): string {
  const explicit = optionalEnv('APP_URL');
  const vercelHost = optionalEnv('VERCEL_PROJECT_PRODUCTION_URL') ?? optionalEnv('VERCEL_URL');
  const raw = explicit ?? (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000');
  return raw.replace(/\/+$/, '');
}

export const INTEGRATIONS = [
  { key: 'banco', label: 'Banco de dados (Neon)', vars: ['DATABASE_URL'] },
  { key: 'login', label: 'Login do painel', vars: ['ADMIN_PASSWORD', 'SESSION_SECRET'] },
  { key: 'apify', label: 'Busca de empresas (Apify)', vars: ['APIFY_TOKEN', 'APIFY_WEBHOOK_SECRET'] },
  { key: 'gemini', label: 'Textos e respostas (Gemini)', vars: ['GEMINI_API_KEY'] },
  { key: 'fotos', label: 'Upload de fotos (Vercel Blob)', vars: ['BLOB_READ_WRITE_TOKEN'] },
  { key: 'dominios', label: 'Domínios dos clientes (Vercel)', vars: ['VERCEL_API_TOKEN', 'VERCEL_PROJECT_ID'] },
  {
    key: 'whatsapp',
    label: 'WhatsApp (Evolution API)',
    vars: ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'WHATSAPP_WEBHOOK_SECRET'],
  },
  { key: 'cron', label: 'Agendador de envios (cron)', vars: ['CRON_SECRET'] },
] as const;

export type IntegrationKey = (typeof INTEGRATIONS)[number]['key'];

export interface IntegrationStatus {
  key: IntegrationKey;
  label: string;
  ok: boolean;
  missing: string[];
}

export function integrationStatus(): IntegrationStatus[] {
  return INTEGRATIONS.map((group) => {
    const missing = group.vars.filter((name) => !optionalEnv(name));
    return { key: group.key, label: group.label, ok: missing.length === 0, missing };
  });
}

export function isConfigured(key: IntegrationKey): boolean {
  return integrationStatus().find((s) => s.key === key)?.ok ?? false;
}
