import { MAX_RESULTS_LIMIT } from '@/lib/constants';
import type { SettingsPatch } from '@/lib/db/settings';
import { normalizeBrazilPhone } from '@/lib/phone';

type Parsed = { ok: true; patch: SettingsPatch } | { ok: false; message: string };

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const checked = (data: FormData, name: string) => data.get(name) === 'on';

function int(data: FormData, name: string, label: string, min: number, max: number): number {
  const value = Number(text(data, name));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}: use um número inteiro de ${min} a ${max}.`);
  }
  return value;
}

/** Valida e converte o formulário de Configurações. */
export function parseSettingsForm(data: FormData): Parsed {
  try {
    const rawWhatsapp = text(data, 'agencyWhatsapp');
    let agencyWhatsapp = '';
    if (rawWhatsapp) {
      const phone = normalizeBrazilPhone(rawWhatsapp);
      if (!phone || !phone.isMobile) throw new Error('WhatsApp da agência: informe um celular com DDD.');
      agencyWhatsapp = phone.e164;
    }

    const windowDays = data
      .getAll('windowDays')
      .map(String)
      .filter((d) => /^[0-6]$/.test(d));
    if (!windowDays.length) throw new Error('Escolha pelo menos um dia da semana para os envios.');

    const windowStartHour = int(data, 'windowStartHour', 'Início dos envios', 0, 23);
    const windowEndHour = int(data, 'windowEndHour', 'Fim dos envios', 1, 24);
    if (windowEndHour <= windowStartHour) throw new Error('O horário final dos envios precisa ser depois do inicial.');

    const minIntervalMin = int(data, 'minIntervalMin', 'Intervalo mínimo', 1, 120);
    const maxIntervalMin = int(data, 'maxIntervalMin', 'Intervalo máximo', 1, 240);
    if (maxIntervalMin < minIntervalMin) throw new Error('O intervalo máximo precisa ser maior ou igual ao mínimo.');

    const messageTemplates = data
      .getAll('messageTemplates')
      .map((t) => String(t).trim())
      .filter(Boolean);
    if (!messageTemplates.length) throw new Error('Escreva pelo menos um modelo de primeira mensagem.');
    if (messageTemplates.some((t) => !t.includes('{link}'))) {
      throw new Error('Todo modelo de primeira mensagem precisa ter {link}, que vira o endereço da prévia.');
    }

    const followUpEnabled = checked(data, 'followUpEnabled');
    const followUpTemplate = text(data, 'followUpTemplate');
    if (followUpEnabled && !followUpTemplate) throw new Error('Escreva o texto do lembrete ou desligue o lembrete.');

    const offerText = text(data, 'offerText');
    if (offerText.length > 2000) throw new Error('O texto da oferta pode ter no máximo 2.000 caracteres.');

    return {
      ok: true,
      patch: {
        agencyName: text(data, 'agencyName').slice(0, 80),
        agencyWhatsapp,
        includeLandlines: checked(data, 'includeLandlines'),
        defaultMaxResults: int(data, 'defaultMaxResults', 'Empresas por busca', 1, MAX_RESULTS_LIMIT),
        outreachEnabled: checked(data, 'outreachEnabled'),
        dailyLimit: int(data, 'dailyLimit', 'Limite diário', 1, 100),
        windowDays: windowDays.join(','),
        windowStartHour,
        windowEndHour,
        minIntervalMin,
        maxIntervalMin,
        messageTemplates,
        followUpEnabled,
        followUpAfterDays: int(data, 'followUpAfterDays', 'Dias até o lembrete', 1, 30),
        followUpTemplate,
        aiRepliesEnabled: checked(data, 'aiRepliesEnabled'),
        aiMaxReplies: int(data, 'aiMaxReplies', 'Respostas da IA por conversa', 1, 30),
        offerText,
      },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
