import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ActionSheetController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSegment, IonSegmentButton, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { Category, Transaction } from '../../core/models/models';
import { ExportService } from '../../core/services/export.service';
import { StoreService } from '../../core/services/store.service';
import { MONTHS, MONTHS_SHORT, addMonths, cap, compact, money, monthKey, monthLabel, parseMonthKey, pct, round2 } from '../../core/utils/format';
import { DonutComponent } from '../../shared/components/donut.component';
import { LineChartComponent, LinePoint } from '../../shared/components/line-chart.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

type Period = 'month' | 'quarter' | 'year';

interface Agg {
  income: number;
  expense: number;
  txs: Transaction[];
  byCat: Map<string, number>;
}

/** [Z3] Relatórios */
@Component({
  selector: 'mf-reports',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, IonSegment, IonSegmentButton, DonutComponent, LineChartComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
})
export class ReportsPage {
  protected readonly store = inject(StoreService);
  private readonly exporter = inject(ExportService);
  private readonly sheet = inject(ActionSheetController);

  readonly period = signal<Period>('month');
  /** mês âncora (último mês do período) */
  readonly anchor = signal(this.store.selectedMonth());
  readonly lineIndex = signal(-1);
  readonly slice = signal<string | null>(null);
  readonly pct = pct;
  protected readonly Math = Math;

  readonly size = computed(() => ({ month: 1, quarter: 3, year: 12 })[this.period()]);
  /** meses do período atual */
  readonly months = computed(() => {
    const a = this.anchor();
    if (this.period() === 'year') {
      const y = parseMonthKey(a).getFullYear();
      return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
    }
    if (this.period() === 'quarter') {
      const d = parseMonthKey(a);
      const q0 = Math.floor(d.getMonth() / 3) * 3;
      return Array.from({ length: 3 }, (_, i) => monthKey(new Date(d.getFullYear(), q0 + i, 1)));
    }
    return [a];
  });
  readonly prevMonths = computed(() => this.months().map((m) => addMonths(m, -this.size())));
  readonly label = computed(() => {
    const d = parseMonthKey(this.anchor());
    if (this.period() === 'year') return String(d.getFullYear());
    if (this.period() === 'quarter') return `${Math.floor(d.getMonth() / 3) + 1}º trimestre ${d.getFullYear()}`;
    return monthLabel(this.anchor());
  });
  readonly prevShort = computed(() => {
    if (this.period() === 'year') return String(parseMonthKey(this.anchor()).getFullYear() - 1);
    if (this.period() === 'quarter') return 'tri anterior';
    return MONTHS_SHORT[parseMonthKey(addMonths(this.anchor(), -1)).getMonth()];
  });
  readonly canNext = computed(() => this.months().at(-1)! < monthKey(new Date()));

