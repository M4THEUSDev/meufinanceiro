import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { StoreService } from './store.service';
import { UiService } from './ui.service';

/** Exportação de dados: CSV (compartilhar/baixar) e relatório para impressão/PDF */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly store = inject(StoreService);
  private readonly ui = inject(UiService);

  async saveFile(name: string, content: string, mime: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: name, url: res.uri, dialogTitle: 'Exportar' });
      return;
    }
    const blob = new Blob(['﻿' + content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async exportCsv(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    await this.saveFile(`meufinanceiro-transacoes-${date}.csv`, this.store.exportCsv(), 'text/csv');
    await this.ui.toast({ title: 'Exportação concluída', message: `${this.store.transactions().length} transações em CSV` });
  }

  async exportBackup(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    await this.saveFile(`meufinanceiro-backup-${date}.json`, this.store.exportJson(), 'application/json');
    await this.ui.toast({ title: 'Backup gerado', message: 'Arquivo JSON com todos os seus dados' });
  }

  /** abre o relatório em uma janela pronta para "Salvar como PDF" */
  printReport(title: string, html: string): void {
    const w = window.open('', '_blank');
    if (!w) {
      void this.ui.toast({ title: 'Não foi possível abrir o relatório', message: 'Permita pop-ups para exportar em PDF.', tone: 'warning' });
      return;
    }
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Inter,-apple-system,sans-serif;color:#0f172a;padding:32px;max-width:760px;margin:auto}
      h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px}p{color:#64748b;margin:0}
      table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
      td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.kpi{display:flex;gap:12px}.kpi div{flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:12px}
      .kpi b{display:block;font-size:18px;margin-top:4px}</style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }
}
