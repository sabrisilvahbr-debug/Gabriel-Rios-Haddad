import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, CopyButton } from '@/components/painel/client';
import { buttonClass, inputClass, PageHeader, Section, StatusBadge } from '@/components/painel/ui';
import { cleanHours } from '@/components/site/SiteView';
import { getBusinessDetail } from '@/lib/businesses';
import { BUSINESS_STATUS_LABELS, BUSINESS_STATUSES } from '@/lib/constants';
import { appUrl, isConfigured } from '@/lib/env';
import { waNumber } from '@/lib/phone';
import { phoneDigitsOf } from '@/lib/whatsapp/manual';
import { deleteAction, notesAction, statusAction } from './actions';
import { Conversation } from './Conversation';
import { DomainPanel } from './DomainPanel';
import { SitePhotosEditor, SiteTextsEditor } from './SiteEditor';

type Props = { params: Promise<{ id: string }> };

export default async function BusinessPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getBusinessDetail(id);
  if (!detail) notFound();
  const { business, site, messages } = detail;
  const previewUrl = site ? `${appUrl()}/s/${site.slug}` : null;
  const businessId = <input type="hidden" name="businessId" value={business.id} />;

  return (
    <>
      <Link href="/painel/empresas" className="mb-4 inline-block text-sm text-stone-600 hover:text-stone-900">
        Voltar para Empresas
      </Link>
      <PageHeader
        title={business.name}
        description={
          <>
            {business.category}
            {business.city ? ` em ${business.city}` : ''}.{' '}
            <a
              href={business.phoneIsMobile ? `https://wa.me/${waNumber(business.phoneE164)}` : `tel:${business.phoneE164}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass.link}
            >
              {business.phoneDisplay}
            </a>
          </>
        }
      >
        <StatusBadge status={business.status} />
      </PageHeader>

      {previewUrl ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={buttonClass.primary}>
            Abrir prévia
          </a>
          <CopyButton value={previewUrl} label="Copiar link da prévia" />
          <span className="break-all text-sm text-stone-500">{previewUrl}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Conversation
            business={business}
            messages={messages}
            manual={!isConfigured('whatsapp')}
            phoneDigits={phoneDigitsOf(business)}
          />
          {site ? (
            <>
              <SiteTextsEditor site={site} businessId={business.id} />
              <SitePhotosEditor site={site} businessId={business.id} />
              <DomainPanel site={site} businessId={business.id} />
            </>
          ) : (
            <Section title="Site">
              <p className="text-sm text-stone-600">
                A prévia ainda está sendo criada. Atualize a página em instantes. Se continuar assim, abra Buscas e
                clique em Atualizar na busca desta empresa.
              </p>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Etapa">
            <ActionForm action={statusAction} submitLabel="Salvar etapa" className="space-y-3">
              {businessId}
              <select name="status" defaultValue={business.status} aria-label="Etapa" className={inputClass}>
                {BUSINESS_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {BUSINESS_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </ActionForm>
            <p className="mt-3 text-xs text-stone-500">
              &quot;Não contatar&quot; bloqueia este telefone para sempre e cancela as mensagens agendadas.
            </p>
          </Section>

          <Section title="Dados do Google">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-stone-500">Endereço</dt>
                <dd className="text-stone-800">{business.address || '—'}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Nota</dt>
                <dd className="text-stone-800">
                  {business.rating !== null
                    ? `${business.rating.toFixed(1).replace('.', ',')} em ${business.reviewsCount ?? 0} avaliações`
                    : 'Sem avaliações'}
                </dd>
              </div>
              {business.openingHours.length ? (
                <div>
                  <dt className="text-stone-500">Horário</dt>
                  <dd>
                    <ul className="text-stone-800">
                      {business.openingHours.map((h) => (
                        <li key={h.day}>
                          {h.day}: {cleanHours(h.hours)}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
            {business.mapsUrl ? (
              <a href={business.mapsUrl} target="_blank" rel="noopener noreferrer" className={`mt-4 inline-block text-sm ${buttonClass.link}`}>
                Ver no Google Maps
              </a>
            ) : null}
          </Section>

          <Section title="Anotações">
            <ActionForm action={notesAction} submitLabel="Salvar anotações" className="space-y-3">
              {businessId}
              <textarea name="notes" defaultValue={business.notes} rows={4} aria-label="Anotações" className={inputClass} />
            </ActionForm>
          </Section>

          <Section title="Excluir empresa" description="Apaga a empresa, a prévia e as mensagens. Não dá para desfazer.">
            <ActionForm
              action={deleteAction}
              submitLabel="Excluir empresa"
              pendingLabel="Excluindo…"
              variant="danger"
              confirmMessage={`Excluir ${business.name} e tudo ligado a ela?`}
            >
              {businessId}
            </ActionForm>
          </Section>
        </div>
      </div>
    </>
  );
}
