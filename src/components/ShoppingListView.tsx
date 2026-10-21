import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Barcode,
  Package,
  Sparkles,
  Search,
  CheckCircle2,
  FileImage,
  FileText,
  RefreshCw,
  X,
  Share2,
} from 'lucide-react';
import { Product, StoreSettings, ShoppingListItem } from '../types';
import { ShoppingService } from '../services/shoppingService';
import { checkStockAlert } from '../utils/stockAlert';
import { matchProductTokens } from '../utils/searchMatcher';
import { shareBase64Image, shareBase64Pdf } from '../utils/nativeShare';

interface ShoppingListViewProps {
  products: Product[];
  settings: StoreSettings;
  onNavigateToStock: () => void;
  onScanSearch?: (callback: (val: string) => void) => void;
  highlightProductId?: string;
}

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  products,
  settings,
  onScanSearch,
  highlightProductId,
}) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isExportingJpg, setIsExportingJpg] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareType, setShareType] = useState<'jpg' | 'pdf'>('jpg');
  const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
  const [exportedPdfUrl, setExportedPdfUrl] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Load shopping list from persistent storage and keep in sync
  useEffect(() => {
    reloadList();
    const handleUpdate = () => reloadList();
    window.addEventListener('shopping_list_updated', handleUpdate);
    return () => {
      window.removeEventListener('shopping_list_updated', handleUpdate);
    };
  }, []);

  // Scroll to highlighted product when redirected from ProductDetailModal
  useEffect(() => {
    if (highlightProductId) {
      setTimeout(() => {
        const el = document.getElementById(`shopping-item-${highlightProductId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [highlightProductId]);

  // Close floating Add Product modal on Android back button
  useEffect(() => {
    const handleBack = (e: Event) => {
      if (addProductModalOpen) {
        e.preventDefault();
        setAddProductModalOpen(false);
      }
    };
    window.addEventListener('android_back_pressed', handleBack);
    return () => {
      window.removeEventListener('android_back_pressed', handleBack);
    };
  }, [addProductModalOpen]);

  const reloadList = () => {
    const saved = ShoppingService.getShoppingList();
    setItems(saved);
  };

  // Matched products
  const populatedItems = items
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product ? { item, product } : null;
    })
    .filter((x): x is { item: ShoppingListItem; product: Product } => x !== null);

  const filteredItems = populatedItems.filter(({ product }) => {
    if (!searchFilter.trim()) return true;
    return matchProductTokens(product, searchFilter);
  });

  // Auto-populate from low stock items (Unit or Bulk alerts)
  const handleAutoAddLowStock = () => {
    const lowStockProducts = products.filter((p) => checkStockAlert(p).isLow);
    if (lowStockProducts.length === 0) {
      alert('¡Excelente! No hay productos con alertas de stock bajo por unidad o bulto.');
      return;
    }

    let addedCount = 0;
    lowStockProducts.forEach((p) => {
      if (!items.some((item) => item.productId === p.id)) {
        ShoppingService.addToShoppingList(p.id, 'Sugerido por stock mínimo');
        addedCount++;
      }
    });

    reloadList();
    setExportMessage(`Se añadieron ${addedCount} productos con stock mínimo.`);
    setTimeout(() => setExportMessage(null), 3500);
  };

  // Add individual product
  const handleAddProduct = (productId: string) => {
    ShoppingService.addToShoppingList(productId);
    reloadList();
  };

  // Remove individual product
  const handleRemoveProduct = (productId: string) => {
    ShoppingService.removeFromShoppingList(productId);
    reloadList();
  };

  // Clear entire list
  const handleClearList = () => {
    if (confirm('¿Vaciar toda la lista de compras?')) {
      ShoppingService.clearShoppingList();
      reloadList();
    }
  };

  // Update Bulks and Units directly from the interactive card fields
  const handleUpdateItemQuantities = (productId: string, bulksToBuy?: number, unitsToBuy?: number) => {
    let targetQuantity = '';
    const b = bulksToBuy ?? 0;
    const u = unitsToBuy ?? 0;
    if (bulksToBuy !== undefined && unitsToBuy !== undefined) {
      targetQuantity = `${b} bultos + ${u} uds`;
    } else if (bulksToBuy !== undefined) {
      targetQuantity = `${b} bultos`;
    } else if (unitsToBuy !== undefined) {
      targetQuantity = `${u} uds`;
    }

    const updated = ShoppingService.updateShoppingItem(productId, {
      bulksToBuy,
      unitsToBuy,
      targetQuantity: targetQuantity || undefined,
    });
    setItems(updated);
  };

  // Share JPG directly via Capacitor Native Share plugin (@capacitor/share)
  const handleShareExportedImage = async (customUrl?: string) => {
    const imageUrl = customUrl || exportedImageUrl;
    if (!imageUrl) return;

    setIsSharing(true);
    setShareType('jpg');
    try {
      const fileName = 'lista_compras.jpg';
      await shareBase64Image(imageUrl, {
        fileName,
        title: `Lista de Compras - ${settings.storeName || 'depos'}`,
        dialogTitle: 'Compartir Lista JPG por WhatsApp, Gmail o Guardar',
      });
      setExportMessage('Menú nativo de compartir activado');
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err) {
      console.error('Error al compartir JPG:', err);
      alert('No se pudo abrir el menú nativo de compartir.');
    } finally {
      setIsSharing(false);
    }
  };

  // Share PDF directly via Capacitor Native Share plugin (@capacitor/share)
  const handleShareExportedPdf = async (customUrl?: string) => {
    const pdfUrl = customUrl || exportedPdfUrl;
    if (!pdfUrl) return;

    setIsSharing(true);
    setShareType('pdf');
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const fileName = `lista_compras_${todayStr}.pdf`;
      await shareBase64Pdf(pdfUrl, {
        fileName,
        title: `Lista de Compras PDF - ${settings.storeName || 'depos'}`,
        dialogTitle: 'Compartir Lista PDF por WhatsApp, Gmail o Guardar',
      });
      setExportMessage('Menú nativo de compartir activado para PDF');
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err) {
      console.error('Error al compartir PDF:', err);
      alert('No se pudo abrir el menú nativo de compartir.');
    } finally {
      setIsSharing(false);
    }
  };

  // Export to JPG with product images, dual barcodes and handwriting/printed boxes, then trigger native Share
  const handleExportJPG = async () => {
    if (populatedItems.length === 0) {
      alert('Agrega al menos un producto a la lista de compras antes de exportar.');
      return;
    }

    setIsExportingJpg(true);
    setShareType('jpg');
    setExportMessage('Generando imagen JPG de alta resolución...');
    try {
      const jpgUrl = await ShoppingService.exportShoppingListToJPG(
        products,
        items,
        settings.storeName
      );
      setExportedImageUrl(jpgUrl);
      setExportMessage('¡Lista de compras JPG generada con éxito!');
      
      // Automatically prompt native Android share menu
      await handleShareExportedImage(jpgUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar a formato JPG');
      setExportMessage(null);
    } finally {
      setIsExportingJpg(false);
    }
  };

  // Export to multi-page Vectorial A4 PDF, then trigger native Share
  const handleExportPDF = async () => {
    if (populatedItems.length === 0) {
      alert('Agrega al menos un producto a la lista de compras antes de exportar.');
      return;
    }

    setIsExportingPdf(true);
    setShareType('pdf');
    setExportMessage('Generando documento PDF vectorial A4 hiper nítido...');
    try {
      const pdfUrl = await ShoppingService.exportShoppingListToPDF(
        products,
        items,
        settings.storeName
      );
      setExportedPdfUrl(pdfUrl);
      setExportMessage('¡Documento PDF vectorial A4 generado con éxito!');
      
      // Automatically prompt native Android share menu
      await handleShareExportedPdf(pdfUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar a formato PDF');
      setExportMessage(null);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div id="shopping-list-view" className="p-4 space-y-4 pb-24 max-w-3xl mx-auto">
      {/* Top Banner with Dual Export Selector */}
      <div className="bg-gradient-to-br from-[#131b2e] via-[#161c28] to-[#12141c] border border-sky-500/30 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold flex-shrink-0">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Lista de Compras de Mercadería</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {populatedItems.length} artículos
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Exporta y comparte en formato JPG o PDF vectorial A4 con fotos, códigos y cantidades
              </p>
            </div>
          </div>

          {/* Selector de Exportación Doble (JPG o PDF Nativo) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón 1: Compartir Lista JPG */}
            <button
              id="export-shopping-jpg-btn"
              onClick={handleExportJPG}
              disabled={isExportingJpg || isExportingPdf || isSharing || populatedItems.length === 0}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-95"
              title="Para listas cortas con renderizado de imagen rápida"
            >
              {isExportingJpg ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generando JPG...</span>
                </>
              ) : isSharing && shareType === 'jpg' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Abriendo...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Compartir Lista JPG</span>
                </>
              )}
            </button>

            {/* Botón 2: Compartir Lista PDF (A4 Vectorial Hiper Nítido) */}
            <button
              id="export-shopping-pdf-btn"
              onClick={handleExportPDF}
              disabled={isExportingJpg || isExportingPdf || isSharing || populatedItems.length === 0}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all active:scale-95"
              title="Documento PDF vectorial de múltiples páginas (A4) hiper nítido sin pixelarse para WhatsApp o impresión"
            >
              {isExportingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : isSharing && shareType === 'pdf' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Abriendo...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Compartir Lista PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {exportMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-sky-400" />
            <span>{exportMessage}</span>
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161922] p-2.5 rounded-xl border border-white/5">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar en la lista de compras..."
              className="w-full bg-[#0d0f15] border border-white/10 rounded-xl pl-9 pr-16 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
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
                  id="btn-scan-shopping-search"
                  onClick={() => onScanSearch((val) => setSearchFilter(val))}
                  className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
                  title="Escanear código de barra para buscar"
                >
                  <Barcode className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="auto-add-low-stock-btn"
            onClick={handleAutoAddLowStock}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 transition-colors"
            title="Cargar automáticamente todos los productos con alertas de stock bajo"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cargar Stock Bajo</span>
          </button>

          <button
            id="open-add-product-btn"
            onClick={() => setAddProductModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1.5 border border-teal-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Producto</span>
          </button>

          {populatedItems.length > 0 && (
            <button
              onClick={handleClearList}
              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors"
              title="Vaciar lista"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Shopping List Items */}
      {populatedItems.length === 0 ? (
        <div className="bg-[#161922] border border-white/10 rounded-2xl p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-white">Tu lista de compras está vacía</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Agrega productos manualmente o carga con un toque todos los artículos que estén en nivel mínimo para abastecer tu negocio.
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
              onClick={() => setAddProductModalOpen(true)}
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

            const isHighlighted = highlightProductId === product.id;
            return (
              <div
                key={item.id}
                id={`shopping-item-${product.id}`}
                className={`bg-[#161922] border rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md transition-all ${
                  isHighlighted
                    ? 'border-sky-400 ring-2 ring-sky-400/50 bg-sky-950/20 shadow-sky-500/20'
                    : 'border-white/10 hover:border-sky-500/30'
                }`}
              >
                {/* Left: Image / Icon & Product Details */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Photo / Icon stored in APK DB */}
                  <div className="w-16 h-16 rounded-xl bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10 shadow">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                        {product.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate">{product.name}</h4>
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-teal-500/15 text-teal-300 border border-teal-500/30 shrink-0">
                        {product.category?.trim().toUpperCase().replace(/\s+/g, '-') || 'PASILLO-1'}
                      </span>
                      {alertStatus.isLow && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {alertStatus.alertLabel}
                        </span>
                      )}
                      {isHighlighted && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-sky-500 text-black animate-pulse">
                          EDITAR CANTIDAD
                        </span>
                      )}
                    </div>

                    {/* Dual Barcodes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-mono text-zinc-300 mt-1.5">
                      <div className="flex items-center gap-1.5 bg-[#0e1017] px-2 py-1 rounded-lg border border-white/5">
                        <Barcode className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                        <span className="text-zinc-500">Ud:</span>
                        <span className="text-teal-300 font-semibold">{product.barcodeUnit || product.barcode}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0e1017] px-2 py-1 rounded-lg border border-white/5">
                        <Package className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="text-zinc-500">Bulto:</span>
                        <span className="text-amber-300 font-semibold">
                          {product.barcodeBulk || '---'}
                        </span>
                      </div>
                    </div>

                    {/* Current stock status */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1.5 flex-wrap">
                      <span>
                        Stock en tienda: <strong className="text-white">{product.stock} {product.unit || 'uds'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Bultos: <strong className="text-amber-300">{Math.floor(product.stock / unitsPerBulk)}</strong>
                      </span>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {bulkUnitName} ({unitsPerBulk} uds/cj)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: RECUADRO EDITABLE DE COMPRA DIRECTA (BULTOS Y UNIDADES) */}
                <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-white/10 pt-2 md:pt-0 md:pl-4 flex-shrink-0">
                  <div className="bg-[#0b0e14] border-2 border-dashed border-sky-400/50 rounded-xl p-2.5 text-center min-w-[210px] shadow-inner">
                    <p className="text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">
                      Cantidad a Comprar / Anotar
                    </p>
                    <div className="flex items-center justify-center gap-2.5 my-1">
                      {/* BULTOS Input */}
                      <div className="flex flex-col items-center">
                        <input
                          id={`input-bulks-${product.id}`}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={item.bulksToBuy !== undefined && item.bulksToBuy !== null ? item.bulksToBuy : ''}
                          onChange={(e) => {
                            const valStr = e.target.value.trim();
                            const newBulks = valStr === '' ? undefined : Math.max(0, parseInt(valStr, 10) || 0);
                            handleUpdateItemQuantities(product.id, newBulks, item.unitsToBuy);
                          }}
                          placeholder=""
                          autoFocus={isHighlighted}
                          className="h-9 w-20 border-2 rounded-lg text-center font-mono font-bold text-sm text-sky-300 bg-[#0e121d] border-sky-500/60 focus:border-sky-400 focus:bg-[#121826] focus:outline-none transition-colors shadow-inner"
                        />
                        <span className="text-[8.5px] font-bold text-zinc-300 mt-1 uppercase tracking-wide">BULTOS</span>
                      </div>

                      {/* UNIDADES Input */}
                      <div className="flex flex-col items-center">
                        <input
                          id={`input-units-${product.id}`}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={item.unitsToBuy !== undefined && item.unitsToBuy !== null ? item.unitsToBuy : ''}
                          onChange={(e) => {
                            const valStr = e.target.value.trim();
                            const newUnits = valStr === '' ? undefined : Math.max(0, parseInt(valStr, 10) || 0);
                            handleUpdateItemQuantities(product.id, item.bulksToBuy, newUnits);
                          }}
                          placeholder=""
                          className="h-9 w-20 border-2 rounded-lg text-center font-mono font-bold text-sm text-sky-300 bg-[#0e121d] border-sky-500/60 focus:border-sky-400 focus:bg-[#121826] focus:outline-none transition-colors shadow-inner"
                        />
                        <span className="text-[8.5px] font-bold text-zinc-300 mt-1 uppercase tracking-wide">UNIDADES</span>
                      </div>
                    </div>
                    {item.bulksToBuy !== undefined || item.unitsToBuy !== undefined ? (
                      <span className="text-[8px] text-emerald-400 font-semibold block mt-1">
                        ✔ Cantidades fijas para imprimir
                      </span>
                    ) : (
                      <span className="text-[8px] text-zinc-500 block mt-1">
                        (Casillero en blanco para anotar a mano)
                      </span>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveProduct(product.id)}
                    className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Quitar de la lista de compras"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Catalog Picker Modal */}
      {addProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#12141c]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-400" />
                <span>Agregar Producto a la Lista de Compras</span>
              </h3>
              <button
                onClick={() => setAddProductModalOpen(false)}
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
                  placeholder="Buscar por nombre o código de barra..."
                  className="w-full bg-[#161922] border border-white/10 rounded-xl pl-9 pr-16 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-teal-400"
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
                      id="btn-scan-catalog-shopping"
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
              {products
                .filter((p) => {
                  if (!catalogSearch.trim()) return true;
                  return matchProductTokens(p, catalogSearch);
                })
                .map((product) => {
                  const alreadyInList = items.some((item) => item.productId === product.id);
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
                            Stock: {product.stock} {product.unit || 'uds'} • {product.bulkUnitName || `Caja x${product.unitsPerBulk || 12}`}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (alreadyInList) {
                            handleRemoveProduct(product.id);
                          } else {
                            handleAddProduct(product.id);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                          alreadyInList
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            : 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30'
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
                onClick={() => setAddProductModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exported Image Preview Modal */}
      {exportedImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-[#12141c]">
              <div className="flex items-center gap-2">
                <FileImage className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Vista Previa de la Lista JPG Generada</h3>
                  <p className="text-[11px] text-zinc-400">Envía la imagen directamente por WhatsApp, Gmail o guárdala en tu teléfono</p>
                </div>
              </div>
              <button
                onClick={() => setExportedImageUrl(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-zinc-900 flex justify-center">
              <img
                src={exportedImageUrl}
                alt="Lista de Compras JPG"
                className="w-full h-auto object-contain rounded-lg shadow-2xl border border-white/10"
              />
            </div>

            <div className="p-3 border-t border-white/10 bg-[#12141c] flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-400 hidden sm:inline">
                Formato JPG con fotos, códigos y recuadros
              </span>
              <button
                type="button"
                id="btn-share-shopping-jpg-modal"
                onClick={() => handleShareExportedImage(exportedImageUrl)}
                disabled={isSharing}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/25 active:scale-95 transition-all ml-auto"
              >
                {isSharing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Compartiendo...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Compartir Lista JPG</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exported PDF Preview Modal */}
      {exportedPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#161922] border border-rose-500/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-[#12141c]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-500" />
                <div>
                  <h3 className="text-sm font-bold text-white">Documento PDF Vectorial Generado (A4)</h3>
                  <p className="text-[11px] text-zinc-400">Hiper nítido, sin pixelarse, listo para WhatsApp, impresión o compartir</p>
                </div>
              </div>
              <button
                onClick={() => setExportedPdfUrl(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-zinc-900 flex flex-col items-center justify-center text-center space-y-3 min-h-[180px]">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Lista de Compras en Formato PDF (A4)</h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  El documento vectorial contiene {populatedItems.length} artículos con fotos, códigos de barra y recuadros de compra nítidos sin pixelación.
                </p>
              </div>
            </div>

            <div className="p-3.5 border-t border-white/10 bg-[#12141c]">
              <button
                type="button"
                id="btn-share-shopping-pdf-modal"
                onClick={() => handleShareExportedPdf(exportedPdfUrl)}
                disabled={isSharing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
              >
                {isSharing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Abriendo menú nativo...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Compartir Lista PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
