import { optionalEnv } from '@/lib/env';
import { NICHE_THEMES } from '@/lib/niches';
import { clampContent, CONTENT_LIMITS as L, fallbackContent, type SiteCopyInput } from '@/lib/sites/content';
import type { SiteContent } from '@/lib/types';
import { generateJson } from './gemini';

const SYSTEM = [
  'Você escreve os textos de sites de pequenas empresas brasileiras.',
  'Escreva em português do Brasil, com tom simpático, claro e profissional.',
  'Use apenas as informações fornecidas. Não invente preços, promoções, anos de experiência, prêmios,',
  'certificações, marcas, entregas, convênios nem serviços específicos que não estejam nos dados.',
  'Quando faltar informação, use frases genéricas que sejam verdadeiras para qualquer empresa do ramo.',
  'Não use emojis nem aspas. Respeite os limites de caracteres indicados.',
].join(' ');

const str = (description: string) => ({ type: 'STRING', description });

export const SITE_CONTENT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    heroTitle: str(`Título principal, até ${L.heroTitle} caracteres. Normalmente o nome da empresa.`),
    heroSubtitle: str(`Frase curta com o principal benefício e a cidade, até ${L.heroSubtitle} caracteres.`),
    about: str(`Texto "sobre nós" com 2 parágrafos curtos, até ${L.about} caracteres no total.`),
    services: {
      type: 'ARRAY',
      minItems: L.servicesMin,
      maxItems: L.servicesMax,
      items: {
        type: 'OBJECT',
        properties: {
          title: str(`Nome do serviço, até ${L.serviceTitle} caracteres.`),
          description: str(`Descrição genérica do serviço, até ${L.serviceDescription} caracteres.`),
        },
        required: ['title', 'description'],
      },
    },
    highlights: {
      type: 'ARRAY',
      minItems: L.highlightsMin,
      maxItems: L.highlightsMax,
      items: str(`Diferencial curto e genérico, até ${L.highlight} caracteres.`),
    },
    ctaText: str(`Texto do botão que abre o WhatsApp, até ${L.ctaText} caracteres.`),
    seoDescription: str(`Descrição para o Google com o nome e a cidade, até ${L.seoDescription} caracteres.`),
  },
  required: ['heroTitle', 'heroSubtitle', 'about', 'services', 'highlights', 'ctaText', 'seoDescription'],
  propertyOrdering: ['heroTitle', 'heroSubtitle', 'about', 'services', 'highlights', 'ctaText', 'seoDescription'],
};

export function buildSiteCopyPrompt(input: SiteCopyInput): string {
  const lines = [
    `Empresa: ${input.name}`,
    `Categoria no Google: ${input.category || 'não informada'}`,
    `Ramo: ${NICHE_THEMES[input.niche].label}`,
    `Cidade: ${input.city || 'não informada'}`,
  ];
  if (input.neighborhood) lines.push(`Bairro: ${input.neighborhood}`);
  if (input.rating !== null) {
    const count = input.reviewsCount ? ` (${input.reviewsCount} avaliações)` : '';
    lines.push(`Nota no Google: ${input.rating.toFixed(1).replace('.', ',')}${count}`);
  }
  if (input.description) lines.push(`Descrição no Google: ${input.description}`);
  if (input.openingHours.length) {
    lines.push(`Horário: ${input.openingHours.map((h) => `${h.day} ${h.hours}`).join('; ')}`);
  }
  lines.push(
    '',
    'Gere o conteúdo do site desta empresa: título, subtítulo, texto sobre, 3 a 6 serviços típicos do ramo',
    '(descritos de forma genérica), 3 ou 4 diferenciais curtos, o texto do botão do WhatsApp e a descrição para o Google.',
  );
  return lines.join('\n');
}

/** Textos do site pela IA; se algo der errado, os textos padrão do ramo. Nunca lança erro. */
export async function generateSiteContent(
  input: SiteCopyInput,
): Promise<{ content: SiteContent; source: 'ia' | 'padrao' }> {
  if (!optionalEnv('GEMINI_API_KEY')) return { content: fallbackContent(input), source: 'padrao' };
  try {
    const raw = await generateJson({
      system: SYSTEM,
      prompt: buildSiteCopyPrompt(input),
      responseSchema: SITE_CONTENT_RESPONSE_SCHEMA,
      temperature: 0.8,
    });
    const content = clampContent(raw);
    if (content) return { content, source: 'ia' };
    console.warn('[site-copy] resposta do Gemini fora do formato; usando textos padrão.');
  } catch (error) {
    console.warn('[site-copy] Gemini falhou; usando textos padrão:', error instanceof Error ? error.message : error);
  }
  return { content: fallbackContent(input), source: 'padrao' };
}
