import { addMonths, compact, initials, money, monthLabel, parseMoney, pct } from './format';

describe('format utils', () => {
  it('formata valores em BRL', () => {
    expect(money(24583.4)).toBe('R$ 24.583,40');
    expect(money(-89.9)).toBe('− R$ 89,90');
    expect(money(1200, { sign: true })).toBe('+ R$ 1.200,00');
    expect(money(2150, { decimals: false })).toBe('R$ 2.150');
  });

  it('formata percentuais e valores compactos', () => {
    expect(pct(36.9, 1)).toBe('36,9%');
    expect(compact(10000)).toBe('10 mil');
    expect(compact(2500)).toBe('2,5 mil');
  });

  it('converte texto em número', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56);
    expect(parseMoney('89,9')).toBe(89.9);
    expect(parseMoney('R$ 2.500,00')).toBe(2500);
  });

  it('navega entre meses', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-11')).toBe('Novembro 2026');
  });

  it('gera iniciais', () => {
    expect(initials('Matheus Assis')).toBe('MA');
    expect(initials('Matheus')).toBe('MA');
  });
});
