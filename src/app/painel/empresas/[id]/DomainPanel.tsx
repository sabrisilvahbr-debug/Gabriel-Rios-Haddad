import { ActionForm } from '@/components/painel/client';
import { buttonClass, Callout, Field, inputClass, Section } from '@/components/painel/ui';
import { errorMessage } from '@/lib/async';
import type { Site } from '@/lib/db/schema';
import { dnsInstructions, type DnsConfigHint } from '@/lib/domains/normalize';
import { getDomainStatus } from '@/lib/domains/vercel';
import { isConfigured } from '@/lib/env';
import {
  checkDomainAction,
  connectDomainAction,
  disconnectDomainAction,
  publishAction,
  unpublishAction,
} from './actions';

const DOMAIN_LABELS: Record<Site['domainStatus'], string> = {
  nenhum: 'Sem domínio',
  pendente: 'Aguardando DNS',
  ativo: 'Funcionando',
  erro: 'Erro ao consultar',
};

export async function DomainPanel({ site, businessId }: { site: Site; businessId: string }) {
  const ids = (
    <>
      <input type="hidden" name="siteId" value={site.id} />
      <input type="hidden" name="businessId" value={businessId} />
    </>
  );

  if (!isConfigured('dominios')) {
    return (
      <Section title="Publicar com domínio próprio">
        <Callout>Configure VERCEL_API_TOKEN e VERCEL_PROJECT_ID para ligar domínios de clientes.</Callout>
      </Section>
    );
  }

  if (!site.customDomain) {
    return (
      <Section
        title="Publicar com domínio próprio"
        description="Quando a empresa fechar, ligue o domínio dela. A empresa precisa ter comprado o domínio (por exemplo, no Registro.br)."
      >
        <ActionForm action={connectDomainAction} submitLabel="Ligar domínio" pendingLabel="Ligando…" className="space-y-3">
          {ids}
          <Field label="Domínio da empresa">
            <input name="domain" required placeholder="padariapaoquente.com.br" className={inputClass} />
          </Field>
        </ActionForm>
      </Section>
    );
  }

  let hint: DnsConfigHint = {};
  let lookupError: string | null = null;
  try {
    hint = await getDomainStatus(site.customDomain);
  } catch (error) {
    lookupError = errorMessage(error);
  }
  const records = dnsInstructions(site.customDomain, hint);
  const published = site.status === 'publicado';

  return (
    <Section title="Publicar com domínio próprio">
      <div className="flex flex-wrap items-center gap-3">
        <a href={`https://${site.customDomain}`} target="_blank" rel="noopener noreferrer" className={`text-lg ${buttonClass.link}`}>
          {site.customDomain}
        </a>
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
          {DOMAIN_LABELS[site.domainStatus]}
        </span>
        {published ? (
          <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-xs font-medium text-white">Publicado</span>
        ) : null}
      </div>
      {site.domainError || lookupError ? (
        <p className="mt-2 text-sm text-red-700">{site.domainError ?? lookupError}</p>
      ) : null}

      {site.domainStatus !== 'ativo' ? (
        <div className="mt-5">
          <p className="mb-2 text-sm text-stone-700">
            No painel onde o domínio foi comprado (Registro.br, Hostinger, GoDaddy…), crie estes registros de DNS:
          </p>
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {records.map((record) => (
                  <tr key={`${record.type}-${record.name}`}>
                    <td className="px-3 py-2">{record.type}</td>
                    <td className="px-3 py-2">{record.name}</td>
                    <td className="break-all px-3 py-2">{record.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            O DNS pode levar algumas horas para atualizar. O sistema confere sozinho a cada 10 minutos.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {site.domainStatus !== 'ativo' ? (
          <ActionForm action={checkDomainAction} submitLabel="Verificar agora" pendingLabel="Verificando…" variant="secondary">
            {ids}
          </ActionForm>
        ) : null}
        {published ? (
          <ActionForm
            action={unpublishAction}
            submitLabel="Despublicar"
            pendingLabel="Despublicando…"
            variant="secondary"
            confirmMessage="O domínio passa a mostrar 'Site em manutenção'. Continuar?"
          >
            {ids}
          </ActionForm>
        ) : (
          <ActionForm action={publishAction} submitLabel="Publicar site" pendingLabel="Publicando…">
            {ids}
          </ActionForm>
        )}
        <ActionForm
          action={disconnectDomainAction}
          submitLabel="Remover domínio"
          pendingLabel="Removendo…"
          variant="danger"
          confirmMessage={`Remover ${site.customDomain}? O site sai do ar nesse endereço.`}
        >
          {ids}
        </ActionForm>
      </div>
    </Section>
  );
}
