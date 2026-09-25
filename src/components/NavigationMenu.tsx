import React, { useState } from 'react';
import {
  LayoutGrid,
  ArrowUpDown,
  Bell,
  FileText,
  Settings,
  Plus,
  Camera,
  ArrowUpRight,
  ArrowDownRight,
  PackagePlus,
  RefreshCw,
  Boxes,
  ShoppingCart,
  MoreHorizontal,
  X,
  Users,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { AppTab } from '../types';

interface NavigationMenuProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  lowStockCount: number;
  repositionCount?: number;
  onOpenScanner: () => void;
  onOpenNewProduct: () => void;
  onQuickMovementOpen: (type: 'in' | 'out') => void;
  onLogout?: () => void;
}

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  currentTab,
  onTabChange,
  lowStockCount,
  repositionCount,
  onOpenScanner,
  onOpenNewProduct,
  onQuickMovementOpen,
  onLogout,
}) => {
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const mainTabs: { id: AppTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'inventory', label: 'Stock', icon: LayoutGrid },
    { id: 'replenishment', label: 'Reposición', icon: Boxes, badge: repositionCount },
    { id: 'shopping', label: 'Compras', icon: ShoppingCart },
    { id: 'movements', label: 'Movimientos', icon: ArrowUpDown },
    { id: 'alerts', label: 'Alertas', icon: Bell, badge: lowStockCount },
  ];

  const secondaryTabs: { id: AppTab; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
    { id: 'users', label: 'Usuarios y Accesos', icon: Users, desc: 'Administradores, celulares y auditoría' },
    { id: 'reports', label: 'Reportes y Métricas', icon: FileText, desc: 'Historial y estadísticas de stock' },
    { id: 'sync', label: 'Sincronizar Dispositivos', icon: RefreshCw, desc: 'Conexión maestro y clientes' },
    { id: 'settings', label: 'Configuración', icon: Settings, desc: 'Preferencias, tienda y notificaciones' },
  ];

  const isSecondaryActive = secondaryTabs.some((t) => t.id === currentTab);

  return (
    <>
      {/* Backdrop for FAB Speed Dial */}
      {speedDialOpen && (
        <div
          onClick={() => setSpeedDialOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs animate-fade-in"
        />
      )}

      {/* "Más Opciones" Bottom Sheet */}
      {moreMenuOpen && (
        <div
          onClick={() => setMoreMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fade-in flex items-end sm:items-center justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#161922] border border-white/10 rounded-3xl p-4 shadow-2xl space-y-3 mb-16 sm:mb-0 animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Menú y Herramientas Adicionales
              </span>
              <button
                onClick={() => setMoreMenuOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {secondaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`more-menu-${tab.id}`}
                    onClick={() => {
                      onTabChange(tab.id);
                      setMoreMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'bg-white/[0.03] hover:bg-white/[0.08] text-zinc-200'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isActive ? 'bg-amber-500/30 text-amber-300' : 'bg-white/5 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold">{tab.label}</p>
                      <p className="text-[10px] text-zinc-400">{tab.desc}</p>
                    </div>
                  </button>
                );
              })}

              {onLogout && (
                <button
                  type="button"
                  id="more-menu-logout"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-rose-500/20 text-rose-300">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold">Cerrar Sesión</p>
                    <p className="text-[10px] text-rose-400/80">Salir a la pantalla de bienvenida</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) matching screenshot yellow button */}
      <div className="fixed bottom-16 right-4 sm:right-6 z-50 flex flex-col items-end gap-2.5">
        {speedDialOpen && (
          <div className="flex flex-col items-end gap-2 mb-2 animate-scale-up">
            <button
              id="fab-scan-btn"
              onClick={() => {
                setSpeedDialOpen(false);
                onOpenScanner();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1e2230] border border-teal-500/40 text-teal-300 shadow-xl hover:bg-[#252a3a] text-xs font-semibold transition-transform active:scale-95"
            >
              <span>Escanear MLKit (Ud/Bulto)</span>
              <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
            </button>

            <button
              id="fab-in-btn"
              onClick={() => {
                setSpeedDialOpen(false);
                onQuickMovementOpen('in');
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1e2230] border border-emerald-500/40 text-emerald-300 shadow-xl hover:bg-[#252a3a] text-xs font-semibold transition-transform active:scale-95"
            >
              <span>Entrada (Stock / Bultos)</span>
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </button>

            <button
              id="fab-out-btn"
              onClick={() => {
                setSpeedDialOpen(false);
                onQuickMovementOpen('out');
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1e2230] border border-rose-500/40 text-rose-300 shadow-xl hover:bg-[#252a3a] text-xs font-semibold transition-transform active:scale-95"
            >
              <span>Salida / Venta (-)</span>
              <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </button>

            <button
              id="fab-new-product-btn"
              onClick={() => {
                setSpeedDialOpen(false);
                onOpenNewProduct();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1e2230] border border-amber-500/40 text-amber-300 shadow-xl hover:bg-[#252a3a] text-xs font-semibold transition-transform active:scale-95"
            >
              <span>Nuevo Producto (Ud + Bulto)</span>
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <PackagePlus className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

        {/* The Golden / Yellow FAB Button from the screenshot */}
        <button
          id="main-fab-button"
          onClick={() => setSpeedDialOpen(!speedDialOpen)}
          className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black flex items-center justify-center shadow-[0_4px_20px_rgba(245,158,11,0.5)] transition-all duration-300 active:scale-90 ${
            speedDialOpen ? 'rotate-45 shadow-amber-500/60' : ''
          }`}
          title="Acciones Rápidas"
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </button>
      </div>

      {/* Android Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0d0f15]/95 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-lg mx-auto flex items-center justify-between px-1 py-1.5">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex-1 flex flex-col items-center py-1 px-0.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-amber-400 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${
                      isActive ? 'scale-110 text-amber-400' : ''
                    }`}
                  />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8.5px] font-extrabold flex items-center justify-center shadow">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[8.5px] sm:text-[10px] mt-0.5 tracking-tight truncate max-w-[56px] text-center">
                  {tab.label}
                </span>
                {isActive && <div className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />}
              </button>
            );
          })}

          {/* Más button */}
          <button
            id="nav-tab-more"
            onClick={() => setMoreMenuOpen(true)}
            className={`relative flex-1 flex flex-col items-center py-1 px-0.5 rounded-xl transition-all ${
              isSecondaryActive
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="relative">
              <MoreHorizontal
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${
                  isSecondaryActive ? 'scale-110 text-amber-400' : ''
                }`}
              />
            </div>
            <span className="text-[8.5px] sm:text-[10px] mt-0.5 tracking-tight truncate max-w-[56px] text-center">
              Más
            </span>
            {isSecondaryActive && <div className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />}
          </button>
        </div>
      </nav>
    </>
  );
};
