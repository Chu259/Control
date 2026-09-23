import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Plus,
  ArrowUpRight,
  Sliders,
  CheckCircle2,
  Clock,
  Package,
  ShoppingCart,
  Boxes,
} from 'lucide-react';
import { Product, StoreSettings } from '../types';
import { Sound } from '../services/sound';
import { checkStockAlert } from '../utils/stockAlert';
import { ShoppingService } from '../services/shoppingService';

interface AlertsViewProps {
  products: Product[];
  settings: StoreSettings;
  currency: string;
  onUpdateSettings: (settings: StoreSettings) => void;
  onQuickRestock: (product: Product) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  products,
  settings,
  currency,
  onUpdateSettings,
  onQuickRestock,
}) => {
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const lowStockList = products
    .map((p) => {
      const alert = checkStockAlert(p, settings.defaultMinStock);
      return {
        product: p,
        alert,
        isCritical: alert.isCritical,
        unitsPerBulk: Math.max(1, p.unitsPerBulk || 12),
      };
    })
    .filter(({ alert }) => alert.isLow)
    .sort((a, b) => a.product.stock - b.product.stock);

  const handleAddShopping = (productId: string, productName: string) => {
    ShoppingService.addToShoppingList(productId, 'Agregado desde Alerta de Stock');
    setActionNotice(`"${productName}" añadido a la Lista de Compras.`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleAddReplenish = (productId: string, productName: string) => {
    ShoppingService.addToReplenishmentList(productId, 'Alerta de stock bajo');
    setActionNotice(`"${productName}" añadido a la Lista de Reposición.`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div id="alerts-view" className="p-4 space-y-5 pb-24 max-w-2xl mx-auto">
      {/* Overview Banner */}
      <div className="bg-gradient-to-br from-rose-950/40 via-[#1a1722] to-[#12141c] border border-rose-500/20 rounded-2xl p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Alertas de Stock Bajo</h2>
              <p className="text-xs text-zinc-400">
                {lowStockList.length === 0
                  ? 'Todos los productos tienen niveles de stock saludables'
                  : `${lowStockList.length} producto(s) requieren reposición de mercadería`}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            {lowStockList.length} Activas
          </span>
        </div>
      </div>

      {/* Critical and Warning List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Productos por Agotarse
          </h3>
          <span className="text-[11px] text-zinc-500">Ordenados por urgencia</span>
        </div>

        {lowStockList.length === 0 ? (
          <div className="p-8 text-center bg-[#161922] border border-white/5 rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-white">¡Inventario en Nivel Óptimo!</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Ningún artículo ha cruzado el umbral de alerta configurado.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {lowStockList.map(({ product, alert, isCritical, unitsPerBulk }) => (
              <div
                key={product.id}
                id={`alert-item-${product.id}`}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCritical
                    ? 'bg-rose-950/25 border-rose-500/40 shadow-sm'
                    : 'bg-[#161922] border-amber-500/25'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10 shadow-sm">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">{product.name}</h4>
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                          isCritical
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-400 text-zinc-950'
                        }`}
                      >
                        {alert.alertLabel}
                      </span>
                    </div>

                    {/* Dual stock comparison */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300 font-mono mt-1">
                      <span className={alert.isLowUnit ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                        Uds: {product.stock} (mín: {alert.minUnitAlert})
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className={alert.isLowBulk ? 'text-amber-400 font-bold' : 'text-zinc-300'}>
                        Bultos: {alert.currentBulks} (mín: {alert.minBulkAlert} cj)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                  <button
                    onClick={() => handleAddShopping(product.id, product.name)}
                    className="p-1.5 px-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[11px] font-semibold flex items-center gap-1 border border-sky-500/30 transition-colors"
                    title="Añadir a lista de compras"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">A Compras</span>
                  </button>

                  <button
                    onClick={() => handleAddReplenish(product.id, product.name)}
                    className="p-1.5 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-semibold flex items-center gap-1 border border-amber-500/30 transition-colors"
                    title="Añadir a lista de reposición"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">A Reponer</span>
                  </button>

                  <button
                    id={`reorder-btn-${product.id}`}
                    onClick={() => onQuickRestock(product)}
                    className="p-1.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1 border border-emerald-500/30 transition-colors"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Entrada</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {actionNotice && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>
    </div>
  );
};
