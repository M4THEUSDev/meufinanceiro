import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { UiService } from './ui.service';

/** PWA: avisa quando há uma nova versão publicada e recarrega ao tocar em "Atualizar" */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly sw = inject(SwUpdate);
  private readonly ui = inject(UiService);

  init(): void {
    if (!this.sw.isEnabled) return;
    this.sw.versionUpdates.pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY')).subscribe(() => {
      void this.ui.toast({
        title: 'Nova versão disponível',
        message: 'Toque em Atualizar para usar a versão mais recente. Se fechar, ela entra na próxima vez que abrir o app.',
        tone: 'info',
        duration: 0, // fica na tela até tocar em Atualizar (ou arrastar para fechar)
        action: { text: 'Atualizar', handler: () => document.location.reload() },
      });
    });
    // verifica atualizações ao voltar para o app
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.sw.checkForUpdate().catch(() => undefined);
    });
  }
}
