import { Pipe, PipeTransform, inject } from '@angular/core';
import { StoreService } from '../../core/services/store.service';
import { HIDDEN_MASK, money } from '../../core/utils/format';

/**
 * Formata valores em BRL respeitando a preferência "Ocultar valores".
 * `{{ v | money }}` → "R$ 1.234,56"; `{{ v | money:'sign' }}` → "+ R$ 1.234,56" / "− R$ 1.234,56";
 * `{{ v | money:'int' }}` → "R$ 1.235".
 */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly store = inject(StoreService);

  transform(value: number | null | undefined, mode: 'plain' | 'sign' | 'int' | 'sign-int' = 'plain', ignoreHidden = false): string {
    if (!ignoreHidden && this.store.hidden()) return HIDDEN_MASK;
    const v = value ?? 0;
    return money(v, { sign: mode === 'sign' || mode === 'sign-int', decimals: !(mode === 'int' || mode === 'sign-int') });
  }
}
