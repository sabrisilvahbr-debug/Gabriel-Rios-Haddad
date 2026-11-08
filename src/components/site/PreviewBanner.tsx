import { waNumber } from '@/lib/phone';

export function agencyWhatsappHref(agencyWhatsapp: string, businessName: string): string | null {
  if (!agencyWhatsapp) return null;
  const text = `Oi! Vi a prévia do site da ${businessName} e quero saber como colocar no ar.`;
  return `https://wa.me/${waNumber(agencyWhatsapp)}?text=${encodeURIComponent(text)}`;
}

export function PreviewBanner({
  agencyName,
  agencyWhatsapp,
  businessName,
}: {
  agencyName: string;
  agencyWhatsapp: string;
  businessName: string;
}) {
  const href = agencyWhatsappHref(agencyWhatsapp, businessName);
  return (
    <div role="note" aria-label="Aviso de prévia" className="sticky top-0 z-40 bg-stone-900 text-stone-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-sm sm:px-8">
        <p className="min-w-[15rem] flex-1 leading-snug">
          <strong className="font-semibold">Prévia criada por {agencyName || 'nossa equipe'}</strong> para{' '}
          {businessName}. Este ainda não é o site oficial.
        </p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-emerald-400 px-4 py-2 font-semibold text-stone-950 transition-colors hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          >
            Quero este site
          </a>
        ) : null}
      </div>
    </div>
  );
}
