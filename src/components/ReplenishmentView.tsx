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
import { matchProductTokens } from '../utils/searchMatcher';

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
  highlightProductId?: string;
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
  highlightProductId,
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
  // Local string state for Bultos and Unidades inputs to allow clearing completely and typing smoothly
  const [bulksInputValues, setBulksInputValues] = useState<Record<string, string>>({});
  const [unitsInputValues, setUnitsInputValues] = useState<Record<string, string>>({});

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

  // Scroll to highlighted product if redirected from ProductDetailModal
  useEffect(() => {
    if (highlightProductId) {
      setTimeout(() => {
        const el = document.getElementById(`replenish-card-${highlightProductId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [highlightProductId]);

  useEffect(() => {
    const handleRepositionEvent = () => {
      reloadList();
    };
    window.addEventListener('reposition_updated', handleRepositionEvent);
    return () => {
      window.removeEventListener('reposition_updated', handleRepositionEvent);
    };
  }, []);

  // Close floating Add Product modal on Android back button
  useEffect(() => {
    const handleBack = (e: Event) => {
      if (addModalOpen) {
        e.preventDefault();
        setAddModalOpen(false);
      }
    };
    window.addEventListener('android_back_pressed', handleBack);
    return () => {
      window.removeEventListener('android_back_pressed', handleBack);
    };
  }, [addModalOpen]);

  // Requirement 2: Add product to replenishment directly persisting isPendingReposition = true in local DB
  const handleAddProductToReposition = (product: Product) => {
    const suggested = computeSuggestedGondola(product);
    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
    const suggestedBulks = unitsPerBulk > 1 ? Math.floor(suggested / unitsPerBulk) : 0;
    const suggestedUnits = unitsPerBulk > 1 ? suggested % unitsPerBulk : suggested;

    const updated = StorageService.toggleProductReposition(
      product.id,
      true,
      product.notes || 'Reponer en góndola',
      suggested,
      suggestedBulks,
      suggestedUnits
    );

    setActiveProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      const updatedProduct: Product = {
        ...product,
        isPendingReposition: true,
        repositionBulks: suggestedBulks,
        repositionUnits: suggestedUnits,
        repositionQuantity: suggested,
      };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedProduct;
        return copy;
      }
      return [updatedProduct, ...prev];
    });

    if (updated) {
      if (onUpdateProduct) onUpdateProduct(updated);
      if (onRefreshData) onRefreshData();
    }
    reloadList();
    Sound.playSuccessChime();
    setToastMessage(`✓ ${product.name} añadido a Reposición (${suggestedBulks} bultos y ${suggestedUnits} unidades)`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Requirement 2: Direct barcode scanner integration for Reposition tab
  const handleScanForReplenish = () => {
    if (!onScanSearch) return;
    onScanSearch((scannedValue) => {
      const trimmed = (scannedValue || '').trim();
      if (!trimmed) return;

      const allCurrent = StorageService.getProducts();
      const matched =
        StorageService.getProductByBarcode(trimmed) ||
        allCurrent.find(
          (p) =>
            (p.barcodeUnit && p.barcodeUnit.trim() === trimmed) ||
            (p.barcode && p.barcode.trim() === trimmed) ||
            (p.barcodeBulk && p.barcodeBulk.trim() === trimmed)
        );

      if (matched) {
        // Automatically add to replenishment list!
        handleAddProductToReposition(matched);
        // Clear search filter so the newly added product is never filtered out by its barcode!
        setSearchFilter('');
        setStatusFilter('all');
      } else {
        Sound.playWarningBeep();
        setToastMessage(`Código [${trimmed}] no coincide con ningún producto.`);
        setSearchFilter(trimmed);
        setTimeout(() => setToastMessage(null), 4000);
      }
    });
  };

  // Barcode scanner inside the + Añadir Producto modal
  const handleScanInAddModal = () => {
    if (!onScanSearch) return;
    onScanSearch((scannedValue) => {
      const trimmed = (scannedValue || '').trim();
      if (!trimmed) return;

      const allCurrent = StorageService.getProducts();
      const matched =
        StorageService.getProductByBarcode(trimmed) ||
        allCurrent.find(
          (p) =>
            (p.barcodeUnit && p.barcodeUnit.trim() === trimmed) ||
            (p.barcode && p.barcode.trim() === trimmed) ||
            (p.barcodeBulk && p.barcodeBulk.trim() === trimmed)
        );

      if (matched) {
        handleAddProductToReposition(matched);
        setCatalogSearch('');
      } else {
        setCatalogSearch(trimmed);
      }
    });
  };

  // Requirement 1 & 3: Remove product from replenishment persisting isPendingReposition = false
  const handleRemoveProductFromReposition = (productId: string) => {
    const updated = StorageService.toggleProductReposition(productId, false);
    ShoppingService.removeFromReplenishmentList(productId);
    setActiveProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isPendingReposition: false } : p))
    );
    if (updated) {
      if (onUpdateProduct) onUpdateProduct(updated);
      if (onRefreshData) onRefreshData();
    }
    reloadList();
  };

  const getMovementType = (productId: string): 'in' | 'out' => {
    return movementTypes[productId] || 'out';
  };

  const setMovementTypeFor = (productId: string, type: 'in' | 'out') => {
    setMovementTypes((prev) => ({ ...prev, [productId]: type }));
  };

  // Calculates a smart suggested restock quantity for shelf/gondola
  const computeSuggestedGondola = (product: Product): number => {
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

  // REQUIREMENT 1, 2, 3: Helper to read separate counters for Bultos and Unidades Sueltas
  const getProductBreakdown = (product: Product, item?: ReplenishmentItem) => {
    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
    let bulks = 0;
    let units = 0;

    if (product.repositionBulks !== undefined || product.repositionUnits !== undefined) {
      bulks = Math.max(0, product.repositionBulks ?? 0);
      units = Math.max(0, product.repositionUnits ?? 0);
    } else if (item?.bulksPending !== undefined || item?.unitsPending !== undefined) {
      bulks = Math.max(0, item?.bulksPending ?? 0);
      units = Math.max(0, item?.unitsPending ?? 0);
    } else {
      const legacy = product.repositionQuantity || item?.quantityToAdd || item?.suggestedUnits || 0;
      if (legacy > 0) {
        if (item?.unitMode === 'bulk') {
          bulks = legacy;
        } else {
          units = legacy;
        }
      }
    }

    const totalUnits = (bulks * unitsPerBulk) + units;
    return { bulks, units, totalUnits, unitsPerBulk };
  };

  // Increments or decrements ONLY Bultos Pendientes
  const handleStepBulks = (productId: string, delta: number) => {
    const product = activeProducts.find((p) => p.id === productId);
    const item = allReplenishMap.get(productId)?.item;
    if (!product) return;

    const { bulks, units } = getProductBreakdown(product, item);
    const nextBulks = Math.max(0, bulks + delta);
    StorageService.updateProductRepositionBreakdown(productId, nextBulks, units);
    reloadList();
    if (onRefreshData) onRefreshData();
  };

  // Increments or decrements ONLY Unidades Sueltas Pendientes
  const handleStepUnits = (productId: string, delta: number) => {
    const product = activeProducts.find((p) => p.id === productId);
    const item = allReplenishMap.get(productId)?.item;
    if (!product) return;

    const { bulks, units } = getProductBreakdown(product, item);
    const nextUnits = Math.max(0, units + delta);
    StorageService.updateProductRepositionBreakdown(productId, bulks, nextUnits);
    reloadList();
    if (onRefreshData) onRefreshData();
  };

  const handleBulksInputChange = (productId: string, val: string) => {
    setBulksInputValues((prev) => ({ ...prev, [productId]: val }));
  };

  const handleBulksInputBlur = (productId: string, currentBulks: number, currentUnits: number) => {
    const raw = bulksInputValues[productId];
    if (raw === undefined) return;
    const parsed = parseInt(raw, 10);
    const nextBulks = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    StorageService.updateProductRepositionBreakdown(productId, nextBulks, currentUnits);
    setBulksInputValues((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
    reloadList();
    if (onRefreshData) onRefreshData();
  };

  const handleUnitsInputChange = (productId: string, val: string) => {
    setUnitsInputValues((prev) => ({ ...prev, [productId]: val }));
  };

  const handleUnitsInputBlur = (productId: string, currentBulks: number, currentUnits: number) => {
    const raw = unitsInputValues[productId];
    if (raw === undefined) return;
    const parsed = parseInt(raw, 10);
    const nextUnits = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    StorageService.updateProductRepositionBreakdown(productId, currentBulks, nextUnits);
    setUnitsInputValues((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
    reloadList();
    if (onRefreshData) onRefreshData();
  };

  // Confirmation handler for inline functions directly underneath each product
  const handleConfirmInlineMovement = (product: Product, item: ReplenishmentItem) => {
    const currentType = getMovementType(product.id);
    const { bulks, units, totalUnits, unitsPerBulk } = getProductBreakdown(product, item);

    if (totalUnits <= 0) {
      alert('La cantidad a registrar debe ser al menos de 1 unidad física.');
      return;
    }

    // Optional guard for stock depletion on salida
    if (currentType === 'out' && product.stock < totalUnits) {
      if (
        !confirm(
          `El stock actual (${product.stock}) es menor a la salida solicitada (${totalUnits}). ¿Deseas continuar?`
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
        quantity: totalUnits,
        reason: (currentType === 'in' ? 'restock' : 'sale') as MovementReason,
        notes: currentType === 'in'
          ? `Reposición: ${bulks} bultos y ${units} unidades`
          : `Salida góndola: ${bulks} bultos y ${units} unidades`,
        unitType: (bulks > 0 && units === 0 ? 'bulk' : 'unit') as 'bulk' | 'unit',
        bulkQuantity: bulks > 0 ? bulks : undefined,
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

      // Automatically reset counters and mark as completed
      StorageService.updateProductRepositionBreakdown(product.id, 0, 0);
      StorageService.toggleProductReposition(product.id, false);
      ShoppingService.setReplenishmentStatus(product.id, 'completed');

      reloadList();
      if (onRefreshData) onRefreshData();

      setToastMessage(
        `✓ ¡${currentType === 'in' ? 'Entrada' : 'Salida'} de ${bulks} bultos y ${units} unidades (= ${totalUnits} uds) confirmada!`
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
      const repItem: ReplenishmentItem = existingItem
        ? {
            ...existingItem,
            status: 'pending',
            bulksPending: p.repositionBulks ?? existingItem.bulksPending ?? 0,
            unitsPending: p.repositionUnits ?? existingItem.unitsPending ?? 0,
            suggestedUnits: p.repositionQuantity || existingItem.suggestedUnits,
            quantityToAdd: p.repositionQuantity || existingItem.quantityToAdd || existingItem.suggestedUnits,
            locationNotes: p.repositionNotes || existingItem.locationNotes || 'Reponer en góndola',
          }
        : {
            id: `rep-${p.id}`,
            productId: p.id,
            status: 'pending',
            locationNotes: p.repositionNotes || p.notes || 'Reponer en góndola',
            bulksPending: p.repositionBulks ?? 0,
            unitsPending: p.repositionUnits ?? 0,
            suggestedUnits: p.repositionQuantity,
            quantityToAdd: p.repositionQuantity,
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
    return matchProductTokens(product, searchFilter);
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
        const unitsPerBulk = Math.max(1, p.unitsPerBulk || 12);
        const suggestedBulks = unitsPerBulk > 1 ? Math.floor(suggested / unitsPerBulk) : 0;
        const suggestedUnits = unitsPerBulk > 1 ? suggested % unitsPerBulk : suggested;

        const updated = StorageService.toggleProductReposition(
          p.id,
          true,
          p.notes || 'Reponer en góndola',
          suggested,
          suggestedBulks,
          suggestedUnits
        );
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
                onClick={handleScanForReplenish}
                className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
                title="Escanear código de barra para añadir o localizar producto en reposición"
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
            const { bulks, units, totalUnits, unitsPerBulk } = getProductBreakdown(product, item);
            const bulkUnitName = product.bulkUnitName || `Caja x${unitsPerBulk}`;
            const alertStatus = checkStockAlert(product);
            const isCompleted = item.status === 'completed';
            const suggestedGondola = computeSuggestedGondola(product);
            const currentType = getMovementType(product.id);
            const isHighlighted = highlightProductId === product.id;

            return (
              <div
                key={item.id}
                id={`replenish-card-${product.id}`}
                className={`bg-[#161922] border rounded-2xl p-3 sm:p-4 transition-all shadow-lg ${
                  isHighlighted
                    ? 'border-emerald-400 ring-2 ring-emerald-400/70 bg-[#102419]/90 shadow-emerald-500/30'
                    : isCompleted
                    ? 'border-emerald-500/40 bg-[#121815]/90'
                    : 'border-white/10 hover:border-emerald-500/30'
                }`}
              >
                {/* Upper Area: Status Checkbox + Photo + Product Info */}
                <div className="flex items-start gap-3">
                  {/* Status Checkbox Button */}
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

                  {/* Photo / Icon */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-white/10 shadow flex-shrink-0">
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

                  {/* Right Column: Title & Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4
                        className={`text-sm font-bold truncate ${
                          isCompleted ? 'line-through text-zinc-400' : 'text-white'
                        }`}
                      >
                        {product.name}
                      </h4>
                      {suggestedGondola > 0 && (
                        <span className="text-[9.5px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex-shrink-0">
                          Sugerido: {suggestedGondola} uds
                        </span>
                      )}
                    </div>

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
                    <div className="space-y-0.5 text-[11px] font-mono text-zinc-300 mt-1.5">
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
                      <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="truncate">{item.locationNotes || product.notes}</span>
                      </div>
                    )}

                    {/* Physical stock stats */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1.5 flex-wrap">
                      <span>
                        En depósito: <strong className="text-amber-300">{Math.floor(product.stock / unitsPerBulk)} cj</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Sueltas: <strong className="text-white">{unitsPerBulk > 1 ? product.stock % unitsPerBulk : product.stock} {product.unit || 'uds'}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-zinc-500">
                        Total: {product.stock} {product.unit || 'uds'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* REQUIREMENT 1, 2, 3: SEPARATE INDEPENDENT COUNTERS & INFORMATIVE TOTALIZATION */}
                <div className="mt-3 p-3 rounded-2xl bg-[#0e1118] border border-white/10 space-y-2.5">
                  {/* Two separate side-by-side independent counter boxes */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* CASILLERO 1: BULTOS PENDIENTES (Naranja) */}
                    <div className="bg-[#1c1810] border border-amber-500/40 rounded-xl p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-extrabold text-amber-300 flex items-center gap-1.5">
                          <span>📦</span>
                          <span>Bultos Pendientes</span>
                        </span>
                        <span className="text-[9.5px] font-mono text-amber-400/80 bg-amber-500/10 px-1 rounded">
                          x{unitsPerBulk}u
                        </span>
                      </div>
                      {/* Stepper for Bultos */}
                      <div className="flex items-center justify-between bg-black/60 border border-amber-500/40 rounded-xl overflow-hidden shadow-inner">
                        <button
                          type="button"
                          onClick={() => handleStepBulks(product.id, -1)}
                          className="w-9 h-8 text-amber-200 hover:text-white hover:bg-amber-500/25 flex items-center justify-center font-black text-base transition-colors cursor-pointer select-none active:bg-amber-500/40"
                          title="Restar 1 bulto pendiente"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={bulksInputValues[product.id] !== undefined ? bulksInputValues[product.id] : bulks}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleBulksInputChange(product.id, e.target.value)}
                          onBlur={() => handleBulksInputBlur(product.id, bulks, units)}
                          className="w-12 h-8 text-center text-sm font-black text-amber-300 bg-transparent focus:outline-none font-mono"
                          title="Cantidad de bultos a reponer"
                        />
                        <button
                          type="button"
                          onClick={() => handleStepBulks(product.id, 1)}
                          className="w-9 h-8 text-amber-200 hover:text-white hover:bg-amber-500/25 flex items-center justify-center font-black text-base transition-colors cursor-pointer select-none active:bg-amber-500/40"
                          title="Sumar 1 bulto pendiente"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[9.5px] text-amber-300/80 font-mono mt-1 text-center truncate font-semibold">
                        = {bulks * unitsPerBulk} uds en {bulks} {bulks === 1 ? 'bulto' : 'bultos'}
                      </span>
                    </div>

                    {/* CASILLERO 2: UNIDADES SUELTAS PENDIENTES (Verde Agua / Esmeralda) */}
                    <div className="bg-[#0f1f1a] border border-teal-500/40 rounded-xl p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-extrabold text-teal-300 flex items-center gap-1.5">
                          <span>🧴</span>
                          <span>Unidades Sueltas</span>
                        </span>
                        <span className="text-[9.5px] font-mono text-teal-400/80 bg-teal-500/10 px-1 rounded">
                          de a 1u
                        </span>
                      </div>
                      {/* Stepper for Unidades */}
                      <div className="flex items-center justify-between bg-black/60 border border-teal-500/40 rounded-xl overflow-hidden shadow-inner">
                        <button
                          type="button"
                          onClick={() => handleStepUnits(product.id, -1)}
                          className="w-9 h-8 text-teal-200 hover:text-white hover:bg-teal-500/25 flex items-center justify-center font-black text-base transition-colors cursor-pointer select-none active:bg-teal-500/40"
                          title="Restar 1 unidad suelta pendiente"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={unitsInputValues[product.id] !== undefined ? unitsInputValues[product.id] : units}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUnitsInputChange(product.id, e.target.value)}
                          onBlur={() => handleUnitsInputBlur(product.id, bulks, units)}
                          className="w-12 h-8 text-center text-sm font-black text-teal-300 bg-transparent focus:outline-none font-mono"
                          title="Cantidad de unidades sueltas a reponer"
                        />
                        <button
                          type="button"
                          onClick={() => handleStepUnits(product.id, 1)}
                          className="w-9 h-8 text-teal-200 hover:text-white hover:bg-teal-500/25 flex items-center justify-center font-black text-base transition-colors cursor-pointer select-none active:bg-teal-500/40"
                          title="Sumar 1 unidad suelta pendiente"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[9.5px] text-teal-300/80 font-mono mt-1 text-center truncate font-semibold">
                        = {units} {units === 1 ? 'unidad suelta' : 'unidades sueltas'}
                      </span>
                    </div>
                  </div>

                  {/* REQUERIMIENTO 3: TOTALIZACIÓN INFORMATIVA CLARA Y DESTACADA */}
                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-[#17202a] via-[#151c24] to-[#121922] border border-blue-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-inner">
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 flex-wrap">
                        <span className="text-amber-400 font-black">📌 Pendiente:</span>
                        <span className="text-amber-300 font-black">{bulks} {bulks === 1 ? 'Bulto' : 'Bultos'}</span>
                        <span className="text-zinc-400 font-normal">y</span>
                        <span className="text-teal-300 font-black">{units} {units === 1 ? 'Unidad' : 'Unidades'}</span>
                      </div>
                      <p className="text-[11.5px] font-mono text-emerald-400 font-bold mt-0.5">
                        = {totalUnits} unidades totales <span className="text-zinc-400 font-normal font-sans">({bulks} cj × {unitsPerBulk} + {units} uds)</span>
                      </p>
                    </div>

                    {totalUnits > 0 && (
                      <div className="flex-shrink-0 self-end sm:self-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono shadow-sm">
                          Neto: {totalUnits} uds
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* INLINE MOVEMENT FUNCTIONS */}
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
                  {/* Row 1: [Entrada (Stock +)] [Salida (Venta -)] tabs and Delete Button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => setMovementTypeFor(product.id, 'in')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          currentType === 'out'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 font-bold border border-rose-400'
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
                      className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                      title="Quitar de la lista de reposición"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Row 2: Direct Full-Width Action Confirmation Button */}
                  <button
                    type="button"
                    disabled={processingId === product.id || totalUnits <= 0}
                    onClick={() => handleConfirmInlineMovement(product, item)}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
                      currentType === 'in'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                        : 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg shadow-rose-600/30 border border-rose-400'
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
                        ? `Confirmar Entrada (${bulks} Bultos + ${units} Uds = ${totalUnits} uds)`
                        : `Confirmar Salida (${bulks} Bultos + ${units} Uds = ${totalUnits} uds)`}
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
                      onClick={handleScanInAddModal}
                      className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
                      title="Escanear código de barra para añadir producto directamente"
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
                  return matchProductTokens(p, catalogSearch);
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

