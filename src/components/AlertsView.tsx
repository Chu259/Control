import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Check,
  Clock,
  Hourglass,
  Package,
  ShoppingCart,
  Boxes,
  Sparkles,
} from 'lucide-react';
import { Product, StoreSettings, StockMovement, Category } from '../types';
import { Sound } from '../services/sound';
import { checkStockAlert } from '../utils/stockAlert';
import { ShoppingService } from '../services/shoppingService';
import { StorageService } from '../services/storage';
import { checkProductDailyGondola, getNext19hs } from '../utils/dailyGondolaControl';
import { BulkToUnitsModal } from './BulkToUnitsModal';

interface AlertsViewProps {
  products: Product[];
  movements?: StockMovement[];
  categories?: Category[];
  settings: StoreSettings;
  currency: string;
  onUpdateSettings: (settings: StoreSettings) => void;
  onQuickRestock: (product: Product) => void;
  onOpenBulkAssistant?: (product: Product) => void;
  onDataUpdated?: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  products,
  movements,
  categories = [],
  settings,
  currency,
  onUpdateSettings,
  onQuickRestock,
  onOpenBulkAssistant,
  onDataUpdated,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'dailyGondola' | 'lowStock'>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedBulkProduct, setSelectedBulkProduct] = useState<Product | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [shoppingModalProduct, setShoppingModalProduct] = useState<Product | null>(null);
  const [, setTick] = useState(0);

  // Periodic tick every 30s so the 19:00 hs trigger and timers stay live with device clock
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Retrieve current movements list from prop or fallback to StorageService
  const allMovements = movements && movements.length > 0 ? movements : StorageService.getMovements();

  // REQUIREMENT 1: Disparador Diario (19:00 hs) - Control Diario de Góndola
  // Cualquier producto con stock > 0 sin Entrada ni Salida en las últimas 24hs
  // que no esté actualmente liberado por una verificación de "Góndola OK".
  const dailyControlList = products
    .map((product) => {
      const status = checkProductDailyGondola(product, allMovements);
      return {
        product,
        ...status,
      };
    })
    .filter((item) => item.isPendingVerification)
    .sort((a, b) => b.hoursSinceLastMovement - a.hoursSinceLastMovement);

  // Lista tradicional de productos con stock bajo
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

  const getCategoryName = (catId: string) => {
    const found = categories.find((c) => c.id === catId);
    return found ? found.name : 'General';
  };

  // REQUIREMENT 3: Reinicio con "Góndola OK"
  // Al presionarlo, el empleado confirma que revisó el estante,
  // la alerta se oculta de inmediato y queda liberado hasta las 19:00 hs del día siguiente.
  const handleVerifyGondola = (product: Product) => {
    Sound.playSuccessChime();
    StorageService.verifyProductGondola(product.id, 'Verificado: Góndola OK (Control Diario 19:00 hs)');
    setActionNotice(
      `"${product.name}" verificado como Góndola OK. Liberado hasta las 19:00 hs de mañana.`
    );
    setTimeout(() => setActionNotice(null), 4000);
    if (onDataUpdated) {
      onDataUpdated();
    }
  };

  const handleOpenBulkAssistant = (product: Product) => {
    Sound.playScanBeep();
    if (onOpenBulkAssistant) {
      onOpenBulkAssistant(product);
    } else {
      setSelectedBulkProduct(product);
      setIsBulkModalOpen(true);
    }
  };

  // Requirement 1 & 2: Abrir Asistente al Tocar Compras (🛒) precargado en Modo Entrada/Compra
  const handleOpenShoppingAssistant = (product: Product) => {
    Sound.playScanBeep();
    setShoppingModalProduct(product);
  };

  // Requirement 3: Impactar en la Lista de Compras Real con bultos y unidades
  const handleConfirmAddToShopping = (
    product: Product,
    totalUnits: number,
    bulks: number,
    looseUnits: number
  ) => {
    const upb = Math.max(1, product.unitsPerBulk || 12);
    // Inyectar efectivamente el artículo con sus bultos y unidades dentro de la base de datos de Compras
    ShoppingService.addOrUpdateShoppingItem(product.id, {
      totalUnits,
      bulks,
      looseUnits,
      customNotes: `Pedido Góndola: ${bulks > 0 ? `${bulks} cj` : ''}${bulks > 0 && looseUnits > 0 ? ' + ' : ''}${looseUnits > 0 ? `${looseUnits} uds` : ''}`.trim(),
    });

    Sound.playSuccessChime();
    const qtySummary =
      bulks > 0 && looseUnits > 0
        ? `${bulks} bultos y ${looseUnits} uds (${totalUnits} uds)`
        : bulks > 0
        ? `${bulks} ${bulks === 1 ? 'bulto' : 'bultos'} (${totalUnits} uds)`
        : `${totalUnits} uds`;

    setActionNotice(
      `✓ "${product.name}" inyectado en Lista de Compras: ${qtySummary}.`
    );
    setTimeout(() => setActionNotice(null), 4000);
    setShoppingModalProduct(null);

    if (onDataUpdated) {
      onDataUpdated();
    }
  };

  const handleAddShopping = (productId: string, productName: string) => {
    ShoppingService.addToShoppingList(productId, 'Agregado desde Alerta de Stock');
    setActionNotice(`"${productName}" añadido a la Lista de Compras.`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleAddReplenish = (productId: string, productName: string) => {
    StorageService.toggleProductReposition(productId, true, 'Control Diario de Góndola');
    setActionNotice(`"${productName}" añadido a la Lista de Reposición.`);
    setTimeout(() => setActionNotice(null), 3000);
    if (onDataUpdated) {
      onDataUpdated();
    }
  };

  return (
    <div id="alerts-view" className="p-4 space-y-5 pb-24 max-w-2xl mx-auto select-none">
      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 1: Control Diario de Góndola (Disparador 19:00 hs) */}
        <div
          onClick={() => setFilterTab(filterTab === 'dailyGondola' ? 'all' : 'dailyGondola')}
          className={`p-4 rounded-3xl border-2 transition-all cursor-pointer shadow-lg flex items-center justify-between ${
            filterTab === 'dailyGondola'
              ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/20 shadow-amber-500/10'
              : 'bg-gradient-to-br from-amber-950/20 via-[#1c1815] to-[#12141c] border-amber-500/30 hover:border-amber-400/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold border border-amber-500/30 flex-shrink-0 shadow">
              <Hourglass className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white truncate">Control Diario de Góndola</h3>
              <p className="text-[11px] text-zinc-400 truncate">19:00 hs • Sin ventas 24hs</p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-mono font-black border flex-shrink-0 ${
              dailyControlList.length > 0
                ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            {dailyControlList.length}
          </span>
        </div>

        {/* Card 2: Stock Bajo */}
        <div
          onClick={() => setFilterTab(filterTab === 'lowStock' ? 'all' : 'lowStock')}
          className={`p-4 rounded-3xl border-2 transition-all cursor-pointer shadow-lg flex items-center justify-between ${
            filterTab === 'lowStock'
              ? 'bg-rose-950/40 border-rose-400 ring-2 ring-rose-400/20 shadow-rose-500/10'
              : 'bg-gradient-to-br from-rose-950/20 via-[#1c1518] to-[#12141c] border-rose-500/30 hover:border-rose-400/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold border border-rose-500/30 flex-shrink-0 shadow">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white truncate">Stock por Agotarse</h3>
              <p className="text-[11px] text-zinc-400 truncate">Debajo del mínimo</p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-mono font-black border flex-shrink-0 ${
              lowStockList.length > 0
                ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            {lowStockList.length}
          </span>
        </div>
      </div>

      {/* Filter Tabs Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-[#131620] rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Todas ({dailyControlList.length + lowStockList.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('dailyGondola')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            filterTab === 'dailyGondola'
              ? 'bg-amber-500 text-black shadow-md font-black'
              : 'text-amber-300 hover:text-white'
          }`}
        >
          <span>⏳ Control Diario</span>
          <span className="text-[10px] opacity-80">({dailyControlList.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('lowStock')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            filterTab === 'lowStock'
              ? 'bg-rose-500 text-white shadow-md font-black'
              : 'text-rose-300 hover:text-white'
          }`}
        >
          <span>🔻 Stock Bajo</span>
          <span className="text-[10px] opacity-80">({lowStockList.length})</span>
        </button>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="flex-1">{actionNotice}</span>
        </div>
      )}

      {/* REQUIREMENT 1 & 2: SECCIÓN "CONTROL DIARIO DE GÓNDOLA" */}
      {(filterTab === 'all' || filterTab === 'dailyGondola') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                Control Diario de Góndola
              </h3>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              Evaluación diaria 19:00 hs
            </span>
          </div>

          {dailyControlList.length === 0 ? (
            <div className="p-6 text-center bg-[#161922] border border-white/5 rounded-3xl space-y-1">
              <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto opacity-80" />
              <p className="text-xs sm:text-sm font-bold text-white">¡Góndolas Verificadas y Al Día!</p>
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                Todos los productos con stock en depósito tuvieron ventas en las últimas 24hs o ya fueron confirmados con "Góndola OK". Próximo control a las 19:00 hs.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dailyControlList.map(({ product, stockDesc }) => (
                <div
                  key={`daily-gondola-${product.id}`}
                  id={`daily-gondola-${product.id}`}
                  className="p-3.5 rounded-3xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-[#18161f] to-[#12141c] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:border-amber-400/70 transition-all"
                >
                  {/* Left Column: Product Name, Icon & Requirement 2 Text */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-13 h-13 rounded-2xl bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10 shadow-sm relative">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-zinc-400" />
                      )}
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center text-[9px] font-black shadow">
                        ⏳
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* REQUIREMENT 2: Texto Adaptado en la Tarjeta */}
                      {/* "⚠️ [Nombre del Producto] - Requiere Verificación Diaria de Góndola. Último movimiento hace más de 24hs. Stock en depósito: X bultos" */}
                      <h4 className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-1.5">
                        <span className="text-amber-400 flex-shrink-0">⚠️</span>
                        <span className="truncate">{product.name}</span>
                      </h4>

                      <p className="text-xs text-amber-100/95 font-medium mt-1 leading-snug">
                        <span className="text-amber-300 font-bold">Requiere Verificación Diaria de Góndola.</span>{' '}
                        <span>Último movimiento hace más de 24hs. Stock en depósito:{' '}</span>
                        <strong className="text-white font-black">{stockDesc}</strong>.
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-1">
                        <span>{getCategoryName(product.category)}</span>
                        <span>•</span>
                        <span>Total: {product.stock} uds</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: REQUIREMENT 3: Botón "Góndola OK", Asistente de Bultos y Carrito */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-white/10">
                    {/* Botón 1: "Góndola OK" */}
                    <button
                      type="button"
                      id={`btn-gondola-ok-${product.id}`}
                      onClick={() => handleVerifyGondola(product)}
                      className="py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
                      title="Confirmar revisión de estante. Oculta de inmediato la alerta hasta las 19:00 hs del día siguiente."
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Góndola OK</span>
                    </button>

                    {/* Botón 2: Icono Caja/Bulto (círculos/racimo amarillos actuales): Abre Asistente de Carga por Bultos */}
                    <button
                      type="button"
                      id={`btn-bulk-assistant-${product.id}`}
                      onClick={() => handleOpenBulkAssistant(product)}
                      className="p-2 sm:px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/35 text-amber-300 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition-all cursor-pointer shadow-sm"
                      title="Abrir Asistente de Carga por Bultos precargado con este producto"
                    >
                      <Boxes className="w-4 h-4" />
                      <span className="hidden sm:inline">Bultos</span>
                    </button>

                    {/* Botón 3: Carrito (🛒): Abre Asistente en modo Compra/Entrada para inyectar en Lista de Compras */}
                    <button
                      type="button"
                      id={`btn-shopping-cart-${product.id}`}
                      onClick={() => handleOpenShoppingAssistant(product)}
                      className="p-2 sm:px-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 active:bg-sky-500/35 text-sky-300 text-xs font-bold flex items-center gap-1 border border-sky-500/30 transition-all cursor-pointer shadow-sm"
                      title="Abrir Asistente de Carga por Bultos en modo Compra para inyectar en la Lista de Compras"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span className="hidden sm:inline">Compras</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 2: PRODUCTOS POR AGOTARSE (STOCK BAJO) */}
      {(filterTab === 'all' || filterTab === 'lowStock') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                Productos por Agotarse (Stock Bajo)
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">Ordenados por urgencia</span>
          </div>

          {lowStockList.length === 0 ? (
            <div className="p-6 text-center bg-[#161922] border border-white/5 rounded-3xl space-y-1">
              <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto opacity-80" />
              <p className="text-xs sm:text-sm font-bold text-white">¡Inventario en Nivel Óptimo!</p>
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                Ningún artículo ha cruzado el umbral de alerta configurado.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStockList.map(({ product, alert, isCritical, unitsPerBulk }) => (
                <div
                  key={`low-${product.id}`}
                  id={`alert-item-${product.id}`}
                  className={`p-3.5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
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
                      className="p-2 px-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[11px] font-semibold flex items-center gap-1 border border-sky-500/30 transition-colors"
                      title="Añadir a lista de compras"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">A Compras</span>
                    </button>

                    <button
                      onClick={() => handleAddReplenish(product.id, product.name)}
                      className="p-2 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-semibold flex items-center gap-1 border border-amber-500/30 transition-colors"
                      title="Añadir a lista de reposición"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">A Reponer</span>
                    </button>

                    <button
                      id={`reorder-btn-${product.id}`}
                      onClick={() => onQuickRestock(product)}
                      className="p-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1 border border-emerald-500/30 transition-colors"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Entrada</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Asistente de Carga por Bultos precargado desde alerta de góndola */}
      {isBulkModalOpen && selectedBulkProduct && (
        <BulkToUnitsModal
          isOpen={isBulkModalOpen}
          onClose={() => {
            setIsBulkModalOpen(false);
            setSelectedBulkProduct(null);
          }}
          movementType="out"
          productName={selectedBulkProduct.name}
          initialUnitsPerBulk={selectedBulkProduct.unitsPerBulk || 12}
          bulkUnitName={selectedBulkProduct.bulkUnitName || 'Bulto'}
          currentStock={selectedBulkProduct.stock}
          onConfirmMovement={(units, type) => {
            try {
              const upb = selectedBulkProduct.unitsPerBulk || 12;
              StorageService.recordStockMovement({
                productId: selectedBulkProduct.id,
                type: type,
                quantity: units,
                reason: type === 'in' ? 'compra' : 'venta',
                format: 'bulk',
                unitType: 'bulk',
                bulkQuantity: Math.floor(units / upb),
                notes: 'Desde Alerta de Control Diario de Góndola',
              });
              Sound.playSuccessChime();
              setActionNotice(
                `✓ Movimiento registrado: ${type === 'in' ? 'Entrada' : 'Salida'} de ${units} uds en "${selectedBulkProduct.name}".`
              );
              setTimeout(() => setActionNotice(null), 3500);
              setIsBulkModalOpen(false);
              setSelectedBulkProduct(null);
              if (onDataUpdated) {
                onDataUpdated();
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}

      {/* Requirement 1, 2 & 3: Modal Asistente de Carga por Bultos precargado en Modo Entrada/Compra para Proveedor */}
      {shoppingModalProduct && (
        <BulkToUnitsModal
          isOpen={Boolean(shoppingModalProduct)}
          onClose={() => setShoppingModalProduct(null)}
          movementType="in"
          isShoppingMode={true}
          modalTitle="Pedido de Compras al Proveedor"
          productName={shoppingModalProduct.name}
          initialUnitsPerBulk={shoppingModalProduct.unitsPerBulk || 12}
          bulkUnitName={shoppingModalProduct.bulkUnitName || 'Bulto'}
          currentStock={shoppingModalProduct.stock}
          onConfirmShopping={(totalUnits, bulks, looseUnits) => {
            handleConfirmAddToShopping(shoppingModalProduct, totalUnits, bulks, looseUnits);
          }}
        />
      )}
    </div>
  );
};
