import { describe, expect, it } from 'vitest';
import { isWithinWindow, nextDelayMs } from '@/lib/whatsapp/schedule';
import { DEFAULT_FIRST_TEMPLATES, pickTemplate, renderTemplate } from '@/lib/whatsapp/templates';

const window = { windowDays: '1,2,3,4,5,6', windowStartHour: 9, windowEndHour: 18 };

describe('isWithinWindow', () => {
  it('allows Saturday morning in Brasília', () => {
    expect(isWithinWindow(new Date('2026-11-14T13:00:00Z'), window)).toBe(true); // sáb 10:00
  });

  it('blocks Sunday', () => {
    expect(isWithinWindow(new Date('2026-11-15T13:00:00Z'), window)).toBe(false); // dom 10:00
  });

  it('treats the end hour as exclusive and the start hour as inclusive', () => {
    expect(isWithinWindow(new Date('2026-11-09T21:00:00Z'), window)).toBe(false); // seg 18:00
    expect(isWithinWindow(new Date('2026-11-09T20:59:00Z'), window)).toBe(true); // seg 17:59
    expect(isWithinWindow(new Date('2026-11-09T11:59:00Z'), window)).toBe(false); // seg 08:59
    expect(isWithinWindow(new Date('2026-11-09T12:00:00Z'), window)).toBe(true); // seg 09:00
  });
});

describe('nextDelayMs', () => {
  it('stays between the minimum and the maximum interval', () => {
    expect(nextDelayMs({ minIntervalMin: 4, maxIntervalMin: 12 }, () => 0)).toBe(240_000);
    const high = nextDelayMs({ minIntervalMin: 4, maxIntervalMin: 12 }, () => 0.9999);
    expect(high).toBeGreaterThanOrEqual(240_000);
    expect(high).toBeLessThan(720_000);
  });
});

describe('templates', () => {
  it('every default first message has the link and the opt-out', () => {
    for (const template of DEFAULT_FIRST_TEMPLATES) {
      expect(template).toContain('{link}');
      expect(template).toContain('SAIR');
    }
  });

  it('renders known variables and keeps unknown ones', () => {
    expect(renderTemplate('Oi {empresa} {x}', { empresa: 'Zé' })).toBe('Oi Zé {x}');
    expect(
      renderTemplate('{agencia}: {empresa} de {cidade} ({ramo}) {link}', {
        agencia: 'Sol',
        empresa: 'Padaria',
        cidade: 'Campinas',
        ramo: 'padaria',
        link: 'https://x/s/p',
      }),
    ).toBe('Sol: Padaria de Campinas (padaria) https://x/s/p');
  });

  it('picks a non-empty template with the random function', () => {
    expect(pickTemplate(['a', '', 'b', 'c'], () => 0.5)).toBe('b');
    expect(pickTemplate(['a', 'b', 'c'], () => 0)).toBe('a');
  });
});
