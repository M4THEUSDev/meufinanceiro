const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const HIDDEN_MASK = 'R$ •••••';

/** "R$ 1.234,56" */
export function money(v: number, opts: { sign?: boolean; decimals?: boolean } = {}): string {
  const abs = Math.abs(v);
  const s = (opts.decimals === false ? brl0 : brl).format(abs);
  if (opts.sign) {
    if (v > 0) return `+ R$ ${s}`;
    if (v < 0) return `− R$ ${s}`;
  } else if (v < 0) {
    return `− R$ ${s}`;
  }
  return `R$ ${s}`;
}

/** "10 mil", "2,5 mil" */
export function compact(v: number): string {
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(k)} mil`;
  }
  return brl0.format(v);
}

export function pct(v: number, decimals = 0): string {
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)}%`;
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthKey(k: string): Date {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function addMonths(k: string, n: number): string {
  const d = parseMonthKey(k);
  d.setMonth(d.getMonth() + n);
  return monthKey(d);
}

/** "Novembro 2026" */
export function monthLabel(k: string): string {
  const d = parseMonthKey(k);
  return `${cap(MONTHS[d.getMonth()])} ${d.getFullYear()}`;
}

/** "dez/2027" */
export function monthShortLabel(k: string): string {
  const d = parseMonthKey(k);
  return `${MONTHS_SHORT[d.getMonth()]}/${d.getFullYear()}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Hoje, 08:42" | "Ontem" | "24 nov" */
export function relativeDay(iso: string, withTime = true): string {
  const d = new Date(iso);
  const diff = daysBetween(d, new Date());
  if (diff === 0) return withTime ? `Hoje, ${hhmm(d)}` : 'Hoje';
  if (diff === 1) return 'Ontem';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Hoje · 26 de novembro" / "Segunda · 24 de novembro" */
export function dayHeader(d: Date): string {
  const diff = daysBetween(d, new Date());
  const prefix = diff === 0 ? 'Hoje' : diff === 1 ? 'Ontem' : WEEKDAYS[d.getDay()];
  return `${prefix} · ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** "26 de novembro de 2026" */
export function longDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "26/11/2026" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** date input value "YYYY-MM-DD" */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromDateInput(v: string, keepTimeFrom?: string): string {
  const [y, m, day] = v.split('-').map(Number);
  const base = keepTimeFrom ? new Date(keepTimeFrom) : new Date();
  return new Date(y, m - 1, day, base.getHours(), base.getMinutes()).toISOString();
}

/** Converte "1.234,56" / "1234,5" / "1234.56" em número */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input;
  if (!input) return 0;
  const s = String(input).replace(/[^\d,.-]/g, '');
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(s) || 0;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? '')).toUpperCase();
}