  private agg(months: string[]): Agg {
    const set = new Set(months);
    const txs = this.store.transactions().filter((t) => set.has(monthKey(new Date(t.date))));
    const byCat = new Map<string, number>();
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      if (t.type === 'income') income += t.amount;
      else {
        expense += t.amount;
        byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
      }
    }
    return { income: round2(income), expense: round2(expense), txs, byCat };
  }
  readonly cur = computed(() => this.agg(this.months()));
  readonly prev = computed(() => this.agg(this.prevMonths()));
  readonly savings = computed(() => (this.cur().income ? ((this.cur().income - this.cur().expense) / this.cur().income) * 100 : 0));
  readonly prevSavings = computed(() => (this.prev().income ? ((this.prev().income - this.prev().expense) / this.prev().income) * 100 : 0));

  delta(a: number, b: number): string {
    if (!b) return '—';
    const d = ((a - b) / b) * 100;
    return `${d >= 0 ? '+' : '−'}${pct(Math.abs(d), 1)} vs ${this.prevShort()}`;
  }
  readonly incomeDelta = computed(() => this.delta(this.cur().income, this.prev().income));
  readonly expenseDelta = computed(() => this.delta(this.cur().expense, this.prev().expense));
  readonly savingsDelta = computed(() => {
    const d = this.savings() - this.prevSavings();
    return `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p. vs ${this.prevShort()}`;
  });

  readonly evolution = computed<LinePoint[]>(() => {
    const end = this.months().at(-1)!;
    const list = Array.from({ length: 12 }, (_, i) => {
      const k = addMonths(end, i - 11);
      const s = this.store.summary(k);
      const d = parseMonthKey(k);
      return { label: MONTHS[d.getMonth()][0].toUpperCase(), longLabel: cap(MONTHS[d.getMonth()]), income: s.income, expense: s.expense };
    });
    // descarta meses iniciais sem nenhum lançamento
    const first = list.findIndex((p) => p.income || p.expense);
    return first > 0 ? list.slice(first) : list;
  });
  readonly netBars = computed(() => {
    const end = this.months().at(-1)!;
    const list = this.store.history(end, 6).map((h) => ({ key: h.key, net: h.net, label: cap(MONTHS_SHORT[parseMonthKey(h.key).getMonth()]) }));
    const max = Math.max(1, ...list.map((l) => Math.abs(l.net)));
    return list.map((l, i) => ({ ...l, h: Math.max(4, (Math.abs(l.net) / max) * 84), last: i === list.length - 1, text: `${l.net >= 0 ? '+' : '−'}${compact(Math.abs(l.net)).replace(' mil', 'k')}` }));
  });

  readonly cats = computed(() => {
    const total = this.cur().expense || 1;
    return [...this.cur().byCat.entries()]
      .map(([id, v]) => ({ c: this.store.category(id) as Category, total: round2(v), share: v / total }))
      .filter((x) => x.c)
      .sort((a, b) => b.total - a.total);
  });
  readonly donut = computed(() => this.cats().map((x) => ({ value: x.total, color: x.c.color })));
  readonly selected = computed(() => this.cats().find((x) => x.c.id === this.slice()) ?? this.cats()[0]);
  readonly top = computed(() => this.cats().slice(0, 5));
  readonly selectedId = computed(() => this.selected()?.c.id ?? null);

  readonly compare = computed(() => {
    const prev = this.prev().byCat;
    return this.cats()
      .slice(0, 6)
      .map((x) => {
        const p = prev.get(x.c.id) ?? 0;
        const v = p ? Math.round(((x.total - p) / p) * 100) : null;
        return { name: x.c.name, prev: p, cur: x.total, v };
      });
  });
  readonly prevLabel = computed(() => (this.period() === 'month' ? cap(MONTHS_SHORT[parseMonthKey(addMonths(this.anchor(), -1)).getMonth()]) : 'Anterior'));
  readonly curLabel = computed(() => (this.period() === 'month' ? cap(MONTHS_SHORT[parseMonthKey(this.anchor()).getMonth()]) : 'Atual'));
  readonly compareTitle = computed(() =>
    this.period() === 'month'
      ? `${cap(MONTHS[parseMonthKey(this.anchor()).getMonth()])} vs. ${cap(MONTHS[parseMonthKey(addMonths(this.anchor(), -1)).getMonth()])}`
      : `${this.label()} vs. período anterior`,
  );

  readonly stats = computed(() => {
    const expenses = this.cur().txs.filter((t) => t.type === 'expense');
    const biggest = expenses.reduce((m, t) => Math.max(m, t.amount), 0);
    const now = new Date();
    const first = parseMonthKey(this.months()[0]);
    const lastMonth = parseMonthKey(this.months().at(-1)!);
    const endOfPeriod = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);
    const end = endOfPeriod > now ? now : endOfPeriod;
    const days = Math.max(1, Math.round((end.getTime() - first.getTime()) / 86400000) + (end === now ? 1 : 0));
    let positive = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, 23, 59, 59);
      if (this.store.balanceAt(d) > 0) positive++;
    }
    return { biggest, daily: this.cur().expense / days, count: this.cur().txs.length, positive, days };
  });

  shift(n: number): void {
    this.anchor.set(addMonths(this.anchor(), n * this.size()));
    this.slice.set(null);
  }

  setPeriod(p: Period): void {
    this.period.set(p);
    this.slice.set(null);
  }

  fmt(v: number, decimals = true): string {
    return this.store.hidden() ? 'R$ •••••' : money(v, { decimals });
  }

  async export(): Promise<void> {
    const s = await this.sheet.create({
      header: 'Exportar relatório',
      buttons: [
        { text: 'PDF (imprimir / salvar)', handler: () => this.exportPdf() },
        { text: 'CSV das transações', handler: () => void this.exporter.exportCsv() },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await s.present();
  }

  private exportPdf(): void {
    const m = (v: number) => money(v);
    const rows = this.cats().map((x) => `<tr><td>${x.c.name}</td><td class="n">${pct(x.share * 100)}</td><td class="n">${m(x.total)}</td></tr>`).join('');
    const tx = this.cur().txs
      .slice(0, 200)
      .map((t) => `<tr><td>${t.date.slice(0, 10).split('-').reverse().join('/')}</td><td>${t.description}</td><td>${this.store.category(t.categoryId)?.name ?? ''}</td><td class="n">${m(t.type === 'income' ? t.amount : -t.amount)}</td></tr>`)
      .join('');
    this.exporter.printReport(
      `Relatório ${this.label()}`,
      `<h1>Relatório · ${this.label()}</h1><p>${this.store.settings().userName} · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
      <h2>Resumo</h2><div class="kpi"><div>Receitas<b>${m(this.cur().income)}</b></div><div>Despesas<b>${m(this.cur().expense)}</b></div><div>Poupança<b>${pct(this.savings(), 1)}</b></div></div>
      <h2>Gastos por categoria</h2><table><tr><th>Categoria</th><th class="n">%</th><th class="n">Valor</th></tr>${rows}</table>
      <h2>Transações</h2><table><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="n">Valor</th></tr>${tx}</table>`,
    );
  }
}
