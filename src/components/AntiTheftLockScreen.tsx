import React, { useState } from 'react';
import {
  Lock,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  Unlock,
  Store,
} from 'lucide-react';
import { AntiTheftService } from '../services/antiTheftService';
import { Sound } from '../services/sound';

interface AntiTheftLockScreenProps {
  onUnlocked: () => void;
  storeName?: string;
}

export const AntiTheftLockScreen: React.FC<AntiTheftLockScreenProps> = ({
  onUnlocked,
  storeName = 'depos',
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

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

  const handleUnlockSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setError('Ingrese el PIN del Administrador Principal');
      return;
    }

    setIsVerifying(true);
    setError(null);

    setTimeout(() => {
      const res = AntiTheftService.unlockWithPrincipalAdminPin(pin);
      setIsVerifying(false);

      if (res.success) {
        Sound.playSuccessChime();
        onUnlocked();
      } else {
        Sound.playWarningTone();
        setError(res.error || 'PIN de Administrador Principal incorrecto. Acceso bloqueado.');
        setPin('');
      }
    }, 250);
  };

  return (
    <div
      id="anti-theft-lock-screen"
      className="fixed inset-0 z-[9999] bg-[#07090e] text-white flex flex-col justify-center items-center p-4 sm:p-6 overflow-y-auto"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Background warning pattern */}
      <div className="absolute inset-0 bg-radial from-rose-950/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md bg-[#0f121b] border-2 border-rose-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-rose-950/60 text-center space-y-4 animate-scale-up">
        {/* Lock Icon */}
        <div className="mx-auto inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-400 shadow-lg shadow-rose-500/20 animate-pulse">
          <ShieldAlert className="w-9 h-9" />
        </div>

        {/* Store Brand */}
        <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-xs font-semibold">
          <Store className="w-3.5 h-3.5 text-amber-400" />
          <span>{storeName}</span>
        </div>

        {/* Exact Required Lock Warning Message */}
        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold tracking-wide uppercase">
            Protocolo Antirrobo Activado
          </div>
          <h1 className="text-base sm:text-lg font-black text-rose-200 tracking-tight leading-snug">
            🔒 APLICACIÓN BLOQUEADA: Tiempo límite de sincronización excedido. Contacte al Administrador
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
            Este terminal ha pasado más de 48 horas continuas sin sincronizar con la terminal central del Administrador. Ingrese físicamente la credencial administrativa para rehabilitar el uso.
          </p>
        </div>

        {/* PIN Entry Form */}
        <form onSubmit={handleUnlockSubmit} className="space-y-3 pt-2 text-left">
          <label className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-300">
              <KeyRound className="w-3.5 h-3.5" />
              PIN del Administrador Principal:
            </span>
            <span className="text-[10px] text-zinc-500">Obligatorio</span>
          </label>

          <div className="relative">
            <input
              id="anti-theft-pin-input"
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              placeholder="••••"
              className="w-full bg-[#080a10] border-2 border-rose-500/40 focus:border-amber-400 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-white focus:outline-hidden"
              autoFocus
            />
            <button
              type="button"
              id="toggle-anti-theft-pin-eye"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick On-Screen Touch Keypad */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                id={`anti-theft-keypad-${digit}`}
                onClick={() => handleKeypadPress(digit)}
                className="py-3 bg-[#181b28] hover:bg-[#202538] active:bg-amber-500/30 text-white font-bold rounded-xl text-base border border-white/5 transition-all shadow-sm"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              id="anti-theft-keypad-clear"
              onClick={handleClear}
              className="py-3 bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 font-semibold rounded-xl text-xs border border-rose-500/20 transition-all"
            >
              Borrar
            </button>
            <button
              type="button"
              id="anti-theft-keypad-0"
              onClick={() => handleKeypadPress('0')}
              className="py-3 bg-[#181b28] hover:bg-[#202538] active:bg-amber-500/30 text-white font-bold rounded-xl text-base border border-white/5 transition-all shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              id="anti-theft-keypad-backspace"
              onClick={handleBackspace}
              className="py-3 bg-[#181b28] hover:bg-[#202538] text-zinc-300 font-semibold rounded-xl text-sm border border-white/5 transition-all flex items-center justify-center"
            >
              ⌫
            </button>
          </div>

          {/* Unlock Submit Button */}
          <button
            type="submit"
            id="btn-unlock-anti-theft"
            disabled={isVerifying || !pin.trim()}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 text-black font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
          >
            {isVerifying ? (
              <span>Validando credencial...</span>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Desbloquear con PIN de Administrador</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[10px] text-zinc-500 pt-1">
          La desactivación del bloqueo restablece el contador de 48 horas y habilita el acceso normal al depósito.
        </p>
      </div>
    </div>
  );
};
