import { AuthService } from './authService';

const STORAGE_KEYS = {
  LAST_ADMIN_SYNC: 'depos_last_admin_sync_timestamp',
  INITIALIZED: 'depos_anti_theft_initialized',
};

// 48 hours in milliseconds
export const SYNC_TIMEOUT_HOURS = 48;
export const SYNC_TIMEOUT_MS = SYNC_TIMEOUT_HOURS * 60 * 60 * 1000;

export const AntiTheftService = {
  /**
   * Initializes the anti-theft timer on device if not already set.
   * New installations or fresh devices begin with a clean 48-hour window.
   */
  init(): void {
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.LAST_ADMIN_SYNC);
      if (!existing) {
        const now = Date.now().toString();
        localStorage.setItem(STORAGE_KEYS.LAST_ADMIN_SYNC, now);
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      }
    } catch (e) {
      console.warn('AntiTheftService init error:', e);
    }
  },

  /**
   * Reinicia el reloj de 48 horas cada vez que el dispositivo realiza
   * una sincronización exitosa con la terminal del Administrador.
   */
  recordSuccessfulSync(): void {
    try {
      const now = Date.now().toString();
      localStorage.setItem(STORAGE_KEYS.LAST_ADMIN_SYNC, now);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('anti_theft_status_changed', { detail: { locked: false } }));
      }
    } catch (e) {
      console.warn('Error recording successful sync timestamp:', e);
    }
  },

  /**
   * Devuelve la fecha/hora en milisegundos de la última sincronización con el Administrador.
   */
  getLastSyncTimestamp(): number {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.LAST_ADMIN_SYNC);
      if (!val) {
        const now = Date.now();
        localStorage.setItem(STORAGE_KEYS.LAST_ADMIN_SYNC, now.toString());
        return now;
      }
      const num = parseInt(val, 10);
      return isNaN(num) ? Date.now() : num;
    } catch {
      return Date.now();
    }
  },

  /**
   * Determina si pasaron más de 48 horas seguidas sin registrar una sincronización.
   */
  isSyncTimeoutExceeded(): boolean {
    const lastSync = this.getLastSyncTimestamp();
    const elapsed = Date.now() - lastSync;
    return elapsed >= SYNC_TIMEOUT_MS;
  },

  /**
   * Devuelve los milisegundos restantes antes de que se active el bloqueo (o 0 si ya venció).
   */
  getTimeRemainingMs(): number {
    const lastSync = this.getLastSyncTimestamp();
    const elapsed = Date.now() - lastSync;
    const remaining = SYNC_TIMEOUT_MS - elapsed;
    return Math.max(0, remaining);
  },

  /**
   * Horas y minutos restantes antes del bloqueo.
   */
  getFormattedTimeRemaining(): { hours: number; minutes: number } {
    const ms = this.getTimeRemainingMs();
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes };
  },

  /**
   * Desbloquea la aplicación ingresando físicamente el PIN del Administrador Principal.
   */
  unlockWithPrincipalAdminPin(enteredPin: string): { success: boolean; error?: string } {
    const cleanPin = (enteredPin || '').trim();
    if (!cleanPin) {
      return { success: false, error: 'Por favor ingresa el PIN del Administrador Principal' };
    }

    const isValid = AuthService.verifyPrincipalAdminPin(cleanPin);
    if (!isValid) {
      return {
        success: false,
        error: 'PIN de Administrador Principal incorrecto. Acceso bloqueado.',
      };
    }

    // PIN verificado con éxito: reiniciar reloj de 48 horas
    this.recordSuccessfulSync();
    return { success: true };
  },
};

// Auto-initialize when loaded
AntiTheftService.init();
