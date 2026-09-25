import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Trash2,
  Barcode,
  Package,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  X,
  MapPin,
  Check,
} from 'lucide-react';
import { Product, StoreSettings, ReplenishmentItem, MovementType, MovementReason, AppUser } from '../types';
import { ShoppingService } from '../services/shoppingService';
import { StorageService } from '../services/storage';
import { Sound } from '../services/sound';
import { checkStockAlert } from '../utils/stockAlert';

interface ReplenishmentViewProps {
  products: Product[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onRecordMovement?: (params: {
    productId: string;
    type: MovementType;
    quantity: number;
    reason: MovementReason;
    notes?: string;
    unitType?: 'unit' | 'bulk';
    bulkQuantity?: number;
    unitsPerBulk?: number;
  }) => void;
  onOpenMovement?: (product: Product, type: 'in', unitType?: 'unit' | 'bulk', quantity?: number) => void;
  onNavigateToStock: () => void;
  onScanSearch?: (callback: (val: string) => void) => void;
  onUpdateProduct?: (product: Product) => void;
  onRefreshData?: () => void;
}

export const ReplenishmentView: React.FC<ReplenishmentViewProps> = ({
  products,
  settings,
  currentUser,
  onRecordMovement,
  onOpenMovement,
  onNavigateToStock,
  onScanSearch,
  onUpdateProduct,
  onRefreshData,
}) => {
  const [items, setItems] = useState<ReplenishmentItem[]>([]);
  const [activeProducts, setActiveProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [searchFilter, setSearchFilter] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Local state for which action is selected per product: 'in' (Entrada) or 'out' (Salida)
  const [movementTypes, setMovementTypes] = useState<Record<string, 'in' | 'out'>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Local string state for quantity inputs to allow clearing (backspacing) completely and typing numbers smoothly
  const [quantityInputValues, setQuantityInputValues] = useState<Record<string, string>>({});

  const reloadList = () => {
    const list = ShoppingService.getReplenishmentList();
    setItems(list);
    setActiveProducts(StorageService.getProducts());
  };

  useEffect(() => {
    reloadList();
  }, []);

  // Synchronize when products prop changes or when reposition_updated event fires
  useEffect(() => {
    setActiveProducts(StorageService.getProducts());
  }, [products]);

  useEffect(() => {
    const handleRepositionEvent = () => {
      reloadList();
    };
    window.addEventListener('reposition_updated', handleRepositionEvent);
    return () => {
      window.removeEventListener('reposition_updated', handleRepositionEvent);
    };
  }, []);

  // Requirement 1 & 3: Add product to replenishment directly persisting isPendingReposition = true in local DB
  const handleAddProductToReposition = (product: Product) => {
    const suggested = computeSuggestedGondola(product);
    const updated = StorageService.toggleProductReposition(
      product.id,
      true,
      product.notes || 'Reponer en góndola',
      suggested
    );
    if (updated) {
      if (onUpdateProduct) onUpdateProduct(updated);
      if (onRefreshData) onRefreshData();
    }
    reloadList();
    Sound.playSuccessChime();
    setToastMessage(`✓ ${product.name} añadido a Reposición`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Requirement 1 & 3: Remove product from replenishment persisting isPendingReposition = false
  const handleRemoveProductFromReposition = (productId: string) => {
    const updated = StorageService.toggleProductReposition(productId, false);
    if (updated) {
      if (onUpdateProduct) onUpdateProduct(updated);
      if (onRefreshData) onRefreshData();
    }
    reloadList();
  };

  const getMovementType = (productId: string): 'in' | 'out' => {
    return movementTypes[productId] || 'in';
  };

  const setMovementTypeFor = (productId: string, type: 'in' | 'out') => {
    setMovementTypes((prev) => ({ ...prev, [productId]: type }));
  };

  // Calculates a smart suggested restock quantity for shelf/gondola
  const computeSuggestedGondola = (product: Product, item?: ReplenishmentItem): number => {
    if (item?.suggestedUnits && item.suggestedUnits > 0) {
      return item.suggestedUnits;
    }
    // Priority: use explicit suggested quantity in gondola set on product
    if (product.suggestedGondolaQuantity && product.suggestedGondolaQuantity > 0) {
      const diff = product.suggestedGondolaQuantity - product.stock;
      return diff > 0 ? diff : product.suggestedGondolaQuantity;
    }
    const minUnit = product.minStockAlertUnit ?? product.minStockAlert ?? settings.defaultMinStock ?? 5;
    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
    const targetCapacity = Math.max(minUnit * 2, unitsPerBulk);
    const needed = targetCapacity - product.stock;
    return needed > 0 ? needed : Math.max(1, unitsPerBulk);
  };

  // Returns user-customized quantity to add or defaults according to unitMode
  const getQuantityToAdd = (product: Product, item: ReplenishmentItem): number => {
    if (item.quantityToAdd !== undefined && item.quantityToAdd > 0) {
      return item.quantityToAdd;
    }
    const suggestedUnits = computeSuggestedGondola(product, item);
    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
    if (item.unitMode === 'bulk') {
      return Math.max(1, Math.round(suggestedUnits / unitsPerBulk));
    }
    return suggestedUnits;
  };

  const handleUpdateQuantityToAdd = (productId: string, qty: number) => {
    const safeQty = Math.max(0, qty);
    const updated = ShoppingService.updateReplenishmentQuantity(productId, safeQty);
    setItems(updated);
  };

  const handleQuantityInputChange = (productId: string, rawVal: string) => {
    // Only allow digits so users don't type invalid characters, but allow empty string "" for full deletion/backspace
    const cleanVal = rawVal.replace(/[^0-9]/g, '');
    setQuantityInputValues((prev) => ({ ...prev, [productId]: cleanVal }));

    const parsed = parseInt(cleanVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      handleUpdateQuantityToAdd(productId, parsed);
    }
  };

  const handleQuantityInputBlur = (productId: string, fallbackQty: number) => {
    const rawVal = quantityInputValues[productId];
    if (rawVal === undefined) return;
    const parsed = parseInt(rawVal, 10);
    if (isNaN(parsed) || parsed < 0) {
      const resetQty = Math.max(0, fallbackQty ?? 0);
      handleUpdateQuantityToAdd(productId, resetQty);
    } else {
      handleUpdateQuantityToAdd(productId, parsed);
    }
    setQuantityInputValues((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const handleStepQuantity = (productId: string, delta: number, currentQty: number) => {
    const rawVal = quantityInputValues[productId];
    const base = rawVal !== undefined && rawVal !== '' ? parseInt(rawVal, 10) || currentQty : currentQty;
    const nextQty = Math.max(0, base + delta);
    handleUpdateQuantityToAdd(productId, nextQty);
    setQuantityInputValues((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const handleUpdateUnitMode = (productId: string, newMode: 'unit' | 'bulk', product: Product) => {
    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
    const item = items.find((i) => i.productId === productId);
    const currentQty = item?.quantityToAdd || computeSuggestedGondola(product, item);

    let convertedQty = currentQty;
    if (newMode === 'bulk' && (!item?.unitMode || item.unitMode === 'unit')) {
      convertedQty = Math.max(0, Math.round(currentQty / unitsPerBulk));
    } else if (newMode === 'unit' && item?.unitMode === 'bulk') {
      convertedQty = Math.max(0, currentQty * unitsPerBulk);
    }

    ShoppingService.updateReplenishmentQuantity(productId, convertedQty);
    const updated = ShoppingService.updateReplenishmentUnitMode(productId, newMode);
    setItems(updated);
    setQuantityInputValues((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  // Confirmation handler for inline functions directly underneath each product
  const handleConfirmInlineMovement = (product: Product, item: ReplenishmentItem) => {
    const currentType = getMovementType(product.id);
    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
    // Use whatever the user currently has in the text input if they just typed it
    const rawVal = quantityInputValues[product.id];
    const rawParsed = rawVal !== undefined && rawVal !== '' ? parseInt(rawVal, 10) : NaN;
    const addQty = !isNaN(rawParsed) && rawParsed >= 1 ? rawParsed : getQuantityToAdd(product, item);
    const isBulk = item.unitMode === 'bulk';
    const effectiveUnits = isBulk ? addQty * unitsPerBulk : addQty;

    // Optional guard for stock depletion on saída
    if (currentType === 'out' && product.stock < effectiveUnits) {
      if (
        !confirm(
          `El stock actual (${product.stock}) es menor a la salida solicitada (${effectiveUnits}). ¿Deseas continuar?`
        )
      ) {
        return;
      }
    }

    setProcessingId(product.id);

    try {
      const movementParams = {
        productId: product.id,
        type: currentType as MovementType,
        quantity: effectiveUnits,
        reason: (currentType === 'in' ? 'restock' : 'sale') as MovementReason,
        notes: currentType === 'in' ? 'Reposición góndola directa' : 'Venta / Salida góndola directa',
        unitType: isBulk ? ('bulk' as const) : ('unit' as const),
        bulkQuantity: isBulk ? addQty : undefined,
        unitsPerBulk: unitsPerBulk,
      };

      if (onRecordMovement) {
        onRecordMovement(movementParams);
      } else {
        StorageService.recordStockMovement({
          ...movementParams,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
        });
      }

      // Play audio feedback
      Sound.playSuccessChime();

      // Automatically mark as completed in replenishment list and clear product pending flag
      ShoppingService.setReplenishmentStatus(product.id, 'completed');
      const updatedProduct = StorageService.toggleProductReposition(product.id, false);
      if (updatedProduct && onUpdateProduct) {
        onUpdateProduct(updatedProduct);
      }
      reloadList();
      if (onRefreshData) onRefreshData();

      const unitLabel = isBulk ? (addQty === 1 ? 'Bulto' : 'Bultos') : (product.unit || 'uds');
      setToastMessage(
        `✓ ¡${currentType === 'in' ? 'Entrada' : 'Salida'} de ${addQty} ${unitLabel} (${effectiveUnits} uds) confirmada!`
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert('Error al registrar movimiento: ' + (err?.message || 'Error desconocido'));
    } finally {
      setProcessingId(null);
    }
  };

  // Requirement 2: Read actively and filter all products that have isPendingReposition === true or exist in items
  const itemsMap = new Map<string, ReplenishmentItem>();
  items.forEach((it) => itemsMap.set(it.productId, it));

  const allReplenishMap = new Map<string, { item: ReplenishmentItem; product: Product }>();

  // 1. All products that have isPendingReposition === true in local database
  activeProducts.forEach((p) => {
    if (p.isPendingReposition) {
      const existingItem = itemsMap.get(p.id);
      const repItem: ReplenishmentItem = existingItem || {
        id: `rep-${p.id}`,
        productId: p.id,
        status: 'pending',
        locationNotes: p.repositionNotes || p.notes || 'Reponer en góndola',
        suggestedUnits: p.repositionQuantity,
        addedAt: p.repositionAddedAt || new Date().toISOString(),
      };
      allReplenishMap.set(p.id, { item: repItem, product: p });
    }
  });

  // 2. Also include any completed items or items stored in ShoppingService
  items.forEach((it) => {
    if (!allReplenishMap.has(it.productId)) {
      const p = activeProducts.find((prod) => prod.id === it.productId);
      if (p) {
        allReplenishMap.set(p.id, { item: it, product: p });
      }
    }
  });

  const populatedItems = Array.from(allReplenishMap.values());

  const pendingCount = populatedItems.filter(
    ({ item, product }) => product.isPendingReposition === true || item.status === 'pending'
  ).length;
  const completedCount = populatedItems.filter(
    ({ item, product }) => !product.isPendingReposition && item.status === 'completed'
  ).length;

  const filteredItems = populatedItems.filter(({ item, product }) => {
    const isPending = product.isPendingReposition === true || item.status === 'pending';
    if (statusFilter === 'pending' && !isPending) return false;
    if (statusFilter === 'completed' && isPending) return false;
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      product.name.toLowerCase().includes(q) ||
      (product.barcodeUnit || product.barcode || '').toLowerCase().includes(q) ||
      (product.barcodeBulk && product.barcodeBulk.toLowerCase().includes(q)) ||
      (item.locationNotes && item.locationNotes.toLowerCase().includes(q))
    );
  });

  // Auto-populate from low stock items
  const handleAutoAddLowStock = () => {
    const lowStockProducts = products.filter((p) => checkStockAlert(p).isLow);
    if (lowStockProducts.length === 0) {
      alert('No hay productos con alertas de stock bajo actualmente.');
      return;
    }

    let added = 0;
    lowStockProducts.forEach((p) => {
      if (!p.isPendingReposition) {
        const suggested = computeSuggestedGondola(p);
        const updated = StorageService.toggleProductReposition(p.id, true, p.notes || 'Reponer en góndola', suggested);
        if (updated && onUpdateProduct) {
          onUpdateProduct(updated);
        }
        added++;
      }
    });

    reloadList();
    if (onRefreshData) onRefreshData();
    setToastMessage(`Se añadieron ${added} productos con stock mínimo a Reposición.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleStatus = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    const item = itemsMap.get(productId);
    const willBePending = item?.status === 'completed' || !product?.isPendingReposition;
    const updated = StorageService.toggleProductReposition(productId, willBePending);
    if (updated && onUpdateProduct) {
      onUpdateProduct(updated);
    }
    ShoppingService.toggleReplenishmentStatus(productId);
    reloadList();
    if (onRefreshData) onRefreshData();
  };

  const handleRemove = (productId: string) => {
    handleRemoveProductFromReposition(productId);
  };

  const handleClear = () => {
    if (confirm('¿Vaciar toda la lista de reposición?')) {
      products.forEach((p) => {
        if (p.isPendingReposition) {
          const updated = StorageService.toggleProductReposition(p.id, false);
          if (updated && onUpdateProduct) {
            onUpdateProduct(updated);
          }
        }
      });
      ShoppingService.clearReplenishmentList();
      reloadList();
      if (onRefreshData) onRefreshData();
    }
  };

  return (
    <div id="replenishment-view" className="p-4 space-y-4 pb-24 max-w-3xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#16241b] via-[#151c20] to-[#12141c] border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Lista de Reposición de Góndolas</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pendingCount} pendientes
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Control de abastecimiento de estantes desde depósito o trastienda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="auto-add-replenish-btn"
              onClick={handleAutoAddLowStock}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Cargar Stock Bajo</span>
            </button>
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Producto</span>
            </button>
          </div>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'all'
                ? 'bg-white/15 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({populatedItems.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
              statusFilter === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pendientes ({pendingCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
              statusFilter === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Repuestos ({completedCount})</span>
          </button>
        </div>

        {toastMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* Search & Actions Bar with Barcode Scanner */}
      <div className="flex items-center justify-between gap-2 bg-[#161922] p-2.5 rounded-xl border border-white/5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar por producto, código o pasillo..."
            className="w-full bg-[#0d0f15] border border-white/10 rounded-xl pl-9 pr-16 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="text-zinc-400 hover:text-white text-xs p-0.5"
                title="Limpiar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {onScanSearch && (
              <button
                type="button"
                id="btn-scan-replenish-search"
                onClick={() => onScanSearch((val) => setSearchFilter(val))}
                className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
                title="Escanear código de barra para buscar"
              >
                <Barcode className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {populatedItems.length > 0 && (
          <button
            onClick={handleClear}
            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors"
            title="Vaciar lista de reposición"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main List */}
      {populatedItems.length === 0 ? (
        <div className="bg-[#161922] border border-white/10 rounded-2xl p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
            <Boxes className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-white">No hay productos en la lista de reposición</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Usa esta sección para planificar qué productos deben trasladarse desde el depósito a las estanterías de la tienda.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleAutoAddLowStock}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 border border-amber-500/30"
            >
              <Sparkles className="w-4 h-4" />
              <span>Cargar Sugeridos (Stock Bajo)</span>
            </button>
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
            >
              Buscar en Catálogo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(({ item, product }) => {
            const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
            const bulkUnitName = product.bulkUnitName || `Caja x${unitsPerBulk}`;
            const alertStatus = checkStockAlert(product);
            const isCompleted = item.status === 'completed';
            const suggestedGondola = computeSuggestedGondola(product, item);
            const currentAddQty = getQuantityToAdd(product, item);
            const isBulk = item.unitMode === 'bulk';
            const effectiveUnits = isBulk ? currentAddQty * unitsPerBulk : currentAddQty;
            const currentType = getMovementType(product.id);

            const displayQtyText = isBulk
              ? `${currentAddQty} ${currentAddQty === 1 ? (product.bulkUnitName || 'Bulto') : (product.bulkUnitName || 'Bultos')} = ${effectiveUnits} uds`
              : `${currentAddQty} ${product.unit || 'uds'}`;

            return (
              <div
                key={item.id}
                id={`replenish-card-${product.id}`}
                className={`bg-[#161922] border rounded-2xl p-3 sm:p-4 transition-all shadow-lg ${
                  isCompleted
                    ? 'border-emerald-500/40 bg-[#121815]/90'
                    : 'border-white/10 hover:border-emerald-500/30'
                }`}
              >
                {/* Upper Area: Checkbox + Left Column (Image, Sugerido, Uds/Bultos, Counter) + Right Column (Info) */}
                <div className="flex items-start gap-3">
                  {/* Status Checkbox Button matching sketch: circular ring when pending, filled green check when completed */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(product.id)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0 mt-1 cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                        : 'border-2 border-white/20 hover:border-emerald-400 bg-white/5 text-transparent'
                    }`}
                    title={isCompleted ? 'Marcar como pendiente' : 'Marcar como repuesto'}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>

                  {/* Photo & Restock Stepper Controls */}
                  <div className="flex flex-col items-center flex-shrink-0 w-24 sm:w-28">
                    {/* Photo / Icon */}
                    <div className="w-16 h-16 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-white/10 shadow">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                          {product.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Sugerido góndola badge */}
                    <div className="mt-1.5 w-full text-center bg-[#211a10] border border-amber-500/30 rounded-lg py-1 px-1">
                      <span className="text-[9px] text-amber-300/80 font-medium block leading-none">
                        Sugerido góndola
                      </span>
                      <span className="text-xs font-bold text-amber-300 font-mono leading-tight block mt-0.5">
                        {suggestedGondola} {product.unit || 'uds'}
                      </span>
                    </div>

                    {/* Selector de modo: Unidades vs Bultos */}
                    <div className="mt-1.5 w-full flex flex-col items-center">
                      <div className="flex items-center w-full bg-[#11131a] p-0.5 rounded-lg border border-white/10 mb-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateUnitMode(product.id, 'unit', product)}
                          className={`flex-1 py-0.5 text-[9px] font-bold rounded transition-all ${
                            (!item.unitMode || item.unitMode === 'unit')
                              ? 'bg-emerald-500 text-slate-950 shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Uds
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateUnitMode(product.id, 'bulk', product)}
                          className={`flex-1 py-0.5 text-[9px] font-bold rounded transition-all ${
                            item.unitMode === 'bulk'
                              ? 'bg-amber-500 text-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Bultos
                        </button>
                      </div>

                      {/* Stepper [-] [number] [+] */}
                      <div className="flex items-center rounded-lg border border-emerald-500/40 bg-[#0c0e14] shadow-sm w-full justify-between overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(product.id, -1, currentAddQty)}
                          className="w-7 h-6 text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-center font-bold text-xs transition-colors select-none active:bg-white/20 cursor-pointer"
                          title="Disminuir cantidad"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          value={quantityInputValues[product.id] !== undefined ? quantityInputValues[product.id] : currentAddQty}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleQuantityInputChange(product.id, e.target.value)}
                          onBlur={() => handleQuantityInputBlur(product.id, currentAddQty)}
                          className="w-10 h-6 text-center text-xs font-bold text-emerald-300 bg-transparent focus:outline-none font-mono"
                          title={`Cantidad de ${item.unitMode === 'bulk' ? 'bultos' : 'unidades'} a reponer`}
                        />
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(product.id, 1, currentAddQty)}
                          className="w-7 h-6 text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-center font-bold text-xs transition-colors select-none active:bg-white/20 cursor-pointer"
                          title="Aumentar cantidad"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-[8.5px] text-zinc-400 mt-0.5 text-center leading-tight">
                        {item.unitMode === 'bulk'
                          ? `= ${currentAddQty * unitsPerBulk} uds`
                          : `≈ ${(currentAddQty / unitsPerBulk).toFixed(1)} bultos`}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Title & Details */}
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`text-sm font-bold truncate ${
                        isCompleted ? 'line-through text-zinc-400' : 'text-white'
                      }`}
                    >
                      {product.name}
                    </h4>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {bulkUnitName}
                      </span>
                      {alertStatus.isLow && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {product.minStockAlertBulk && Math.floor(product.stock / unitsPerBulk) <= product.minStockAlertBulk
                            ? `Bajo en Bultos (≤ ${product.minStockAlertBulk} cj)`
                            : alertStatus.alertLabel}
                        </span>
                      )}
                    </div>

                    {/* Barcodes snippet */}
                    <div className="space-y-0.5 text-[11px] font-mono text-zinc-300 mt-2">
                      <div className="flex items-center gap-1">
                        <Barcode className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                        <span>Ud: <strong className="text-white">{product.barcodeUnit || product.barcode}</strong></span>
                      </div>
                      {product.barcodeBulk && (
                        <div className="flex items-center gap-1 text-amber-300">
                          <span className="text-xs">📦</span>
                          <span>Bulto: <strong>{product.barcodeBulk}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Location / notes */}
                    {(item.locationNotes || product.notes) && (
                      <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="truncate">{item.locationNotes || product.notes}</span>
                      </div>
                    )}

                    {/* Physical stock stats */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-2 flex-wrap">
                      <span title={`Stock total acumulado: ${product.stock} ${product.unit || 'uds'}`}>
                        Unidades sueltas: <strong className="text-white">{unitsPerBulk > 1 ? product.stock % unitsPerBulk : product.stock} {product.unit || 'uds'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Bultos en depósito: <strong className="text-amber-300">{Math.floor(product.stock / unitsPerBulk)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* INLINE MOVEMENT FUNCTIONS (matches the sketch Screenshot_2026-09-22-07-57-08-365.jpg) */}
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
                  {/* Row 1: [Entrada (Stock +)] [Salida (Venta -)] tabs and Delete Button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => setMovementTypeFor(product.id, 'in')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          currentType === 'in'
                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10'
                        }`}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Entrada (Stock +)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMovementTypeFor(product.id, 'out')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          currentType === 'out'
                            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10'
                        }`}
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>Salida (Venta -)</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(product.id)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
                      title="Quitar de la lista de reposición"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Row 2: Direct Full-Width Action Confirmation Button */}
                  <button
                    type="button"
                    disabled={processingId === product.id}
                    onClick={() => handleConfirmInlineMovement(product, item)}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
                      currentType === 'in'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                        : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/25'
                    }`}
                  >
                    {currentType === 'in' ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 stroke-[3]" />
                    )}
                    <span>
                      {processingId === product.id
                        ? 'Registrando...'
                        : currentType === 'in'
                        ? `Confirmar Entrada (${displayQtyText})`
                        : `Confirmar Salida (${displayQtyText})`}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Catalog Picker Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#12141c]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Añadir a Lista de Reposición</span>
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-white/5 bg-[#0e1017]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar producto o código..."
                  className="w-full bg-[#161922] border border-white/10 rounded-xl pl-9 pr-16 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400"
                  autoFocus
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {catalogSearch && (
                    <button
                      onClick={() => setCatalogSearch('')}
                      className="text-zinc-400 hover:text-white text-xs p-0.5"
                      title="Limpiar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onScanSearch && (
                    <button
                      type="button"
                      id="btn-scan-catalog-replenish"
                      onClick={() => onScanSearch((val) => setCatalogSearch(val))}
                      className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
                      title="Escanear código de barra para buscar producto"
                    >
                      <Barcode className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-2 space-y-1.5 overflow-y-auto flex-1">
              {activeProducts
                .filter((p) => {
                  if (!catalogSearch.trim()) return true;
                  const q = catalogSearch.toLowerCase().trim();
                  return (
                    p.name.toLowerCase().includes(q) ||
                    (p.barcodeUnit || p.barcode || '').toLowerCase().includes(q) ||
                    (p.barcodeBulk && p.barcodeBulk.toLowerCase().includes(q))
                  );
                })
                .map((product) => {
                  const alreadyInList = Boolean(
                    product.isPendingReposition === true ||
                    items.some((item) => item.productId === product.id && item.status === 'pending')
                  );
                  return (
                    <div
                      key={product.id}
                      className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-white p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{product.name}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            Stock: {product.stock} {product.unit || 'uds'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (alreadyInList) {
                            handleRemoveProductFromReposition(product.id);
                          } else {
                            handleAddProductToReposition(product);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                          alreadyInList
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        }`}
                      >
                        {alreadyInList ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            <span>Quitar</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Añadir</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
            </div>

            <div className="p-3 border-t border-white/10 bg-[#12141c] text-right">
              <button
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

