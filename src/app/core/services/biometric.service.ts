import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

/**
 * Biometria real (Face ID / Touch ID) no app nativo.
 * Na versão web (PWA) não existe biometria: a opção fica indisponível.
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  readonly native = Capacitor.isNativePlatform();
  /** aparelho tem biometria configurada */
  readonly available = signal(false);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<boolean> {
    if (!this.native) return false;
    try {
      const r = await BiometricAuth.checkBiometry();
      this.available.set(r.isAvailable);
      return r.isAvailable;
    } catch {
      this.available.set(false);
      return false;
    }
  }

  async authenticate(reason = 'Desbloqueie o MeuFinanceiro'): Promise<boolean> {
    if (!this.native || !(await this.refresh())) return false;
    try {
      await BiometricAuth.authenticate({ reason, cancelTitle: 'Cancelar', iosFallbackTitle: 'Usar senha', allowDeviceCredential: false });
      return true;
    } catch {
      return false;
    }
  }
}
