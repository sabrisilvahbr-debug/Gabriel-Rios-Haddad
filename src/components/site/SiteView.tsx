import type { CSSProperties } from 'react';
import { Check, Clock, MapPin, MessageCircle, Navigation, Phone, Star } from 'lucide-react';
import type { Site } from '@/lib/db/schema';
import { NICHE_THEMES, type ThemeFont } from '@/lib/niches';
import { waNumber } from '@/lib/phone';
import type { SitePageData } from '@/lib/sites/service';
import { normalizeText } from '@/lib/text';
import { saoPauloParts } from '@/lib/time';
import type { OpeningHour, SitePhoto } from '@/lib/types';
import { ServiceIcon } from './icons';
import { PreviewBanner } from './PreviewBanner';

export type SiteMode = 'preview' | 'published';

const DISPLAY_FONTS: Record<ThemeFont, string> = {
  poppins: "'Poppins', 'Inter Variable', ui-sans-serif, system-ui, sans-serif",
  playfair: "'Playfair Display Variable', Georgia, 'Times New Roman', serif",
  inter: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
};

const DAY_KEYS = [
  ['domingo', 'sunday'],
  ['segunda', 'monday'],
  ['terca', 'tuesday'],
  ['quarta', 'wednesday'],
  ['quinta', 'thursday'],
  ['sexta', 'friday'],
  ['sabado', 'saturday'],
];

/** Prévia mostra todas as fotos; o site oficial só as autorizadas pela empresa. */
export function visiblePhotos(site: Pick<Site, 'photos'>, mode: SiteMode): SitePhoto[] {
  return mode === 'preview' ? site.photos : site.photos.filter((photo) => photo.authorized);
}

export function cleanHours(hours: string): string {
  return hours.replace(/\s+to\s+/gi, '–').replace(/\s+[-–]\s+/g, '–').trim();
}

function dayIndex(day: string): number {
  const name = normalizeText(day);
  return DAY_KEYS.findIndex((keys) => keys.some((key) => name.startsWith(key)));
}

export function todayHours(hours: OpeningHour[], now: Date): string | null {
  const { weekday } = saoPauloParts(now);
  const entry = hours.find((h) => dayIndex(h.day) === weekday);
  return entry ? cleanHours(entry.hours) : null;
}

function whatsappHref(e164: string, text: string): string {
  return `https://wa.me/${waNumber(e164)}?text=${encodeURIComponent(text)}`;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-1 text-[var(--a)]" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className="size-6" fill={rating >= n - 0.25 ? 'currentColor' : 'none'} strokeWidth={1.5} />
      ))}
    </span>
  );
}

