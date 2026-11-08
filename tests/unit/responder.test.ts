import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildResponderSystemPrompt, generateReply, type ReplyContext } from '@/lib/ai/responder';

const context = (overrides: Partial<ReplyContext> = {}): ReplyContext => ({
  agencyName: 'Agência Sol',
  offerText: 'Site de uma página por R$ 497 à vista. Entrega em 2 dias úteis.',
  businessName: 'Barbearia do Zé',
  category: 'Barbearia',
  city: 'Campinas',
  previewUrl: 'https://zap.vercel.app/s/barbearia-do-ze-campinas',
  history: [
    { from: 'nos', text: 'Oi! Montei uma prévia do site de vocês.' },
    { from: 'empresa', text: 'Quanto custa?' },
  ],
  ...overrides,
});

function gemini(payload: unknown, status = 200) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), { status });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'chave');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('buildResponderSystemPrompt', () => {
  it('includes the agency, the offer, the preview and the rules', () => {
    const prompt = buildResponderSystemPrompt(context());
    expect(prompt).toContain('Agência Sol');
    expect(prompt).toContain('R$ 497');
    expect(prompt).toContain('https://zap.vercel.app/s/barbearia-do-ze-campinas');
    expect(prompt).toContain('assistente virtual');
  });

  it('forbids prices when there is no offer', () => {
    const prompt = buildResponderSystemPrompt(context({ offerText: '' }));
    expect(prompt).toContain('Não informe preços');
  });
});

describe('generateReply', () => {
  it('returns the reply, intent and handoff from Gemini', async () => {
    fetchMock.mockResolvedValue(gemini({ reply: 'Fica R$ 497 à vista. Quer que eu coloque no ar?', intent: 'duvida', handoff: false }));
    expect(await generateReply(context())).toEqual({
      reply: 'Fica R$ 497 à vista. Quer que eu coloque no ar?',
      intent: 'duvida',
      handoff: false,
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toContain('Barbearia do Zé: Quanto custa?');
  });

  it('normalizes an unknown intent', async () => {
    fetchMock.mockResolvedValue(gemini({ reply: 'Oi!', intent: 'talvez', handoff: 'sim' }));
    expect(await generateReply(context())).toEqual({ reply: 'Oi!', intent: 'outro', handoff: false });
  });

  it('fails on an empty reply', async () => {
    fetchMock.mockResolvedValue(gemini({ reply: '  ', intent: 'outro', handoff: false }));
    await expect(generateReply(context())).rejects.toThrow();
  });
});
