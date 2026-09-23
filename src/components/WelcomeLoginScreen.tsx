import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Smartphone,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Users,
  Store,
  Fingerprint,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { AppUser, StoreSettings } from '../types';
import { AuthService } from '../services/authService';
import { Sound } from '../services/sound';

interface WelcomeLoginScreenProps {
  settings: StoreSettings;
  onLoginSuccess: (user: AppUser) => void;
}

export const WelcomeLoginScreen: React.FC<WelcomeLoginScreenProps> = ({
  settings,
  onLoginSuccess,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [deviceLockSupported, setDeviceLockSupported] = useState(false);

  useEffect(() => {
    const loadedUsers = AuthService.getUsers().filter((u) => u.isActive);
    setUsers(loadedUsers);

    // Default select current user or first admin
    const current = AuthService.getCurrentUser();
    const defaultUser = loadedUsers.find((u) => u.id === current?.id) || loadedUsers[0] || null;
    setSelectedUser(defaultUser);

    // Check if biometric/credentials supported
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setDeviceLockSupported(true);
    }
  }, []);

  const handleSelectUser = (user: AppUser) => {
    setSelectedUser(user);
    setPin('');
    setError(null);
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 10) {
      setPin((prev) => prev + digit);
      setError(null);
      Sound.playScanBeep();
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setError('Por favor selecciona un usuario');
      return;
    }

    if (!pin.trim()) {
      setError('Ingresa tu PIN o contraseña');
      return;
    }

    setIsVerifying(true);
    setError(null);

    setTimeout(() => {
      const result = AuthService.authenticateWithPin(selectedUser.id, pin);
      setIsVerifying(false);

      if (result.success && result.user) {
        Sound.playSuccessChime();
        onLoginSuccess(result.user);
      } else {
        Sound.playWarningTone();
        setError(result.error || 'PIN o contraseña incorrecta');
        setPin('');
      }
    }, 250);
  };

  const handleDeviceUnlock = async () => {
    if (!selectedUser) return;
    setIsVerifying(true);
    setError(null);

    try {
      const result = await AuthService.authenticateWithDeviceLock(selectedUser.id);
      setIsVerifying(false);

      if (result.success && result.user) {
        Sound.playSuccessChime();
        onLoginSuccess(result.user);
      } else {
        Sound.playWarningTone();
        setError(result.error || 'No se pudo verificar el bloqueo del dispositivo');
      }
    } catch {
      setIsVerifying(false);
      setError('Fallo en la autenticación biométrica o del teléfono');
    }
  };

  const handleQuickDemoFill = (user: AppUser) => {
    setSelectedUser(user);
    setPin(user.pin);
    setError(null);
    Sound.playScanBeep();
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-b from-[#0e111a] via-[#0f1118] to-[#08090d] text-white">
      {/* Top Branding Section */}
      <div className="pt-4 pb-3 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-3 shadow-lg shadow-amber-500/5">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black tracking-tight text-white">
          {settings.storeName || 'depos'}
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Ingreso Seguro al Sistema de Tienda y Góndola
        </p>
      </div>

      {/* User Selection Carousel / List */}
      <div className="my-2">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Seleccionar Usuario:</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">
            {users.length} cuenta{users.length !== 1 ? 's' : ''} activa{users.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-0.5">
          {users.map((user) => {
            const isSelected = selectedUser?.id === user.id;
            const isAdmin = user.role === 'admin';

            return (
              <button
                key={user.id}
                type="button"
                id={`user-select-${user.username}`}
                onClick={() => handleSelectUser(user)}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/40 shadow-sm'
                    : 'bg-[#141722] border-white/5 hover:border-white/15 hover:bg-[#181b28]'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-inner"
                  style={{ backgroundColor: user.avatarColor || '#0284c7' }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate leading-tight">
                    {user.name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                        isAdmin
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {isAdmin ? 'Admin' : 'Personal'}
                    </span>
                    {user.phoneLockEnabled && (
                      <span title="Bloqueo celular activo">
                        <Smartphone className="w-2.5 h-2.5 text-sky-400" />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected User Details & PIN Authentication Card */}
      {selectedUser && (
        <div className="bg-[#141722] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3 my-2">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                style={{ backgroundColor: selectedUser.avatarColor || '#0284c7' }}
              >
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold text-white">{selectedUser.name}</p>
                <p className="text-[10px] text-zinc-400">@{selectedUser.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-zinc-400 bg-black/30 px-2 py-0.5 rounded-lg border border-white/5">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>PIN Requerido</span>
            </div>
          </div>

          {/* Form & PIN Input */}
          <form onSubmit={handleLoginSubmit} className="space-y-3">
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                id="login-pin-input"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder="Ingresa tu contraseña o PIN..."
                className="w-full bg-[#0b0d13] border border-white/15 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 tracking-widest text-center font-mono"
                autoFocus
              />
              <button
                type="button"
                id="toggle-pin-visibility"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                title={showPin ? 'Ocultar PIN' : 'Ver PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5 animate-shake">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Touch Keypad for Mobile Comfort */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  id={`numpad-btn-${digit}`}
                  onClick={() => handleKeypadPress(digit)}
                  className="py-2.5 bg-[#1b1f2e] hover:bg-[#23283b] active:bg-amber-500/30 text-white font-semibold rounded-xl text-sm border border-white/5 transition-all shadow-sm"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                id="numpad-btn-clear"
                onClick={handleClear}
                className="py-2.5 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 font-semibold rounded-xl text-xs border border-rose-500/20 transition-all"
                title="Borrar todo"
              >
                C
              </button>
              <button
                type="button"
                id="numpad-btn-0"
                onClick={() => handleKeypadPress('0')}
                className="py-2.5 bg-[#1b1f2e] hover:bg-[#23283b] active:bg-amber-500/30 text-white font-semibold rounded-xl text-sm border border-white/5 transition-all shadow-sm"
              >
                0
              </button>
              <button
                type="button"
                id="numpad-btn-backspace"
                onClick={handleBackspace}
                className="py-2.5 bg-[#1b1f2e] hover:bg-[#23283b] text-zinc-400 hover:text-white font-semibold rounded-xl text-xs border border-white/5 transition-all flex items-center justify-center"
                title="Retroceso"
              >
                ⌫
              </button>
            </div>

            {/* Submit Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="submit"
                id="btn-login-submit"
                disabled={isVerifying || !pin.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 text-black font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
              >
                {isVerifying ? (
                  <span>Verificando credenciales...</span>
                ) : (
                  <>
                    <span>Entrar a la Aplicación</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Device lock option if enabled for this user */}
              {selectedUser.phoneLockEnabled && (
                <button
                  type="button"
                  id="btn-login-biometric"
                  onClick={handleDeviceUnlock}
                  disabled={isVerifying}
                  className="w-full py-2.5 px-4 bg-[#1b1f2e] hover:bg-[#23283b] text-sky-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-sky-500/30 transition-all"
                >
                  <Fingerprint className="w-4 h-4 text-sky-400" />
                  <span>Desbloquear con Huella o Celular</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Demo Credentials Quick-Fill Helper (Convenient for test and onboarding) */}
      <div className="mt-2 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Accesos directos de demostración:</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              id={`quick-demo-fill-${u.username}`}
              onClick={() => handleQuickDemoFill(u)}
              className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition-colors flex items-center gap-1"
            >
              <span className="font-semibold">{u.name.split(' ')[0]}:</span>
              <span className="font-mono text-amber-400">{u.pin}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
