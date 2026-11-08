import { env, optionalEnv } from '@/lib/env';

export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export function geminiModel(): string {
  return optionalEnv('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : trimmed;
}

export interface GenerateJsonOptions {
  system: string;
  prompt: string;
  /** Esquema no formato do Gemini (subconjunto do OpenAPI: type, properties, items, required…). */
  responseSchema: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
}

/** Pede ao Gemini uma resposta em JSON e devolve o objeto já lido (sem validar a forma). */
export async function generateJson(options: GenerateJsonOptions): Promise<unknown> {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: options.responseSchema,
        temperature: options.temperature ?? 0.7,
      },
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new GeminiError(`Gemini respondeu ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const answer = [...parts].reverse().find((p) => typeof p.text === 'string' && !p.thought);
  if (!answer?.text) {
    const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason ?? 'sem resposta';
    throw new GeminiError(`Gemini não devolveu texto (${reason}).`);
  }

  try {
    return JSON.parse(stripCodeFence(answer.text));
  } catch {
    throw new GeminiError('Gemini devolveu um JSON inválido.');
  }
}