export function SiteView({ data, mode, now = new Date() }: { data: SitePageData; mode: SiteMode; now?: Date }) {
  const { site, business, agency } = data;
  const { content } = site;
  const theme = NICHE_THEMES[site.niche];
  const photos = visiblePhotos(site, mode);
  const [heroPhoto, ...gallery] = photos;
  const today = todayHours(business.openingHours, now);
  const todayIndex = saoPauloParts(now).weekday;
  const place = [business.neighborhood, business.city].filter(Boolean).join(', ');

  const contact = business.phoneIsMobile
    ? {
        href: whatsappHref(business.phoneE164, `Olá! Vi o site da ${business.name} e gostaria de mais informações.`),
        label: content.ctaText,
        Icon: MessageCircle,
        external: true,
      }
    : { href: `tel:${business.phoneE164}`, label: 'Ligar agora', Icon: Phone, external: false };
  const directions =
    business.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${business.address}`)}`;

  const style = {
    '--p': theme.colors.primary,
    '--pd': theme.colors.primaryDark,
    '--a': theme.colors.accent,
    '--soft': theme.colors.soft,
    '--display': DISPLAY_FONTS[theme.font],
  } as CSSProperties;

  const ContactIcon = contact.Icon;
  const contactLinkProps = contact.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  const primaryButton =
    'inline-flex items-center justify-center gap-2 rounded-full bg-[var(--p)] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[var(--pd)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--a)]';

  return (
    <div style={style} className="min-h-screen bg-white pb-24 text-stone-900 sm:pb-0">
      {mode === 'preview' ? (
        <PreviewBanner agencyName={agency.name} agencyWhatsapp={agency.whatsapp} businessName={business.name} />
      ) : null}

      <header>
        {theme.sign === 'toldo' ? (
          <div className="site-awning" aria-hidden />
        ) : (
          <div className="h-2 bg-[var(--p)]" aria-hidden />
        )}
        <div className={theme.sign === 'faixa' ? 'bg-[var(--soft)]' : undefined}>
          <div className="mx-auto max-w-5xl px-5 pb-12 pt-14 sm:px-8 sm:pt-20">
            {business.category ? (
              <p className="text-base font-medium text-[var(--p)]">
                {business.category}
                {business.city ? ` em ${business.city}` : ''}
              </p>
            ) : null}
            <h1 className="site-display mt-3 text-[clamp(2.75rem,10vw,6rem)] font-semibold leading-[0.95] tracking-[-0.02em] text-[var(--pd)] [text-wrap:balance]">
              {content.heroTitle}
            </h1>
            <p className="mt-6 max-w-[34ch] text-lg leading-relaxed text-stone-700 sm:text-xl">{content.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={contact.href} {...contactLinkProps} className={primaryButton}>
                <ContactIcon className="size-5" aria-hidden />
                {contact.label}
              </a>
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3.5 text-base font-medium text-stone-800 transition-colors hover:border-[var(--p)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--a)]"
              >
                <Navigation className="size-5" aria-hidden />
                Como chegar
              </a>
            </div>
            {today ? (
              <p className="mt-6 flex items-center gap-2 text-sm text-stone-600">
                <Clock className="size-4 text-[var(--p)]" aria-hidden />
                {`Hoje: ${today}`}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        {heroPhoto ? (
          <figure className="mx-auto max-w-5xl px-5 sm:px-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroPhoto.url}
              alt={`Foto de ${business.name}`}
              className="aspect-[4/3] w-full rounded-[2rem] bg-[var(--soft)] object-cover sm:aspect-[16/8]"
              referrerPolicy="no-referrer"
            />
            {heroPhoto.credit ? (
              <figcaption className="mt-2 text-xs text-stone-500">{heroPhoto.credit}</figcaption>
            ) : null}
          </figure>
        ) : null}

        <section aria-labelledby="sobre" className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 id="sobre" className="site-display text-3xl font-semibold text-[var(--pd)] sm:text-4xl">
            Quem somos
          </h2>
          <div className="mt-5 max-w-[65ch] space-y-4 text-lg leading-relaxed text-stone-700">
            {paragraphs(content.about).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        <section aria-labelledby="servicos" className="mx-auto max-w-5xl px-5 pb-16 sm:px-8 sm:pb-20">
          <h2 id="servicos" className="site-display text-3xl font-semibold text-[var(--pd)] sm:text-4xl">
            Serviços
          </h2>
          <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
            {content.services.map((service, i) => (
              <li key={i} className="flex gap-4 py-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--soft)] text-[var(--p)]">
                  <ServiceIcon name={theme.serviceIcons[i % theme.serviceIcons.length]} className="size-6" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">{service.title}</h3>
                  <p className="mt-1 max-w-[60ch] text-base leading-relaxed text-stone-600">{service.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Diferenciais" className="bg-[var(--soft)]">
          <ul className="mx-auto grid max-w-5xl gap-x-10 gap-y-4 px-5 py-12 sm:grid-cols-2 sm:px-8">
            {content.highlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-3 text-lg font-medium text-stone-800">
                <Check className="mt-1 size-5 shrink-0 text-[var(--p)]" aria-hidden strokeWidth={2.5} />
                {highlight}
              </li>
            ))}
          </ul>
        </section>

        {business.rating !== null ? (
          <section aria-labelledby="avaliacoes" className="mx-auto max-w-5xl px-5 pt-16 sm:px-8 sm:pt-20">
            <h2 id="avaliacoes" className="site-display text-3xl font-semibold text-[var(--pd)] sm:text-4xl">
              O que dizem no Google
            </h2>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Stars rating={business.rating} />
              <p className="text-lg text-stone-700">
                {`Nota ${business.rating.toFixed(1).replace('.', ',')} de 5`}
                {business.reviewsCount ? ` em ${business.reviewsCount} avaliações` : ''}
              </p>
            </div>
            {business.mapsUrl ? (
              <a
                href={business.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block font-medium text-[var(--p)] underline decoration-2 underline-offset-4 hover:text-[var(--pd)]"
              >
                Ver avaliações no Google
              </a>
            ) : null}
          </section>
        ) : null}

        {gallery.length ? (
          <section aria-labelledby="fotos" className="mx-auto max-w-5xl px-5 pt-16 sm:px-8 sm:pt-20">
            <h2 id="fotos" className="site-display text-3xl font-semibold text-[var(--pd)] sm:text-4xl">
              Fotos
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((photo) => (
                <li key={photo.url}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`Foto de ${business.name}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="aspect-square w-full rounded-2xl bg-[var(--soft)] object-cover"
                    />
                    {photo.credit ? (
                      <figcaption className="mt-1 text-xs text-stone-500">{photo.credit}</figcaption>
                    ) : null}
                  </figure>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mx-auto grid max-w-5xl gap-12 px-5 py-16 sm:grid-cols-2 sm:px-8 sm:py-20">
          {business.openingHours.length ? (
            <section aria-labelledby="horario">
              <h2 id="horario" className="site-display text-3xl font-semibold text-[var(--pd)] sm:text-4xl">
                Horário
              </h2>
              <table className="mt-5 w-full text-base">
                <tbody>
                  {business.openingHours.map((h) => {
                    const isToday = dayIndex(h.day) === todayIndex;
                    return (
                      <tr key={h.day} className="border-b border-stone-200">
                        <th
                          scope="row"
                          className={`py-2.5 pr-4 text-left font-normal first-letter:uppercase ${isToday ? 'font-semibold text-[var(--pd)]' : 'text-stone-600'}`}
                        >
                          {h.day}
                          {isToday ? <span className="sr-only"> (hoje)</span> : null}
                        </th>
                        <td className={`py-2.5 text-right ${isToday ? 'font-semibold text-[var(--pd)]' : 'text-stone-800'}`}>
                          {cleanHours(h.hours)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ) : null}

          <section aria-labelledby="endereco">
            <h2 id="endereco" className="site-display text-3xl font-semibold text-[var(--pd)] sm:text-4xl">
              Onde estamos
            </h2>
            <p className="mt-5 flex gap-3 text-lg leading-relaxed text-stone-700">
              <MapPin className="mt-1 size-5 shrink-0 text-[var(--p)]" aria-hidden />
              <span>{business.address || place || 'Fale com a gente para saber o endereço.'}</span>
            </p>
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 font-medium text-[var(--p)] underline decoration-2 underline-offset-4 hover:text-[var(--pd)]"
            >
              Abrir no Google Maps
            </a>
          </section>
        </div>

        <section aria-labelledby="contato" className="bg-[var(--pd)] text-white">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 id="contato" className="site-display max-w-[20ch] text-4xl font-semibold leading-tight sm:text-5xl">
              Fale com a {business.name}
            </h2>
            <p className="mt-4 text-lg text-white/80">{business.phoneDisplay}</p>
            <a
              href={contact.href}
              {...contactLinkProps}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-[var(--pd)] transition-colors hover:bg-[var(--soft)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--a)]"
            >
              <ContactIcon className="size-5" aria-hidden />
              {contact.label}
            </a>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-5 py-10 text-sm text-stone-500 sm:px-8">
        <p className="font-medium text-stone-700">{business.name}</p>
        {business.address ? <p className="mt-1">{business.address}</p> : null}
        {mode === 'published' && agency.name ? <p className="mt-4">Site criado por {agency.name}</p> : null}
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 p-3 backdrop-blur sm:hidden">
        <a href={contact.href} {...contactLinkProps} className={`${primaryButton} w-full`}>
          <ContactIcon className="size-5" aria-hidden />
          {contact.label}
        </a>
      </div>
    </div>
  );
}
