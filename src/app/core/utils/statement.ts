/**
 * Leitura de extratos bancários (OFX e CSV) — tudo acontece no aparelho, nada é enviado para fora.
 * Formatos: OFX/QFX (Itaú, Santander, XP, Nubank e a maioria dos bancos), CSV da conta e do cartão Nubank
 * e CSV genérico com colunas de data, descrição e valor.
 */

export type StatementFormat = 'ofx' | 'nubank-conta' | 'nubank-cartao' | 'csv';

export interface StatementLine {
  /** id estável da linha (FITID do OFX, identificador do Nubank ou hash) */
  importId: string;
  date: string; // ISO
  description: string;
  /** positivo = entrada, negativo = saída (do ponto de vista do cliente) */
  amount: number;
}

export interface ParsedStatement {
  format: StatementFormat;
  /** banco detectado (código COMPE) */
  bankCode?: string;
  bankName?: string;
  /** extrato de cartão de crédito */
  isCard: boolean;
  lines: StatementLine[];
}

export const BANKS: Record<string, string> = {
  '260': 'Nubank', '341': 'Itaú', '33': 'Santander', '102': 'XP', '348': 'XP', '77': 'Inter', '104': 'Caixa',
  '1': 'Banco do Brasil', '237': 'Bradesco', '336': 'C6 Bank', '212': 'Banco Original', '380': 'PicPay', '323': 'Mercado Pago',
};

