import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateJson } from '@/lib/ai/gemini';
import { generateSiteContent } from '@/lib/ai/site-copy';
import type { SiteCopyInput } from '@/lib/sites/content';

const input: SiteCopyInput = {
  name: 'Barbearia do Zé',
  category: 'Barbearia',
  niche: 'beleza',
  city: 'Campinas',
  neighborhood: 'Centro',
  rating: 4.7,
  reviewsCount: 88,
  description: '',
  openingHours: [{ day: 'segunda-feira', hours: '09:00–19:00' }],
};

const content = {
  heroTitle: 'Barbearia do Zé',
  heroSubtitle: 'Corte e barba no Centro de Campinas.',
  about: 'Uma barbearia de bairro com atendimento caprichado.',
  services: [
    { title: 'Corte', description: 'Na tesoura ou na máquina.' },
    { title: 'Barba', description: 'Com toalha quente.' },
    { title: 'Sobrancelha', description: 'Acabamento rápido.' },
  ],
  highlights: ['Atendimento caprichado', 'Ambiente climatizado', 'Agende pelo WhatsApp'],
  ctaText: 'Agendar pelo WhatsApp',
  seoDescription: 'Barbearia no Centro de Campinas.',
};

function geminiResponse(parts: Array<{ text?: string; thought?: boolean }>, status = 200) {
  return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'chave-teste');
  vi.stubEnv('GEMINI_MODEL', '');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('generateJson', () => {
  it('calls the default model with a JSON response config', async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: '{"ok":true}' }]));
    await generateJson({ system: 'sys', prompt: 'oi', responseSchema: { type: 'OBJECT' } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(init.headers['x-goog-api-key']).toBe('chave-teste');
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toEqual({ type: 'OBJECT' });
    expect(body.systemInstruction.parts[0].text).toBe('sys');
  });

  it('ignores thought parts and parses the answer', async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: 'pensando…', thought: true }, { text: '{"a":1}' }]));
    expect(await generateJson({ system: '', prompt: '', responseSchema: {} })).toEqual({ a: 1 });
  });

  it('accepts JSON wrapped in a code fence', async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: '```json\n{"a":2}\n```' }]));
    expect(await generateJson({ system: '', prompt: '', responseSchema: {} })).toEqual({ a: 2 });
  });

  it('throws on HTTP errors', async () => {
    fetchMock.mockResolvedValue(new Response('quota', { status: 429 }));
    await expect(generateJson({ system: '', prompt: '', responseSchema: {} })).rejects.toThrow(/429/);
  });
});

describe('generateSiteContent', () => {
  it('uses the AI content when it is valid', async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: JSON.stringify(content) }]));
    const result = await generateSiteContent(input);
    expect(result.source).toBe('ia');
    expect(result.content.ctaText).toBe('Agendar pelo WhatsApp');
  });

  it('cuts long AI text instead of discarding it', async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: JSON.stringify({ ...content, heroTitle: 'x'.repeat(120) }) }]));
    const result = await generateSiteContent(input);
    expect(result.source).toBe('ia');
    expect(result.content.heroTitle).toHaveLength(80);
  });

  it('falls back to the default texts on HTTP 500', async () => {
    fetchMock.mockResolvedValue(new Response('erro', { status: 500 }));
    const result = await generateSiteContent(input);
    expect(result.source).toBe('padrao');
    expect(result.content.heroTitle).toBe('Barbearia do Zé');
  });

  it('falls back when the answer is not JSON', async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: 'oops' }]));
    expect((await generateSiteContent(input)).source).toBe('padrao');
  });

  it('falls back without calling Gemini when there is no key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await generateSiteContent(input)).source).toBe('padrao');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the business data in the prompt', async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: JSON.stringify(content) }]));
    await generateSiteContent(input);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt: string = body.contents[0].parts[0].text;
    expect(prompt).toContain('Barbearia do Zé');
    expect(prompt).toContain('Campinas');
    expect(prompt).toContain('4,7');
  });
});
