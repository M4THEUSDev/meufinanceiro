import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonSearchbar, ModalController } from '@ionic/angular/standalone';
import { CategoryIconComponent } from './category-icon.component';

export interface PickerOption {
  id: string;
  label: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  group?: string;
}

/** Sheet de seleção genérico (categorias, contas, cartões...) */
@Component({
  selector: 'mf-picker-modal',
  imports: [IonHeader, IonContent, IonIcon, IonSearchbar, CategoryIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="close()">Cancelar</button>
        <span class="title">{{ title }}</span>
        <span style="width:64px"></span>
      </div>
      @if (searchable) {
        <div class="search"><ion-searchbar class="mf-search" mode="ios" placeholder="Buscar" [debounce]="0" (ionInput)="q.set($any($event).detail.value ?? '')"></ion-searchbar></div>
      }
    </ion-header>
    <ion-content>
      <div class="body">
        @for (g of groups(); track g.name) {
          @if (g.name) { <p class="mf-label">{{ g.name }}</p> }
          <div class="mf-group">
            @for (o of g.items; track o.id) {
              <button class="mf-row" type="button" (click)="pick(o.id)">
                @if (o.icon) { <mf-category-icon [icon]="o.icon" [color]="o.color ?? 'outros'" [size]="32"></mf-category-icon> }
                <span class="label grow">{{ o.label }} @if (o.subtitle) { <span class="sub">{{ o.subtitle }}</span> }</span>
                @if (o.id === selected) { <ion-icon name="checkmark" class="check"></ion-icon> }
              </button>
            }
          </div>
        } @empty {
          <div class="mf-empty"><ion-icon name="search-outline"></ion-icon><p>Nada encontrado</p></div>
        }
        @if (createLabel) {
          <button class="mf-reset create t-headline" type="button" (click)="pick('__create__')"><ion-icon name="add"></ion-icon>{{ createLabel }}</button>
        }
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .search { padding: 0 16px 8px; }
    .body { padding: 8px 16px 40px; display: flex; flex-direction: column; gap: 8px; }
    .mf-label { margin-top: 8px; }
    .check { color: var(--ion-color-primary); font-size: 20px; }
    .create { display: flex; align-items: center; justify-content: center; gap: 8px; height: 50px; border-radius: 12px; margin-top: 8px;
      background: var(--ion-color-primary-tint); color: var(--ion-color-primary-shade); }
    .create ion-icon { font-size: 20px; }
  `,
})
export class PickerModal {
  private readonly modal = inject(ModalController);
  // componentProps (atribuídos pelo ModalController)
  title = 'Selecionar';
  options: PickerOption[] = [];
  selected: string | null = null;
  searchable = false;
  createLabel = '';
  readonly q = signal('');

  readonly groups = computed(() => {
    const q = this.q().trim().toLowerCase();
    const opts = this.options.filter((o) => !q || o.label.toLowerCase().includes(q));
    const map = new Map<string, PickerOption[]>();
    for (const o of opts) {
      const k = o.group ?? '';
      map.set(k, [...(map.get(k) ?? []), o]);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });

  pick(id: string): void {
    void this.modal.dismiss(id, 'select');
  }
  close(): void {
    void this.modal.dismiss(null, 'cancel');
  }
}

/** helper para abrir o picker e aguardar o resultado */
export async function openPicker(
  modalCtrl: ModalController,
  props: { title: string; options: PickerOption[]; selected?: string | null; searchable?: boolean; createLabel?: string },
): Promise<string | null> {
  const m = await modalCtrl.create({
    component: PickerModal,
    componentProps: props,
    breakpoints: [0, 0.6, 1],
    initialBreakpoint: props.options.length > 7 ? 1 : 0.6,
    cssClass: 'mf-sheet',
    handle: true,
  });
  await m.present();
  const { data, role } = await m.onWillDismiss<string>();
  return role === 'select' ? (data ?? null) : null;
}