/** decodifica UTF-8 e, se houver caracteres inválidos, tenta Windows-1252 (comum em OFX de bancos brasileiros) */
export function decodeStatement(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  return new TextDecoder('windows-1252').decode(buf);
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function clean(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** valor numérico em "1.234,56", "-23.40", "R$ 10,00", "(5,00)" */
export function parseAmount(raw: string): number {
  let s = (raw ?? '').trim().replace(/R\$\s?/i, '').replace(/\s/g, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    neg = true;
    s = s.slice(0, -1);
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return neg ? -Math.abs(n) : n;
}

/** data em "20261105...", "2026-11-05" ou "05/11/2026" → ISO (meio-dia local, evita troca de dia por fuso) */
export function parseDate(raw: string): string | null {
  const s = (raw ?? '').trim();
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (y < 100) y += 2000;
  } else return null;
  const dt = new Date(y, m - 1, d, 12, 0);
  return Number.isNaN(dt.getTime()) || dt.getMonth() !== m - 1 ? null : dt.toISOString();
}

/** remove prefixos genéricos dos bancos ("Compra no débito - iFood" → "iFood") */
export function tidyDescription(s: string): string {
  return clean(s.replace(/^(compra no (d[eé]bito|cr[eé]dito)( via nupay)?|pagamento efetuado|compra cartao|compra com cart[aã]o|compra)\s*[-–:]\s*/i, '')) || clean(s);
}

function tag(block: string, name: string): string {
  const r = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'));
  return r ? clean(r[1]) : '';
}

export function parseOfx(text: string): ParsedStatement {
  const isCard = /<CCSTMTRS>|<CREDITCARDMSGSRSV1>|<CCACCTFROM>/i.test(text);
  const bankId = tag(text, 'BANKID').replace(/^0+/, '');
  const org = tag(text, 'ORG');
  let bankCode = bankId && BANKS[bankId] ? bankId : undefined;
  if (!bankCode && /nu ?pagamentos|nubank/i.test(org)) bankCode = '260';
  if (!bankCode && /ita[uú]/i.test(org)) bankCode = '341';
  if (!bankCode && /santander/i.test(org)) bankCode = '33';
  if (!bankCode && /\bxp\b/i.test(org)) bankCode = '348';
  const account = tag(text, 'ACCTID');
  const blocks = text.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const lines: StatementLine[] = [];
  for (const b of blocks) {
    const amount = parseAmount(tag(b, 'TRNAMT'));
    const date = parseDate(tag(b, 'DTPOSTED'));
    if (!Number.isFinite(amount) || !date) continue;
    const memo = tag(b, 'MEMO');
    const name = tag(b, 'NAME');
    const description = clean(memo && name && !memo.includes(name) ? `${name} ${memo}` : memo || name || tag(b, 'TRNTYPE'));
    const fitid = tag(b, 'FITID');
    lines.push({ importId: `ofx:${bankCode ?? org}:${account}:${fitid || hash(date + amount + description)}`, date, description, amount });
  }
  return { format: 'ofx', bankCode, bankName: bankCode ? BANKS[bankCode] : org || undefined, isCard, lines };
}

/** divide CSV respeitando aspas; detecta separador (vírgula, ponto e vírgula ou tab) */
export function parseCsvRows(text: string): string[][] {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const sep = [';', '\t', ','].map((c) => ({ c, n: first.split(c).length })).sort((a, b) => b.n - a.n)[0].c;
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim()));
      row = [];
      cur = '';
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim()));
  return rows;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function parseCsv(text: string): ParsedStatement {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return { format: 'csv', isCard: false, lines: [] };
  const header = rows[0].map(norm);
  const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));

  // Nubank — cartão: date,title,amount (valor positivo = compra)
  if (header.join(',') === 'date,title,amount') {
    const lines = rows.slice(1).flatMap((r) => {
      const date = parseDate(r[0]);
      const amount = parseAmount(r[2]);
      if (!date || !Number.isFinite(amount)) return [];
      return [{ importId: `nucard:${hash(r.join('|'))}`, date, description: clean(r[1]), amount: -amount }];
    });
    return { format: 'nubank-cartao', bankCode: '260', bankName: 'Nubank', isCard: true, lines: dedupeIds(lines) };
  }
  // Nubank — conta: Data,Valor,Identificador,Descrição
  const iData = idx('data', 'date');
  const iValor = idx('valor', 'amount', 'value', 'quantia');
  const iId = idx('identificador', 'id');
  const iDesc = idx('descricao', 'description', 'historico', 'lancamento', 'title', 'estabelecimento', 'memo');
  const iDeb = idx('debito', 'saida');
  const iCred = idx('credito', 'entrada');
  const isNuConta = header[0] === 'data' && header[1] === 'valor' && header[2] === 'identificador';
  if (iData < 0 || iDesc < 0 || (iValor < 0 && iDeb < 0 && iCred < 0)) return { format: 'csv', isCard: false, lines: [] };
  const lines = rows.slice(1).flatMap((r) => {
    const date = parseDate(r[iData]);
    let amount = iValor >= 0 ? parseAmount(r[iValor]) : NaN;
    if (!Number.isFinite(amount)) {
      const deb = iDeb >= 0 ? parseAmount(r[iDeb]) : NaN;
      const cred = iCred >= 0 ? parseAmount(r[iCred]) : NaN;
      amount = Number.isFinite(cred) && cred !== 0 ? Math.abs(cred) : Number.isFinite(deb) ? -Math.abs(deb) : NaN;
    }
    if (!date || !Number.isFinite(amount) || amount === 0) return [];
    const id = iId >= 0 && r[iId] ? `${isNuConta ? 'nuconta' : 'csv'}:${r[iId]}` : `csv:${hash(r.join('|'))}`;
    return [{ importId: id, date, description: clean(r[iDesc] ?? ''), amount }];
  });
  return isNuConta
    ? { format: 'nubank-conta', bankCode: '260', bankName: 'Nubank', isCard: false, lines: dedupeIds(lines) }
    : { format: 'csv', isCard: false, lines: dedupeIds(lines) };
}

/** linhas idênticas no mesmo arquivo (ex.: duas compras iguais no mesmo dia) recebem sufixo */
function dedupeIds(lines: StatementLine[]): StatementLine[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const n = seen.get(l.importId) ?? 0;
    seen.set(l.importId, n + 1);
    return n ? { ...l, importId: `${l.importId}#${n}` } : l;
  });
}

