import React from 'react';
import { Bell, Search, ShieldCheck, Moon, RefreshCw, Smartphone, Barcode, Camera, User, Lock, LogOut } from 'lucide-react';
import { StoreSettings, AppUser } from '../types';

interface AndroidHeaderProps {
  settings: StoreSettings;
  lowStockCount: number;
  onOpenAlerts: () => void;
  onOpenSync?: () => void;
  onScanBarcode?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentUser?: AppUser;
  onOpenUserAuth?: () => void;
  onLogout?: () => void;
}

export const AndroidHeader: React.FC<AndroidHeaderProps> = ({
  settings,
  lowStockCount,
  onOpenAlerts,
  onOpenSync,
  onScanBarcode,
  searchQuery,
  onSearchChange,
  currentUser,
  onOpenUserAuth,
  onLogout,
}) => {
  const syncConfig = settings.syncConfig;
  const isMaster = syncConfig?.role !== 'client';

  return (
    <header className="bg-[#0b0d13] border-b border-white/5 sticky top-0 z-30 select-none">
      {/* Main Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-black font-bold text-sm shadow-md">
            📦
          </div>
          <div className="truncate">
            <h1 className="text-sm font-bold text-white truncate">{settings.storeName}</h1>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span className="flex items-center gap-0.5 text-emerald-400">
                <ShieldCheck className="w-2.5 h-2.5" /> 100% Offline Local
              </span>
              <span>•</span>
              <span className="text-zinc-500 flex items-center gap-0.5">
                <Moon className="w-2.5 h-2.5 text-indigo-400" /> Modo Oscuro
              </span>
            </div>
          </div>
        </div>

        {/* Notifications & Action Icons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Active User Pill */}
          {currentUser && onOpenUserAuth && (
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenUserAuth}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#161922] hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 transition-colors"
                title={`Usuario activo: ${currentUser.name}. Toca para cambiar de usuario.`}
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: currentUser.avatarColor || '#0284c7' }}
                >
                  {currentUser.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden sm:inline truncate max-w-[80px] text-white">
                  {currentUser.name.split(' ')[0]}
                </span>
                <span
                  className={`text-[8.5px] px-1 py-0.2 rounded font-bold ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {currentUser.role === 'admin' ? 'Admin' : 'User'}
                </span>
              </button>

              {onLogout && (
                <button
                  id="header-logout-btn"
                  onClick={onLogout}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/5 text-zinc-400 transition-colors"
                  title="Cerrar sesión / Bloquear pantalla"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Sync status quick button */}
          {onOpenSync && (
            <button
              id="header-sync-btn"
              onClick={onOpenSync}
              className={`p-2 rounded-xl border flex items-center gap-1 text-[11px] font-semibold transition-all ${
                isMaster
                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              }`}
              title="Sincronización multi-dispositivo"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isMaster ? 'Servidor BD' : 'Sincronizar'}</span>
            </button>
          )}

          <button
            id="alerts-bell-btn"
            onClick={onOpenAlerts}
            className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
            title="Alertas de Stock"
          >
            <Bell className="w-4 h-4" />
            {lowStockCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {lowStockCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Quick Search Box with integrated Barcode Scan Button */}
      <div className="px-4 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              id="search-products-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nombre, código de unidad o bulto..."
              className="w-full bg-[#161922] border border-white/10 rounded-xl pl-9 pr-16 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/70 transition-colors"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="text-zinc-400 hover:text-white text-xs px-1"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
              {onScanBarcode && (
                <button
                  type="button"
                  onClick={onScanBarcode}
                  className="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
                  title="Escanear código de barra con la cámara"
                >
                  <Barcode className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {onScanBarcode && (
            <button
              id="header-barcode-scan-btn"
              type="button"
              onClick={onScanBarcode}
              className="h-[34px] px-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 flex items-center gap-1.5 text-xs font-bold shadow-md active:scale-95 transition-all flex-shrink-0"
              title="Escanear código de barra (Unidad / Bulto)"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>Escanear</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
