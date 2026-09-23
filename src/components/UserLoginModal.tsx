import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Shield,
  Smartphone,
  Fingerprint,
  KeyRound,
  UserCheck,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { AppUser } from '../types';
import { AuthService } from '../services/authService';

interface UserLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  onUserAuthenticated: (user: AppUser) => void;
  isMandatoryLock?: boolean;
}

export const UserLoginModal: React.FC<UserLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserAuthenticated,
  isMandatoryLock = false,
}) => {
  const users = AuthService.getUsers().filter((u) => u.isActive);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(
    currentUser || users[0] || null
  );
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifyingDevice, setIsVerifyingDevice] = useState(false);
  const [authSuccessNotice, setAuthSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectUser = (user: AppUser) => {
    setSelectedUser(user);
    setPin('');
    setErrorMsg(null);
    setAuthSuccessNotice(null);
  };

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setErrorMsg('Selecciona un usuario');
      return;
    }
    if (!pin.trim()) {
      setErrorMsg('Por favor ingresa la contraseña o PIN');
      return;
    }

    const result = AuthService.authenticateWithPin(selectedUser.id, pin);
    if (result.success && result.user) {
      setAuthSuccessNotice(`¡Bienvenido/a, ${result.user.name}!`);
      setTimeout(() => {
        onUserAuthenticated(result.user!);
        setPin('');
        setErrorMsg(null);
        setAuthSuccessNotice(null);
        onClose();
      }, 500);
    } else {
      setErrorMsg(result.error || 'PIN o contraseña incorrecta');
      setPin('');
    }
  };

  const handleDeviceLockAuth = async () => {
    if (!selectedUser) return;
    setErrorMsg(null);
    setIsVerifyingDevice(true);

    try {
      const result = await AuthService.authenticateWithDeviceLock(selectedUser.id);
      if (result.success && result.user) {
        setAuthSuccessNotice(`Autenticado con bloqueo de celular: ${result.user.name}`);
        setTimeout(() => {
          onUserAuthenticated(result.user!);
          setIsVerifyingDevice(false);
          setAuthSuccessNotice(null);
          onClose();
        }, 600);
      } else {
        setIsVerifyingDevice(false);
        setErrorMsg(result.error || 'No se pudo verificar el bloqueo del celular');
      }
    } catch {
      setIsVerifyingDevice(false);
      setErrorMsg('Error en la verificación biométrica del celular');
    }
  };

  const appendPinDigit = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setErrorMsg(null);
    }
  };

  const backspacePin = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-[#131620] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-[#0e1018] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Control de Usuarios y Acceso</span>
              </h3>
              <p className="text-[10px] text-zinc-400">
                {isMandatoryLock ? 'Sesión bloqueada - Autentícate para ingresar' : 'Cambiar de usuario o verificar acceso'}
              </p>
            </div>
          </div>

          {!isMandatoryLock && (
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-xl text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* User selector list */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-2 block flex items-center justify-between">
              <span>Selecciona tu Usuario:</span>
              <span className="text-[10px] text-zinc-400">{users.length} usuarios registrados</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              {users.map((user) => {
                const isSelected = selectedUser?.id === user.id;
                const isAdmin = user.role === 'admin';

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-400 text-white shadow-md shadow-sky-500/10 scale-[1.02]'
                        : 'bg-[#181b26] border-white/5 text-zinc-400 hover:border-white/15 hover:text-zinc-200'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0"
                      style={{ backgroundColor: user.avatarColor || (isAdmin ? '#0284c7' : '#10b981') }}
                    >
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                        {user.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            isAdmin
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isAdmin ? 'Admin' : 'Operador'}
                        </span>
                        {user.phoneLockEnabled && (
                          <span title="Bloqueo celular habilitado">
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

          {selectedUser && (
            <div className="bg-[#181b26] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: selectedUser.avatarColor || '#0284c7' }}
                  >
                    {selectedUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">{selectedUser.name}</span>
                    <span className="text-[10px] text-zinc-400">@{selectedUser.username}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedUser.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {selectedUser.role === 'admin' ? 'Administrador' : 'Usuario'}
                </span>
              </div>

              {/* Quick Biometric / Device Lock Button if enabled */}
              {selectedUser.phoneLockEnabled && (
                <button
                  type="button"
                  onClick={handleDeviceLockAuth}
                  disabled={isVerifyingDevice}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600/30 via-indigo-600/30 to-purple-600/30 hover:from-sky-600/40 hover:to-purple-600/40 text-white font-bold text-xs flex items-center justify-center gap-2 border border-sky-400/40 shadow-sm transition-all active:scale-95"
                >
                  <Fingerprint className="w-4 h-4 text-sky-300 animate-pulse" />
                  <span>
                    {isVerifyingDevice ? 'Verificando celular...' : 'Desbloquear con Celular / Huella'}
                  </span>
                </button>
              )}

              {/* Password / PIN Form */}
              <form onSubmit={handlePinSubmit} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-amber-400" />
                    <span>Contraseña o PIN personal:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPin ? 'Ocultar' : 'Ver'}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="user-auth-pin-input"
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Ingresa tu contraseña o PIN..."
                    className="w-full bg-[#0f1118] border border-white/15 rounded-xl px-3 py-2 text-sm text-center font-mono font-bold tracking-widest text-white focus:outline-none focus:border-sky-400"
                    autoFocus
                  />
                </div>

                {/* Quick numeric keypad for mobile touch screens */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => appendPinDigit(num)}
                      className="py-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-sky-500/20 text-white font-mono font-bold text-sm border border-white/5 transition-colors"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-rose-400 font-bold text-xs border border-white/5 transition-colors"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={() => appendPinDigit('0')}
                    className="py-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-sky-500/20 text-white font-mono font-bold text-sm border border-white/5 transition-colors"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={backspacePin}
                    className="py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs border border-white/5 transition-colors"
                  >
                    ⌫
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/25 transition-all active:scale-95"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Ingresar como {selectedUser.name.split(' ')[0]}</span>
                </button>
              </form>

              {/* Error and Success Notices */}
              {errorMsg && (
                <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {authSuccessNotice && (
                <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  <span>{authSuccessNotice}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick instructions / Help */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[10px] text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-300 flex items-center gap-1">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>Seguridad y Auditoría del Negocio:</span>
            </p>
            <p>
              Todos los movimientos de stock, compras y reposiciones se identificarán con el usuario activo. Los administradores pueden consultar el registro histórico de accesos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