export function parseStatement(text: string, fileName = ''): ParsedStatement {
  if (/<OFX>|OFXHEADER/i.test(text) || /\.(ofx|qfx)$/i.test(fileName)) return parseOfx(text);
  return parseCsv(text);
}

// ---------------- Categorização ----------------

const RULES: [RegExp, string][] = [
  [/uber|99 ?(pop|app|taxi)?\b|cabify|posto|shell|ipiranga|petrobras|combust|estaciona|sem parar|veloe|conectcar|metro|bilhete|onibus|passagem urbana/, 'c_transporte'],
  [/ifood|rappi|restaurante|lanchonete|padaria|mercado|supermerc|carrefour|assai|atacad|pao de acucar|extra |hortifruti|acougue|burger|mc ?donald|bk |starbucks|cafe|pizza|sushi|zé delivery|ze delivery|daki|feira/, 'c_alimentacao'],
  [/netflix|spotify|amazon prime|prime video|disney|hbo|max\.com|globoplay|youtube|apple\.com|icloud|google (one|storage)|deezer|paramount|crunchyroll|chatgpt|openai/, 'c_assinaturas'],
  [/drogasil|droga raia|raia|drogaria|farmacia|pague menos|hospital|clinica|laborat|unimed|amil|sulamerica|hapvida|odonto|dentista|smart ?fit|academia|bluefit/, 'c_saude'],
  [/escola|faculdade|universidade|curso|udemy|alura|coursera|livraria|educa/, 'c_educacao'],
  [/aluguel|condominio|iptu|enel|light|cemig|copel|sabesp|cedae|comgas|energia|agua e esgoto|internet|vivo|claro|tim |oi fibra|net servicos/, 'c_moradia'],
  [/cinema|kinoplex|cinemark|ingresso|show|teatro|steam|playstation|xbox|nintendo|bar |balada|viagem|hotel|airbnb|booking|decolar|latam|gol linhas|azul linhas/, 'c_lazer'],
  [/amazon|mercado ?livre|mercadolivre|shopee|aliexpress|shein|magalu|magazine|americanas|casas bahia|renner|riachuelo|c&a|zara|leroy|kalunga|centauro|netshoes/, 'c_compras'],
  [/emprestimo|financiamento|parcela credito|consignado|juros|iof|tarifa|anuidade/, 'c_dividas'],
  [/petz|cobasi|veterin|pet ?shop/, 'c_pets'],
];

const INCOME_RULES: [RegExp, string][] = [
  [/salario|folha|pagamento de salario|proventos|remuneracao/, 'c_salario'],
  [/rendimento|juros sobre|dividendo|jcp|resgate cdb/, 'c_rendimentos'],
  [/estorno|reembolso|devolucao|cashback/, 'c_reembolso'],
];

/** movimentações que normalmente são transferências entre contas próprias (não devem contar como gasto/ganho) */
export const TRANSFER_RE = /pagamento de fatura|pagamento fatura|pgto fatura|fatura (do )?cart|pagamento recebido|aplicacao|resgate|rdb|caixinha|transferencia entre contas|mesma titularidade|guardado|investimento|tesouro direto/;

export function guessCategory(description: string, amount: number, valid: Set<string>, learned: Map<string, string>): string | null {
  const d = norm(description);
  const key = learnKey(description);
  const fromHistory = learned.get(`${amount < 0 ? 'e' : 'i'}:${key}`);
  if (fromHistory && valid.has(fromHistory)) return fromHistory;
  const rules = amount < 0 ? RULES : INCOME_RULES;
  for (const [re, id] of rules) if (re.test(d) && valid.has(id)) return id;
  return null;
}

/** chave para aprender a categoria a partir do histórico (primeiras palavras significativas) */
export function learnKey(description: string): string {
  return norm(description)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !['compra', 'pix', 'debito', 'credito', 'transferencia', 'enviada', 'recebida', 'pelo', 'para', 'com'].includes(w))
    .slice(0, 2)
    .join(' ');
}

export function isLikelyTransfer(description: string): boolean {
  return TRANSFER_RE.test(norm(description));
}
