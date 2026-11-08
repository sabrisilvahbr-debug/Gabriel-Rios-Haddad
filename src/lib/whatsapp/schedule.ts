import type { Settings } from '@/lib/db/schema';
import { saoPauloParts } from '@/lib/time';

export { saoPauloParts } from '@/lib/time';

/** Dentro dos dias e horas de envio (horário de Brasília; hora final não incluída). */
export function isWithinWindow(
  date: Date,
  settings: Pick<Settings, 'windowDays' | 'windowStartHour' | 'windowEndHour'>,
): boolean {
  const { weekday, hour } = saoPauloParts(date);
  const days = settings.windowDays.split(',').map((d) => Number(d.trim()));
  return days.includes(weekday) && hour >= settings.windowStartHour && hour < settings.windowEndHour;
}

/** Intervalo aleatório até o próximo envio, em milissegundos. */
export function nextDelayMs(
  settings: Pick<Settings, 'minIntervalMin' | 'maxIntervalMin'>,
  random: () => number = Math.random,
): number {
  const min = settings.minIntervalMin * 60_000;
  const max = Math.max(settings.maxIntervalMin, settings.minIntervalMin) * 60_000;
  return Math.round(min + random() * (max - min));
}
