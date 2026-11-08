import { ActionForm } from '@/components/painel/client';
import { Field, inputClass, Section } from '@/components/painel/ui';
import { NICHES } from '@/lib/constants';
import type { Site } from '@/lib/db/schema';
import { NICHE_THEMES } from '@/lib/niches';
import { CONTENT_LIMITS as L } from '@/lib/sites/content';
import { photoAuthorizeAction, photoRemoveAction, photoUploadAction, regenerateAction, saveContentAction } from './actions';

export function SiteTextsEditor({ site, businessId }: { site: Site; businessId: string }) {
  const { content } = site;
  const ids = (
    <>
      <input type="hidden" name="siteId" value={site.id} />
      <input type="hidden" name="businessId" value={businessId} />
    </>
  );

  return (
    <Section
      title="Textos do site"
      description={
        site.generationSource === 'ia'
          ? 'Escritos pela IA com os dados do Google. Ajuste o que quiser.'
          : 'Textos padrão do ramo (a IA não estava disponível quando a prévia foi criada).'
      }
    >
      <ActionForm action={saveContentAction} submitLabel="Salvar textos" className="space-y-5">
        {ids}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título" hint={`Até ${L.heroTitle} caracteres.`}>
            <input name="heroTitle" defaultValue={content.heroTitle} maxLength={L.heroTitle} required className={inputClass} />
          </Field>
          <Field label="Ramo e visual">
            <select name="niche" defaultValue={site.niche} className={inputClass}>
              {NICHES.map((n) => (
                <option key={n} value={n}>
                  {NICHE_THEMES[n].label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Subtítulo" hint={`Até ${L.heroSubtitle} caracteres.`}>
          <textarea name="heroSubtitle" defaultValue={content.heroSubtitle} maxLength={L.heroSubtitle} rows={2} required className={inputClass} />
        </Field>
        <Field label="Quem somos" hint={`Até ${L.about} caracteres. Deixe uma linha em branco entre parágrafos.`}>
          <textarea name="about" defaultValue={content.about} maxLength={L.about} rows={6} required className={inputClass} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">Serviços (de 3 a 6)</legend>
          <div className="space-y-2">
            {Array.from({ length: L.servicesMax }, (_, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                <input
                  name={`service_title_${i}`}
                  aria-label={`Serviço ${i + 1}: nome`}
                  defaultValue={content.services[i]?.title ?? ''}
                  maxLength={L.serviceTitle}
                  placeholder="Nome do serviço"
                  className={inputClass}
                />
                <input
                  name={`service_desc_${i}`}
                  aria-label={`Serviço ${i + 1}: descrição`}
                  defaultValue={content.services[i]?.description ?? ''}
                  maxLength={L.serviceDescription}
                  placeholder="Descrição curta"
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">Diferenciais (de 3 a 4)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: L.highlightsMax }, (_, i) => (
              <input
                key={i}
                name={`highlight_${i}`}
                aria-label={`Diferencial ${i + 1}`}
                defaultValue={content.highlights[i] ?? ''}
                maxLength={L.highlight}
                className={inputClass}
              />
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Texto do botão" hint={`Até ${L.ctaText} caracteres.`}>
            <input name="ctaText" defaultValue={content.ctaText} maxLength={L.ctaText} required className={inputClass} />
          </Field>
          <Field label="Descrição para o Google" hint={`Até ${L.seoDescription} caracteres.`}>
            <input name="seoDescription" defaultValue={content.seoDescription} maxLength={L.seoDescription} required className={inputClass} />
          </Field>
        </div>
      </ActionForm>

      <div className="mt-5 border-t border-stone-100 pt-5">
        <ActionForm
          action={regenerateAction}
          submitLabel="Gerar textos de novo com IA"
          pendingLabel="Gerando…"
          variant="secondary"
          confirmMessage="Os textos atuais serão substituídos. Continuar?"
        >
          {ids}
        </ActionForm>
      </div>
    </Section>
  );
}

export function SitePhotosEditor({ site, businessId }: { site: Site; businessId: string }) {
  const ids = (
    <>
      <input type="hidden" name="siteId" value={site.id} />
      <input type="hidden" name="businessId" value={businessId} />
    </>
  );
  const pendingGoogle = site.photos.filter((p) => p.source === 'google' && !p.authorized).length;

  return (
    <Section
      title="Fotos"
      description="Fotos do Google aparecem na prévia com crédito. No site oficial só entram as autorizadas pela empresa."
    >
      {site.photos.length === 0 ? (
        <p className="mb-5 text-sm text-stone-600">Nenhuma foto. O site usa só cores e textos até você enviar fotos.</p>
      ) : (
        <ul className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {site.photos.map((photo) => (
            <li key={photo.url} className="overflow-hidden rounded-lg border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" referrerPolicy="no-referrer" className="aspect-[4/3] w-full bg-stone-100 object-cover" />
              <div className="space-y-2 p-3 text-sm">
                <p className="text-stone-600">
                  {photo.source === 'google' ? 'Google Maps' : 'Enviada por você'}
                  {' — '}
                  <span className={photo.authorized ? 'text-emerald-700' : 'text-amber-700'}>
                    {photo.authorized ? 'autorizada' : 'sem autorização'}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActionForm
                    action={photoAuthorizeAction}
                    submitLabel={photo.authorized ? 'Tirar autorização' : 'Marcar autorizada'}
                    pendingLabel="Salvando…"
                    variant="secondary"
                  >
                    {ids}
                    <input type="hidden" name="url" value={photo.url} />
                    <input type="hidden" name="authorized" value={photo.authorized ? 'false' : 'true'} />
                  </ActionForm>
                  <ActionForm action={photoRemoveAction} submitLabel="Remover" pendingLabel="Removendo…" variant="danger">
                    {ids}
                    <input type="hidden" name="url" value={photo.url} />
                  </ActionForm>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pendingGoogle ? (
        <p className="mb-4 text-sm text-amber-800">
          {pendingGoogle} foto(s) do Google sem autorização. Para publicar o site oficial, autorize ou remova.
        </p>
      ) : null}
      <ActionForm action={photoUploadAction} submitLabel="Enviar foto" pendingLabel="Enviando…" variant="secondary" className="space-y-3">
        {ids}
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          required
          className="block text-sm text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </ActionForm>
    </Section>
  );
}
