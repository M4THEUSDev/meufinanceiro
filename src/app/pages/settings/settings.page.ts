import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToggle, IonToolbar, ModalController, NavController,
} from '@ionic/angular/standalone';
import { Settings, ThemePref } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { initials } from '../../core/utils/format';
import { openPicker } from '../../shared/components/picker.modal';
import { APP_VERSION } from '../splash/splash.page';

/** [Z4] Configurações */
@Component({
  selector: 'mf-settings',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, IonToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);
  private readonly exporter = inject(ExportService);
  private readonly alert = inject(AlertController);
  private readonly modal = inject(ModalController);
  private readonly nav = inject(NavController);
  private readonly route = inject(ActivatedRoute);
  private readonly content = viewChild(IonContent);
  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photo');
  private readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importFile');

  readonly s = this.store.settings;
  readonly initials = computed(() => initials(this.s().userName));
  readonly version = APP_VERSION;
  readonly themes: { id: ThemePref; label: string }[] = [
    { id: 'light', label: 'Claro' },
    { id: 'dark', label: 'Escuro' },
    { id: 'system', label: 'Sistema' },
  ];
  readonly lockLabel = computed(() => ({ off: 'Desativado', immediately: 'Imediatamente', '1min': 'Após 1 minuto', '5min': 'Após 5 minutos' })[this.s().appLock]);

  ionViewDidEnter(): void {
    if (this.route.snapshot.fragment === 'seguranca') {
      const el = document.getElementById('seguranca');
      if (el) void this.content()?.scrollToPoint(0, el.offsetTop - 60, 400);
    }
  }

  set<K extends keyof Settings>(k: K, v: Settings[K]): void {
    this.store.updateSettings({ [k]: v } as Partial<Settings>);
    this.ui.tap();
  }

  changePhoto(): void {
    this.photoInput()?.nativeElement.click();
  }

  onPhoto(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        // reduz para 256px para caber no armazenamento local
        const c = document.createElement('canvas');
        const size = 256;
        const ratio = Math.max(size / img.width, size / img.height);
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, (size - img.width * ratio) / 2, (size - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
        this.store.updateSettings({ photo: c.toDataURL('image/jpeg', 0.85) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    (ev.target as HTMLInputElement).value = '';
  }

  async removePhoto(): Promise<void> {
    this.store.updateSettings({ photo: undefined });
  }

  async editName(): Promise<void> {
    const a = await this.alert.create({
      header: 'Nome',
      inputs: [{ name: 'name', type: 'text', value: this.s().userName, attributes: { maxlength: 40, autocapitalize: 'words' } }],
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Salvar', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    const name = (data?.values?.name ?? '').trim();
    if (role === 'confirm' && name) {
      this.store.updateSettings({ userName: name });
      await this.ui.toast({ title: 'Perfil atualizado', message: name });
    }
  }

  async editEmail(): Promise<void> {
    const a = await this.alert.create({
      header: 'Alterar e-mail',
      message: 'Confirme sua senha para alterar o e-mail de acesso.',
      inputs: [
        { name: 'email', type: 'email', value: this.s().email, placeholder: 'Novo e-mail' },
        { name: 'password', type: 'password', placeholder: 'Senha atual' },
      ],
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Salvar', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    if (role !== 'confirm') return;
    const res = await this.auth.changeEmail(data?.values?.email ?? '', data?.values?.password ?? '');
    await this.ui.toast(res.ok ? { title: 'E-mail atualizado', message: this.s().email } : { title: 'Não foi possível alterar', message: res.message, tone: 'danger' });
  }

  async pickCurrency(): Promise<void> {
    await openPicker(this.modal, { title: 'Moeda', selected: 'BRL', options: [{ id: 'BRL', label: 'Real (BRL)', subtitle: 'R$ 1.234,56' }] });
  }

  async pickDateFormat(): Promise<void> {
    const id = await openPicker(this.modal, {
      title: 'Formato de data',
      selected: this.s().dateFormat,
      options: [
        { id: 'DD/MM/AAAA', label: 'DD/MM/AAAA', subtitle: '26/11/2026' },
        { id: 'AAAA-MM-DD', label: 'AAAA-MM-DD', subtitle: '2026-11-26' },
      ],
    });
    if (id) this.set('dateFormat', id as Settings['dateFormat']);
  }

  async pickLock(): Promise<void> {
    const id = await openPicker(this.modal, {
      title: 'Bloqueio do app',
      selected: this.s().appLock,
      options: [
        { id: 'off', label: 'Desativado' },
        { id: 'immediately', label: 'Imediatamente' },
        { id: '1min', label: 'Após 1 minuto' },
        { id: '5min', label: 'Após 5 minutos' },
      ],
    });
    if (id) this.set('appLock', id as Settings['appLock']);
  }

  async changePassword(): Promise<void> {
    const a = await this.alert.create({
      header: 'Alterar senha',
      inputs: [
        { name: 'current', type: 'password', placeholder: 'Senha atual' },
        { name: 'next', type: 'password', placeholder: 'Nova senha (mín. 6 caracteres)' },
        { name: 'confirm', type: 'password', placeholder: 'Confirmar nova senha' },
      ],
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Alterar', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    if (role !== 'confirm') return;
    const v = data?.values ?? {};
    if (v.next !== v.confirm) {
      await this.ui.toast({ title: 'As senhas não conferem', message: 'Digite a mesma senha nos dois campos.', tone: 'danger' });
      return;
    }
    const res = await this.auth.changePassword(v.current ?? '', v.next ?? '');
    await this.ui.toast(res.ok ? { title: 'Senha alterada', message: 'Use a nova senha no próximo acesso.' } : { title: 'Não foi possível alterar', message: res.message, tone: 'danger' });
  }

  async sessions(): Promise<void> {
    const a = await this.alert.create({
      header: 'Sessões ativas',
      message: `Este iPhone · ativo agora. Seus dados ficam armazenados apenas neste dispositivo.`,
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await a.present();
  }

  async privacy(): Promise<void> {
    const a = await this.alert.create({
      header: 'Privacidade',
      message: 'O MeuFinanceiro armazena suas informações localmente, sem enviar dados a terceiros. Você pode exportar ou excluir tudo a qualquer momento.',
      buttons: [{ text: 'Entendi', role: 'cancel' }],
    });
    await a.present();
  }

  exportCsv(): void {
    void this.exporter.exportCsv();
  }

  backup(): void {
    void this.exporter.exportBackup();
  }

  importBackup(): void {
    this.importInput()?.nativeElement.click();
  }

  onImport(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await this.ui.confirm({ header: 'Restaurar backup?', message: 'Os dados atuais serão substituídos pelos do arquivo.', confirmText: 'Restaurar', destructive: true });
      if (!ok) return;
      const loggedIn = this.s().loggedIn;
      const done = this.store.importJson(String(reader.result));
      if (done) this.store.updateSettings({ loggedIn });
      await this.ui.toast(done ? { title: 'Backup restaurado', message: 'Seus dados foram importados.' } : { title: 'Arquivo inválido', message: 'Selecione um backup .json do MeuFinanceiro.', tone: 'danger' });
    };
    reader.readAsText(file);
    (ev.target as HTMLInputElement).value = '';
  }

  async deleteAll(): Promise<void> {
    const ok = await this.ui.confirm({
      header: 'Excluir todos os dados?',
      message: 'Contas, transações, orçamentos, metas e cartões serão apagados permanentemente. Esta ação não pode ser desfeita.',
      confirmText: 'Excluir tudo',
      destructive: true,
    });
    if (!ok) return;
    this.store.clearAll();
    await this.ui.toast({ title: 'Dados excluídos', message: 'Comece adicionando uma conta em Mais › Minhas contas.', tone: 'danger' });
  }

  async logout(): Promise<void> {
    const ok = await this.ui.confirm({ header: 'Sair da conta?', message: 'Você precisará entrar novamente com e-mail e senha.', confirmText: 'Sair', destructive: true });
    if (!ok) return;
    this.auth.logout();
    void this.nav.navigateRoot('/login', { animationDirection: 'back' });
  }
}
