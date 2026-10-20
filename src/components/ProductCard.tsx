import React from 'react';
import { Barcode, AlertTriangle, Plus, Minus, Package, Edit2 } from 'lucide-react';
import { Product, ViewMode } from '../types';
import { checkStockAlert } from '../utils/stockAlert';

interface ProductCardProps {
  product: Product;
  currency?: string;
  viewMode: ViewMode;
  onQuickMovement: (product: Product, type: 'in' | 'out') => void;
  onEdit: (product: Product) => void;
  onClick: (product: Product) => void;
}

export const formatPasilloLabel = (category?: string) => {
  if (!category) return 'PASILLO-1';
  const clean = category.trim().toUpperCase();
  if (clean.startsWith('PASILLO-') || clean.startsWith('PASILLO ')) {
    return clean.replace(/\s+/g, '-');
  }
  return clean;
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  viewMode,
  onQuickMovement,
  onEdit,
  onClick,
}) => {
  const alertStatus = checkStockAlert(product);
  const isLowStock = alertStatus.isLow;
  const isCriticalStock = alertStatus.isCritical;
  // Desglose de bultos: se verifica ÚNICAMENTE que "Unidades por Bulto" sea mayor que 1
  const hasBulk = typeof product.unitsPerBulk === 'number' && product.unitsPerBulk > 1;
  const unitsPerBulk = hasBulk ? product.unitsPerBulk! : 1;
  const safeStock = Math.max(0, product.stock);
  const bulkCount = hasBulk ? Math.floor(safeStock / unitsPerBulk) : 0;
  const looseCount = hasBulk ? safeStock % unitsPerBulk : product.stock;

  // Regla visual estricta de "Desglose Físico Neto": "[Número] blts + [Número] uds"
  // Si no tiene unidades por bulto configuradas (cero o vacío), muestra únicamente unidades puras
  const stockNetoDisplay = hasBulk
    ? `${bulkCount} blts + ${looseCount} uds`
    : `${product.stock} ${product.unit || 'uds'}`;

  const bulkUnitName = product.bulkUnitName || (hasBulk ? `Caja x${unitsPerBulk}` : '');
  const pasilloLabel = formatPasilloLabel(product.category);

  // Compact Grid view matching original clean design ("Cuadros (pequeños)")
  if (viewMode === 'grid-small') {
    return (
      <div
        id={`product-card-${product.id}`}
        onClick={() => onClick(product)}
        className="group relative bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 border border-zinc-200/80 flex flex-col justify-between cursor-pointer active:scale-[0.98]"
      >
        {/* Top Badges */}
        <div className="absolute top-1.5 left-1.5 right-1.5 z-10 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1">
            {hasBulk && (
              <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-amber-500 text-black shadow-sm flex items-center gap-0.5">
                <Package className="w-2.5 h-2.5" />
                <span>x{unitsPerBulk}</span>
              </span>
            )}
            {product.isNewFromUser && !product.reviewedByAdmin && (
              <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-purple-600 text-white shadow-sm flex items-center gap-0.5">
                <span>✨ Nuevo</span>
              </span>
            )}
          </div>
          {isLowStock && (
            <div
              className={`px-1.5 py-0.5 rounded-full text-[8.5px] font-bold flex items-center gap-0.5 shadow-sm ${
                isCriticalStock
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-amber-400 text-zinc-900'
              }`}
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>{isCriticalStock ? 'Crítico' : 'Bajo'}</span>
            </div>
          )}
        </div>

        {/* Product Image Area */}
        <div className="relative w-full aspect-[4/5] bg-white flex items-center justify-center p-2 overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
              <Package className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="p-2 pt-1 border-t border-zinc-100 bg-white">
          <h3 className="text-xs font-semibold text-zinc-900 truncate mb-0.5" title={product.name}>
            {product.name}
          </h3>

          {/* Barcode Snippet */}
          <div className="flex items-center gap-1 text-zinc-400 text-[10px] mb-1">
            <Barcode className="w-3 h-3 text-teal-600" />
            <span className="font-mono">{(product.barcodeUnit || product.barcode).slice(0, 8)}...</span>
            {product.barcodeBulk && <span className="text-[9px] text-amber-600 font-bold" title="Tiene código por bulto">+Bulto</span>}
          </div>

          {/* Renglón de Existencias: 100% de ancho libre para mostrarse completo y legible */}
          <div className="border-t border-zinc-100 pt-1 text-center">
            <span
              className={`font-mono font-bold text-xs block truncate ${
                isLowStock ? 'text-rose-600' : 'text-emerald-600'
              }`}
              title={`Stock actual: ${product.stock} ${product.unit || 'uds'} (${stockNetoDisplay})`}
            >
              {stockNetoDisplay}
            </span>
          </div>

          {/* Pasillo reubicado abajo de todo */}
          <div className="pt-0.5 text-center">
            <span className="inline-block text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
              {pasilloLabel}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Large Grid view with quick actions ("Cuadros Grandes")
  if (viewMode === 'grid-large') {
    return (
      <div
        id={`product-card-lg-${product.id}`}
        className="group relative bg-[#171a24] border border-white/10 rounded-2xl p-3 flex flex-col justify-between hover:border-teal-500/40 transition-all shadow-lg hover:shadow-teal-500/5"
      >
        <div onClick={() => onClick(product)} className="cursor-pointer">
          <div className="relative w-full aspect-square bg-white rounded-xl mb-2.5 p-3 flex items-center justify-center overflow-hidden">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <Package className="w-10 h-10 text-zinc-400" />
            )}

            {/* Badges */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
              {hasBulk && (
                <span className="px-2 py-0.5 text-[9.5px] font-bold rounded-md bg-amber-500 text-black flex items-center gap-1 shadow">
                  <Package className="w-3 h-3" />
                  <span>{bulkUnitName}</span>
                </span>
              )}
              {product.isNewFromUser && !product.reviewedByAdmin && (
                <span className="px-2 py-0.5 text-[9.5px] font-bold rounded-md bg-purple-600 text-white flex items-center gap-1 shadow">
                  <span>✨ Nuevo</span>
                </span>
              )}
            </div>

            {isLowStock && (
              <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/90 text-white flex items-center gap-1 shadow">
                <AlertTriangle className="w-2.5 h-2.5" />
                {isCriticalStock ? 'Crítico' : 'Reponer'}
              </span>
            )}
          </div>

          {/* Nombre del Producto: Ocupa el 100% del ancho del renglón superior */}
          <div className="mb-1">
            <h3 className="font-semibold text-sm text-white line-clamp-2 leading-snug break-words" title={product.name}>
              {product.name}
            </h3>
          </div>

          {/* Pasillo: Ubicado exactamente debajo del Nombre del Producto y por encima de los códigos de barra */}
          <div className="mb-1.5 flex items-center">
            <span className="text-[9.5px] uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30">
              {pasilloLabel}
            </span>
          </div>

          {/* Barcodes snippet */}
          <div className="flex flex-col gap-0.5 text-xs text-zinc-400 font-mono mb-2">
            <div className="flex items-center gap-1">
              <Barcode className="w-3.5 h-3.5 text-teal-400" />
              <span>Ud: {product.barcodeUnit || product.barcode}</span>
            </div>
            {product.barcodeBulk && (
              <div className="flex items-center gap-1 text-amber-300/80 text-[11px]">
                <Package className="w-3 h-3 text-amber-400" />
                <span>Bulto: {product.barcodeBulk}</span>
              </div>
            )}
          </div>

          {/* Physical Quantities Metrics: Desglose Físico Neto */}
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 mb-3 text-center">
            <p className={`text-xs sm:text-[13px] font-bold font-mono ${isLowStock ? 'text-rose-400' : 'text-emerald-400'}`}>
              {stockNetoDisplay}
            </p>
            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1.5 mt-1.5 border-t border-white/5">
              <span>Total: <strong className="text-zinc-300">{product.stock} {product.unit || 'uds'}</strong></span>
              <span>Mínimo: <strong className="text-zinc-300">{product.minStockAlert}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Entrada & Salida Actions */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
          <button
            id={`quick-out-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onQuickMovement(product, 'out');
            }}
            disabled={product.stock <= 0}
            className="flex-1 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-30 text-rose-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" /> Salida
          </button>
          <button
            id={`quick-in-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onQuickMovement(product, 'in');
            }}
            className="flex-1 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Entrada
          </button>
          <button
            id={`edit-prod-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(product);
            }}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            title="Editar producto"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Detailed List View ("Listado Detallado")
  // 1. Fila superior de etiquetas de colores intactas ("Pack x20", "Crítico", etc.) en su lugar y diseño original
  // 2. Nombre del producto en un nuevo renglón exclusivo (100% ancho disponible) por encima de códigos de barra y existencias
  return (
    <div
      id={`product-row-${product.id}`}
      onClick={() => onClick(product)}
      className="group bg-[#161922] border border-white/10 hover:border-teal-500/30 rounded-xl p-3 flex flex-col gap-2 cursor-pointer transition-all active:scale-[0.99]"
    >
      {/* 1. Fila superior: Thumbnail + Recuadros de colores ("Pack x20", "Crítico", etc.) + Acciones */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Thumbnail */}
          <div className="w-8 h-8 rounded-lg bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10 shadow-sm">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <Package className="w-4 h-4 text-zinc-400" />
            )}
          </div>

          {/* Pasillo */}
          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-teal-500/15 text-teal-300 border border-teal-500/30">
            {pasilloLabel}
          </span>

          {/* Recuadro de empaque / bulto ("Pack x20", "Caja x12") */}
          {hasBulk && (
            <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-500 text-black flex items-center gap-1 shadow-sm">
              <Package className="w-3 h-3" />
              <span>{bulkUnitName}</span>
            </span>
          )}

          {/* Indicador de Nuevo */}
          {product.isNewFromUser && !product.reviewedByAdmin && (
            <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-purple-600 text-white shadow-sm flex items-center gap-1">
              <span>✨ Nuevo</span>
            </span>
          )}

          {/* Indicador de Crítico / Bajo */}
          {isLowStock && (
            <span
              className={`px-2 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 shadow-sm ${
                isCriticalStock
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-amber-400 text-zinc-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{isCriticalStock ? 'Crítico' : 'Bajo'}</span>
            </span>
          )}
        </div>

        {/* Botones de acción rápida Entrada/Salida en la fila superior */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            id={`list-out-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onQuickMovement(product, 'out');
            }}
            disabled={product.stock <= 0}
            className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 disabled:opacity-20 text-rose-300 flex items-center justify-center transition-colors"
            title="Registrar Salida"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            id={`list-in-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onQuickMovement(product, 'in');
            }}
            className="w-7 h-7 rounded-lg bg-teal-500/15 hover:bg-teal-500/30 text-teal-300 flex items-center justify-center transition-colors"
            title="Registrar Entrada"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Renglón exclusivo para el Nombre del Producto: 100% de ancho disponible */}
      <div className="w-full">
        <h3 className="font-semibold text-sm sm:text-[15px] text-white leading-snug break-words" title={product.name}>
          {product.name}
        </h3>
      </div>

      {/* 3. Fila Inferior: Códigos de barra y existencias por encima o por debajo */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 text-xs text-zinc-400 font-mono">
        <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
          <span className="flex items-center gap-1">
            <Barcode className="w-3.5 h-3.5 text-teal-400" />
            Ud: <span className="text-zinc-200 font-semibold">{product.barcodeUnit || product.barcode}</span>
          </span>
          {product.barcodeBulk && (
            <span className="flex items-center gap-1 text-amber-300">
              <Package className="w-3 h-3 text-amber-400" />
              Bulto: <span className="text-amber-200 font-semibold">{product.barcodeBulk}</span>
            </span>
          )}
        </div>

        <div className="text-right flex items-center gap-1.5 ml-auto">
          <span
            className={`font-bold font-mono text-xs sm:text-sm ${
              isLowStock ? 'text-rose-400' : 'text-emerald-400'
            }`}
            title={`Stock total: ${product.stock} ${product.unit || 'uds'}`}
          >
            {stockNetoDisplay}
          </span>
        </div>
      </div>
    </div>
  );
};
