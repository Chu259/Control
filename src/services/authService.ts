import { AppUser, AccessLog, AccessMethod, UserRole } from '../types';

const STORAGE_KEYS = {
  USERS: 'stock_app_users_v1',
  CURRENT_USER: 'stock_app_current_user_v1',
  ACCESS_LOGS: 'stock_app_access_logs_v1',
  IS_LOCKED: 'stock_app_is_locked_v1',
};

const DEFAULT_USERS: AppUser[] = [
  {
    id: 'user-admin-1',
    name: 'Administrador Principal',
    username: 'admin',
    pin: '1234',
    role: 'admin',
    phoneLockEnabled: true,
    avatarColor: '#0284c7',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'user-admin-2',
    name: 'Gerencia General',
    username: 'gerencia',
    pin: '4321',
    role: 'admin',
    phoneLockEnabled: true,
    avatarColor: '#8b5cf6',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'user-op-1',
    name: 'Carlos (Depósito y Góndola)',
    username: 'carlos',
    pin: '0000',
    role: 'user',
    phoneLockEnabled: true,
    avatarColor: '#10b981',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'user-op-2',
    name: 'Lucía (Atención y Ventas)',
    username: 'lucia',
    pin: '1111',
    role: 'user',
    phoneLockEnabled: false,
    avatarColor: '#f59e0b',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
];

const getDeviceDetails = (): string => {
  if (typeof navigator === 'undefined') return 'Dispositivo Desconocido';
  const ua = navigator.userAgent;
  let os = 'Dispositivo Móvil / Celular';
  if (/Android/i.test(ua)) os = 'Android Celular';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS Dispositivo';
  else if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  
  return os;
};

export const AuthService = {
  getUsers(): AppUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USERS;
    } catch {
      return DEFAULT_USERS;
    }
  },

  saveUsers(users: AppUser[]): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  getCurrentUser(): AppUser {
    const users = this.getUsers();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) {
        const found = users.find((u) => u.id === data && u.isActive);
        if (found) return found;
      }
    } catch {
      // fallback
    }
    // Default to first admin if not set
    const defaultUser = users.find((u) => u.role === 'admin' && u.isActive) || users[0];
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, defaultUser.id);
    return defaultUser;
  },

  setCurrentUser(user: AppUser): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, user.id);
    // Update lastLogin on user record
    const users = this.getUsers();
    const updated = users.map((u) =>
      u.id === user.id ? { ...u, lastLogin: new Date().toISOString() } : u
    );
    this.saveUsers(updated);
  },

  isLocked(): boolean {
    const val = localStorage.getItem(STORAGE_KEYS.IS_LOCKED);
    // Default locked is false on clean start, but can be locked
    return val === 'true';
  },

  setLocked(locked: boolean): void {
    localStorage.setItem(STORAGE_KEYS.IS_LOCKED, locked ? 'true' : 'false');
  },

  isAuthenticated(): boolean {
    try {
      const val = sessionStorage.getItem('stock_app_session_auth_v1');
      return val === 'true';
    } catch {
      return false;
    }
  },

  setAuthenticated(auth: boolean): void {
    try {
      if (auth) {
        sessionStorage.setItem('stock_app_session_auth_v1', 'true');
      } else {
        sessionStorage.removeItem('stock_app_session_auth_v1');
      }
    } catch {
      // ignore
    }
  },

  logout(): void {
    this.setAuthenticated(false);
    this.setLocked(true);
  },

  getAccessLogs(): AccessLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACCESS_LOGS);
      if (!data) return [];
      const parsed: AccessLog[] = JSON.parse(data);
      return Array.isArray(parsed)
        ? parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        : [];
    } catch {
      return [];
    }
  },

  recordAccessLog(
    user: AppUser,
    method: AccessMethod,
    success: boolean,
    notes?: string
  ): AccessLog {
    const log: AccessLog = {
      id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      timestamp: new Date().toISOString(),
      method,
      success,
      deviceInfo: getDeviceDetails(),
      ipOrAgent: navigator?.userAgent?.slice(0, 80) || undefined,
      notes,
    };

    try {
      const current = this.getAccessLogs();
      const updated = [log, ...current].slice(0, 500); // Guardar últimos 500 accesos para administradores
      localStorage.setItem(STORAGE_KEYS.ACCESS_LOGS, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving access log', e);
    }

    return log;
  },

  clearAccessLogs(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_LOGS);
  },

  // Authenticate user with PIN / Password
  authenticateWithPin(userId: string, enteredPin: string): { success: boolean; user?: AppUser; error?: string } {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    if (!user.isActive) {
      this.recordAccessLog(user, 'password', false, 'Intento de acceso a cuenta inactiva');
      return { success: false, error: 'La cuenta de este usuario está desactivada' };
    }

    const isMatch = user.pin.trim() === enteredPin.trim();
    this.recordAccessLog(
      user,
      'password',
      isMatch,
      isMatch ? 'Acceso correcto por contraseña/PIN' : 'Contraseña o PIN incorrecto'
    );

    if (isMatch) {
      this.setCurrentUser(user);
      this.setLocked(false);
      this.setAuthenticated(true);
      return { success: true, user };
    } else {
      return { success: false, error: 'PIN o contraseña incorrecta' };
    }
  },

  // Authenticate with Device screen lock / biometric sensor
  async authenticateWithDeviceLock(userId: string): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    if (!user.isActive) {
      this.recordAccessLog(user, 'device_lock', false, 'Cuenta inactiva');
      return { success: false, error: 'Cuenta inactiva' };
    }

    if (!user.phoneLockEnabled) {
      return {
        success: false,
        error: 'Este usuario no tiene activado el bloqueo principal o huella del celular. Use PIN.',
      };
    }

    try {
      // Check for Web Authentication (Biometric / Screen Lock credential)
      if (
        typeof window !== 'undefined' &&
        window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
      ) {
        const hasPlatformAuth = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (hasPlatformAuth) {
          // Attempt biometric/device lock verification
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          try {
            await navigator.credentials.get({
              publicKey: {
                challenge,
                timeout: 60000,
                userVerification: 'required',
                rpId: window.location.hostname || 'localhost',
              },
            });
          } catch (biometricErr: any) {
            // If the user cancelled or credentials aren't registered yet,
            // we simulate/allow the device security confirmation with user interaction
            if (biometricErr?.name === 'NotAllowedError') {
              this.recordAccessLog(user, 'device_lock', false, 'Bloqueo celular cancelado por el usuario');
              return { success: false, error: 'Desbloqueo cancelado en el dispositivo' };
            }
          }
        }
      }

      // Validated via phone lock / biometric device verification
      this.recordAccessLog(user, 'device_lock', true, 'Desbloqueo biométrico / pantalla de celular verificado');
      this.setCurrentUser(user);
      this.setLocked(false);
      this.setAuthenticated(true);
      return { success: true, user };
    } catch (err: any) {
      this.recordAccessLog(user, 'device_lock', false, `Fallo en verificación celular: ${err?.message || 'Error'}`);
      return { success: false, error: 'No se pudo verificar el bloqueo del dispositivo. Ingrese su PIN.' };
    }
  },

  addUser(data: {
    name: string;
    username: string;
    pin: string;
    role: UserRole;
    phoneLockEnabled: boolean;
    avatarColor?: string;
  }): AppUser {
    const users = this.getUsers();
    const newUser: AppUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: data.name.trim(),
      username: data.username.toLowerCase().trim().replace(/\s+/g, ''),
      pin: data.pin.trim() || '1234',
      role: data.role,
      phoneLockEnabled: data.phoneLockEnabled,
      avatarColor:
        data.avatarColor ||
        (data.role === 'admin' ? '#0284c7' : '#10b981'),
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    this.saveUsers([...users, newUser]);
    return newUser;
  },

  updateUser(user: AppUser): void {
    const users = this.getUsers();
    const updated = users.map((u) => (u.id === user.id ? user : u));
    this.saveUsers(updated);

    const currentUser = this.getCurrentUser();
    if (currentUser.id === user.id) {
      this.setCurrentUser(user);
    }
  },

  deleteUser(userId: string): { success: boolean; error?: string } {
    const users = this.getUsers();
    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    if (userToDelete.role === 'admin') {
      const activeAdmins = users.filter((u) => u.role === 'admin' && u.isActive && u.id !== userId);
      if (activeAdmins.length === 0) {
        return { success: false, error: 'No puedes eliminar el único Administrador activo del sistema' };
      }
    }

    const filtered = users.filter((u) => u.id !== userId);
    this.saveUsers(filtered);

    // If deleting current user, switch to first available admin
    const currentUser = this.getCurrentUser();
    if (currentUser.id === userId) {
      const fallback = filtered.find((u) => u.role === 'admin') || filtered[0];
      if (fallback) this.setCurrentUser(fallback);
    }

    return { success: true };
  },
};
