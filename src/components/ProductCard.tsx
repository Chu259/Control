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
  const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
  const bulkUnitName = product.bulkUnitName || `Caja x${unitsPerBulk}`;
  const hasBulk = Boolean(product.barcodeBulk);

  // Compact Grid view matching screenshot ("Cuadros (pequeños)")
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
              <span className="px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-amber-500 text-black shadow-sm flex items-center gap-0.5">
                <Package className="w-2.5 h-2.5" />
                <span>x{unitsPerBulk}</span>
              </span>
            )}
            {product.isNewFromUser && !product.reviewedByAdmin && (
              <span className="px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-purple-600 text-white shadow-sm flex items-center gap-0.5">
                <span>✨ Nuevo</span>
              </span>
            )}
          </div>

          {isLowStock && (
            <div
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5 shadow-sm ${
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
          <h3 className="text-xs font-semibold text-teal-600 truncate text-center mb-0.5" title={product.name}>
            {product.name}
          </h3>

          {/* Barcode Snippet */}
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-[10px] mb-1">
            <Barcode className="w-3 h-3 text-teal-500" />
            <span className="font-mono">{(product.barcodeUnit || product.barcode).slice(0, 8)}...</span>
            {hasBulk && <span className="text-[9px] text-amber-600 font-bold" title="Tiene código por bulto">+Bulto</span>}
          </div>

          {/* Stock & Unit Focus */}
          <div className="flex items-center justify-between text-[11px] font-semibold border-t border-zinc-100 pt-1">
            <span className="text-zinc-500 text-[10px] truncate max-w-[50px] capitalize">
              {product.category}
            </span>
            <span
              className={`font-mono font-bold text-xs ${
                isLowStock ? 'text-rose-600' : 'text-teal-700'
              }`}
              title={`Stock actual: ${product.stock} ${product.unit || 'uds'}`}
            >
              {product.stock} {product.unit || 'uds'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Large Grid view with quick actions
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
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1">
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
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/90 text-white flex items-center gap-1 shadow">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {isCriticalStock ? 'Crítico' : 'Reponer'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between gap-1 mb-1">
            <h3 className="font-semibold text-sm text-white truncate">{product.name}</h3>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">
              {product.category}
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

          {/* Physical Quantities Metrics */}
          <div className="grid grid-cols-3 gap-1 p-2 rounded-xl bg-black/40 border border-white/5 text-center mb-3">
            <div>
              <p className="text-[9px] text-zinc-500">Existencias</p>
              <p className={`text-xs font-bold ${isLowStock ? 'text-rose-400' : 'text-teal-400'}`}>
                {product.stock} {product.unit || 'uds'}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-zinc-500">Bultos</p>
              <p className="text-xs font-bold text-amber-300">
                {Math.floor(product.stock / unitsPerBulk)} {hasBulk ? 'cajas' : '-'}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-zinc-500">Mínimo</p>
              <p className="text-xs font-bold text-zinc-300">
                {product.minStockAlert}
              </p>
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
            <Minus className="w-3 h-3" /> Salida
          </button>
          <button
            id={`quick-in-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onQuickMovement(product, 'in');
            }}
            className="flex-1 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> Entrada
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

  // Detailed List View ("Listado")
  return (
    <div
      id={`product-row-${product.id}`}
      onClick={() => onClick(product)}
      className="group bg-[#161922] border border-white/10 hover:border-teal-500/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99]"
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
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
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-xs sm:text-sm text-white truncate">{product.name}</h3>
          {hasBulk && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {bulkUnitName}
            </span>
          )}
          {product.isNewFromUser && !product.reviewedByAdmin && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600/30 text-purple-300 border border-purple-500/40">
              ✨ Nuevo
            </span>
          )}
          {isLowStock && (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              {isCriticalStock ? 'Crítico' : 'Bajo'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
          <span className="flex items-center gap-0.5">
            <Barcode className="w-3 h-3 text-teal-400" />
            Ud: {product.barcodeUnit || product.barcode}
          </span>
          {product.barcodeBulk && (
            <span className="flex items-center gap-0.5 text-amber-400/90">
              📦 Bulto: {product.barcodeBulk}
            </span>
          )}
          <span className="text-zinc-600">•</span>
          <span className="capitalize">{product.category}</span>
        </div>
      </div>

      {/* Physical Stock Counter */}
      <div className="text-right flex-shrink-0 mr-1 sm:mr-2">
        <div className="text-xs sm:text-sm font-bold font-mono">
          <span className={isLowStock ? 'text-rose-400' : 'text-teal-400'}>
            {product.stock} {product.unit || 'uds'}
          </span>
        </div>
        {hasBulk && (
          <div className="text-[10.5px] text-amber-300/80 font-mono">
            ≈ {Math.floor(product.stock / unitsPerBulk)} bultos
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
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
  );
};
