import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Download,
  Plus,
  Trash2,
  Barcode,
  Package,
  Layers,
  Sparkles,
  AlertTriangle,
  Search,
  CheckCircle2,
  FileImage,
  RefreshCw,
  X,
  Eye,
} from 'lucide-react';
import { Product, StoreSettings, ShoppingListItem } from '../types';
import { ShoppingService } from '../services/shoppingService';
import { checkStockAlert } from '../utils/stockAlert';

interface ShoppingListViewProps {
  products: Product[];
  settings: StoreSettings;
  onNavigateToStock: () => void;
  onScanSearch?: (callback: (val: string) => void) => void;
}

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  products,
  settings,
  onNavigateToStock,
  onScanSearch,
}) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Load shopping list from persistent storage
  useEffect(() => {
    reloadList();
  }, []);

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
    const q = searchFilter.toLowerCase();
    return (
      product.name.toLowerCase().includes(q) ||
      (product.barcodeUnit || product.barcode).includes(q) ||
      (product.barcodeBulk && product.barcodeBulk.includes(q))
    );
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

  // Export to JPG with product images, dual barcodes and empty handwriting boxes
  const handleExportJPG = async () => {
    if (populatedItems.length === 0) {
      alert('Agrega al menos un producto a la lista de compras antes de exportar.');
      return;
    }

    setIsExporting(true);
    setExportMessage('Generando imagen JPG de alta resolución...');
    try {
      const jpgUrl = await ShoppingService.exportShoppingListToJPG(
        products,
        items,
        settings.storeName
      );
      setExportedImageUrl(jpgUrl);
      setExportMessage('¡Lista de compras descargada con éxito en formato JPG!');
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar a formato JPG');
      setExportMessage(null);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div id="shopping-list-view" className="p-4 space-y-4 pb-24 max-w-3xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#131b2e] via-[#161c28] to-[#12141c] border border-sky-500/30 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
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
                Exporta en imagen JPG con fotos, códigos y recuadro vacío para anotar a mano
              </p>
            </div>
          </div>

          {/* Export JPG Button */}
          <button
            id="export-shopping-jpg-btn"
            onClick={handleExportJPG}
            disabled={isExporting || populatedItems.length === 0}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-95"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generando JPG...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Descargar en Formato JPG</span>
              </>
            )}
          </button>
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

            return (
              <div
                key={item.id}
                className="bg-[#161922] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md hover:border-sky-500/30 transition-all"
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
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {bulkUnitName} ({unitsPerBulk} uds/cj)
                      </span>
                      {alertStatus.isLow && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {alertStatus.alertLabel}
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
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1.5">
                      <span>
                        Stock en tienda: <strong className="text-white">{product.stock} {product.unit || 'uds'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Bultos: <strong className="text-amber-300">{Math.floor(product.stock / unitsPerBulk)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: RECUADRO VACÍO PARA ANOTAR MANUALMENTE LAS CANTIDADES A COMPRAR */}
                <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-white/10 pt-2 md:pt-0 md:pl-4 flex-shrink-0">
                  <div className="bg-[#0b0e14] border-2 border-dashed border-sky-400/50 rounded-xl p-2.5 text-center min-w-[200px] shadow-inner">
                    <p className="text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1.5">
                      Recuadro para anotar a mano
                    </p>
                    <div className="flex items-center justify-center gap-2.5 my-1">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-18 border-2 border-dashed border-white/30 bg-white/5 rounded-lg flex items-center justify-center">
                          <span className="text-[10px] text-zinc-600 font-mono italic">vacío</span>
                        </div>
                        <span className="text-[8.5px] font-bold text-zinc-300 mt-1 uppercase tracking-wide">BULTOS</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-18 border-2 border-dashed border-white/30 bg-white/5 rounded-lg flex items-center justify-center">
                          <span className="text-[10px] text-zinc-600 font-mono italic">vacío</span>
                        </div>
                        <span className="text-[8.5px] font-bold text-zinc-300 mt-1 uppercase tracking-wide">UNIDADES</span>
                      </div>
                    </div>
                    <span className="text-[8.5px] text-zinc-500 block mt-1">
                      (Cuadros en blanco en el JPG para anotar a mano)
                    </span>
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
                  const q = catalogSearch.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(q) ||
                    (p.barcodeUnit || p.barcode).includes(q) ||
                    (p.barcodeBulk && p.barcodeBulk.includes(q))
                  );
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
                  <p className="text-[11px] text-zinc-400">El archivo .jpg se ha descargado a tu dispositivo</p>
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

            <div className="p-3 border-t border-white/10 bg-[#12141c] flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Formato JPG con fotos, códigos y recuadros manuales
              </span>
              <a
                href={exportedImageUrl}
                download={`lista_compras_${new Date().toISOString().slice(0, 10)}.jpg`}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Volver a Descargar JPG</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
