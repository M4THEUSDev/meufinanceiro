import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonIcon, IonSegment, IonSegmentButton, ModalController } from '@ionic/angular/standalone';
import { PICKABLE_COLORS, PICKABLE_ICONS } from '../../core/icons';
import { CategoryColor, TxType } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';

/** Nova categoria / Editar categoria (personalizadas) */
@Component({
  selector: 'mf-category-form',
  imports: [FormsModule, IonHeader, IonContent, IonIcon, IonButton, IonSegment, IonSegmentButton, CategoryIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="cancel()">Cancelar</button>
        <span class="title">{{ categoryId ? 'Editar categoria' : 'Nova categoria' }}</span>
        <button type="button" class="strong" (click)="save()">Salvar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="mf-modal-body">
        <div class="preview">
          <mf-category-icon [icon]="icon()" [color]="color()" [size]="64"></mf-category-icon>
          <span class="t-title3">{{ name() || 'Nova categoria' }}</span>
        </div>
        @if (!isDefault()) {
          <div class="pad">
            <ion-segment mode="ios" [value]="type()" (ionChange)="type.set($any($event).detail.value)" [disabled]="!!categoryId">
              <ion-segment-button value="expense">Despesa</ion-segment-button>
              <ion-segment-button value="income">Receita</ion-segment-button>
            </ion-segment>
          </div>
        }
        <div class="pad">
          <label class="t-footnote-sb c-secondary" for="cat-name">Nome</label>
          <span class="field" [class.invalid]="submitted() && !name().trim()">
            <ion-icon name="pricetag-outline"></ion-icon>
            <input id="cat-name" type="text" maxlength="30" placeholder="Ex.: Pets" [ngModel]="name()" (ngModelChange)="name.set($event)" />
          </span>
          @if (submitted() && !name().trim()) { <p class="err">Informe o nome da categoria.</p> }
          @if (duplicate()) { <p class="err">Já existe uma categoria com esse nome.</p> }
        </div>
        <div class="pad">
          <span class="t-footnote-sb c-secondary">Cor</span>
          <div class="colors">
            @for (c of colors; track c) {
              <button type="button" class="swatch" [class.on]="color() === c" [style.background]="'var(--mf-category-' + c + ')'" [attr.aria-label]="c" (click)="color.set(c)">
                @if (color() === c) { <ion-icon name="checkmark"></ion-icon> }
              </button>
            }
          </div>
        </div>
        <div class="pad">
          <span class="t-footnote-sb c-secondary">Ícone</span>
          <div class="icons">
            @for (i of icons; track i) {
              <button type="button" class="ic" [class.on]="icon() === i" [style.--c]="'var(--mf-category-' + color() + ')'" (click)="icon.set(i)" [attr.aria-label]="i">
                <ion-icon [name]="i"></ion-icon>
              </button>
            }
          </div>
        </div>
        <div class="pad">
          <ion-button expand="block" (click)="save()">Salvar categoria</ion-button>
          @if (categoryId) {
            <ion-button expand="block" class="tonal-danger" (click)="remove()"><ion-icon slot="start" name="trash-outline"></ion-icon>{{ isDefault() ? 'Ocultar categoria' : 'Excluir categoria' }}</ion-button>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .preview { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 16px; }
    .field { height: 50px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-radius: 12px; background: var(--ion-card-background); border: 1px solid var(--ion-border-color); }
    .field.invalid { border: 2px solid var(--ion-color-danger); padding: 0 15px; }
    .field ion-icon { font-size: 20px; color: var(--mf-text-secondary); }
    .field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 17px; color: var(--ion-text-color); }
    .colors { display: flex; flex-wrap: wrap; gap: 12px; }
    .swatch { width: 32px; height: 32px; border-radius: 999px; border: 0; cursor: pointer; display: grid; place-items: center; color: #fff; font-size: 18px; }
    .swatch.on { box-shadow: 0 0 0 3px var(--ion-background-color), 0 0 0 5px var(--ion-text-color); }
    .icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 8px; }
    .ic { position: relative; isolation: isolate; height: 44px; border-radius: 12px; border: 0; background: var(--ion-card-background); color: var(--mf-text-secondary); display: grid; place-items: center; font-size: 20px; cursor: pointer; }
    .ic.on { color: var(--c); }
    .ic.on::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--c); opacity: 0.14; z-index: -1; }
    .ic.on { box-shadow: inset 0 0 0 2px var(--c); }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
  `,
})
export class CategoryFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  categoryId?: string;
  presetType?: TxType;

  readonly icons = PICKABLE_ICONS;
  readonly colors = PICKABLE_COLORS;
  readonly type = signal<TxType>('expense');
  readonly name = signal('');
  readonly icon = signal('paw-outline');
  readonly color = signal<CategoryColor>('rendimentos');
  readonly submitted = signal(false);
  readonly isDefault = signal(false);

  duplicate(): boolean {
    const n = this.name().trim().toLowerCase();
    return !!n && this.store.categoriesOf(this.type()).some((c) => c.name.toLowerCase() === n && c.id !== this.categoryId);
  }

  ngOnInit(): void {
    const c = this.categoryId ? this.store.category(this.categoryId) : undefined;
    if (c) {
      this.type.set(c.type);
      this.name.set(c.name);
      this.icon.set(c.icon);
      this.color.set(c.color);
      this.isDefault.set(!c.custom);
    } else if (this.presetType) {
      this.type.set(this.presetType);
    }
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (!this.name().trim() || this.duplicate()) return;
    const data = { name: this.name().trim(), icon: this.icon(), color: this.color() };
    if (this.categoryId) {
      this.store.updateCategory(this.categoryId, data);
      await this.ui.toast({ title: 'Categoria atualizada', message: data.name });
      void this.modalCtrl.dismiss(this.categoryId, 'save');
    } else {
      const c = this.store.addCategory({ ...data, type: this.type(), custom: true });
      await this.ui.toast({ title: 'Categoria criada', message: `${c.name} · ${c.type === 'expense' ? 'Despesas' : 'Receitas'}` });
      void this.modalCtrl.dismiss(c.id, 'save');
    }
  }

  async remove(): Promise<void> {
    const c = this.categoryId ? this.store.category(this.categoryId) : undefined;
    if (!c) return;
    const used = this.store.transactions().filter((t) => t.categoryId === c.id).length;
    const ok = await this.ui.confirm({
      header: this.isDefault() ? 'Ocultar categoria?' : 'Excluir categoria?',
      message: used
        ? `“${c.name}” tem ${used} ${used === 1 ? 'transação' : 'transações'}. Elas serão mantidas, mas a categoria não aparecerá mais para novos lançamentos.`
        : `“${c.name}” será removida.`,
      confirmText: this.isDefault() ? 'Ocultar' : 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    if (this.isDefault()) this.store.updateCategory(c.id, { archived: true });
    else this.store.deleteCategory(c.id);
    void this.modalCtrl.dismiss(null, 'delete');
  }
}
