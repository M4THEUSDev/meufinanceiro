import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { monthKey } from '../../core/utils/format';
import { BillItemComponent } from './bill-item.component';
import { CategoryIconComponent } from './category-icon.component';

/** Central de notificações — vencimentos e alertas de orçamento */
@Component({
  selector: 'mf-notifications',
  imports: [IonHeader, IonContent, IonIcon, BillItemComponent, CategoryIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <span style="width:64px"></span>
        <span class="title">Notificações</span>
        <button type="button" class="strong" (click)="close()">OK</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="body">
        @if (bills().length) {
          <p class="mf-label">Vencimentos</p>
          <div class="mf-list">
            @for (b of bills(); track b.id) { <mf-bill-item [bill]="b" (click)="go(b.kind === 'card' ? '/tabs/mais/cartoes' : '/tabs/transacoes/' + b.refId)"></mf-bill-item> }
          </div>
        }
        @if (alerts().length) {
          <p class="mf-label">Orçamentos</p>
          <div class="mf-list">
            @for (a of alerts(); track a.id) {
              <button class="mf-row" type="button" (click)="go('/tabs/planejamento/' + a.id)">
                <mf-category-icon [icon]="a.icon" [color]="a.color" [size]="32"></mf-category-icon>
                <span class="label grow">{{ a.name }}<span class="sub" [class.over]="a.over">{{ a.text }}</span></span>
                <ion-icon class="chev" name="chevron-forward"></ion-icon>
              </button>
            }
          </div>
        }
        @if (!bills().length && !alerts().length) {
          <div class="mf-empty"><ion-icon name="notifications-outline"></ion-icon><p class="t-headline">Tudo em dia</p><p class="t-footnote">Você não tem vencimentos próximos nem alertas de orçamento.</p></div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .body { padding: 8px 16px 40px; display: flex; flex-direction: column; gap: 8px; }
    .mf-label { margin-top: 8px; }
    .sub.over { color: var(--ion-color-danger); }
  `,
})
export class NotificationsModal {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  readonly bills = computed(() => this.store.bills().filter((b) => b.status !== 'later' || b.days <= 15));
  readonly alerts = computed(() => {
    const key = monthKey(new Date());
    return this.store
      .budgetsFor(key)
      .map((b) => {
        const cat = this.store.category(b.categoryId);
        const spent = this.store.spentInCategory(b.categoryId, key);
        const pct = b.limit ? Math.round((spent / b.limit) * 100) : 0;
        return { id: b.id, name: cat?.name ?? '', icon: cat?.icon ?? 'pricetag-outline', color: cat?.color ?? 'outros', pct, alertAt: b.alertAt };
      })
      .filter((a) => a.pct >= a.alertAt)
      .map((a) => ({ ...a, over: a.pct > 100, text: a.pct > 100 ? `Estourou o orçamento (${a.pct}%)` : `${a.pct}% do orçamento usado` }));
  });

  go(url: string): void {
    void this.modalCtrl.dismiss();
    void this.router.navigateByUrl(url);
  }
  close(): void {
    void this.modalCtrl.dismiss();
  }
}
