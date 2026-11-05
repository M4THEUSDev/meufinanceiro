import { Injectable, inject } from '@angular/core';
import { StoreService } from './store.service';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Autenticação local (offline-first). O primeiro login neste dispositivo define a senha;
 * os seguintes validam o hash. Face ID fica disponível após o primeiro login.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(StoreService);

  get faceIdAvailable(): boolean {
    const s = this.store.settings();
    return !!s.hasLoggedBefore && s.faceId;
  }

  async login(email: string, password: string): Promise<{ ok: true } | { ok: false; field: 'email' | 'password'; message: string }> {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return { ok: false, field: 'email', message: 'Informe um e-mail válido.' };
    if (password.length < 6) return { ok: false, field: 'password', message: 'A senha deve ter pelo menos 6 caracteres.' };
    const s = this.store.settings();
    const hash = await sha256(`${e}:${password}`);
    if (s.passwordHash && s.hasLoggedBefore) {
      if (e !== s.email.toLowerCase()) return { ok: false, field: 'email', message: 'E-mail não cadastrado neste iPhone.' };
      if (hash !== s.passwordHash) return { ok: false, field: 'password', message: 'Senha incorreta. Tente novamente.' };
    }
    this.store.updateSettings({ email: e, passwordHash: hash, loggedIn: true, hasLoggedBefore: true });
    return { ok: true };
  }

  async biometricLogin(): Promise<boolean> {
    if (!this.faceIdAvailable) return false;
    // Simula o prompt biométrico do sistema
    await new Promise((r) => setTimeout(r, 700));
    this.store.updateSettings({ loggedIn: true });
    return true;
  }

  resetPassword(): void {
    this.store.updateSettings({ passwordHash: undefined, hasLoggedBefore: false, faceId: false });
  }

  logout(): void {
    this.store.updateSettings({ loggedIn: false });
  }
}
