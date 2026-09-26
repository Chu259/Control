import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, Check, AlertTriangle, Package, Layers, Tag } from 'lucide-react';
import { Product, MovementType, MovementReason } from '../types';
import { Sound } from '../services/sound';
import { BulkToUnitsModal } from './BulkToUnitsModal';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  initialType?: MovementType;
  initialUnitType?: 'unit' | 'bulk';
  initialQuantity?: number;
  currency: string;
  onSubmit: (params: {
    productId: string;
    type: MovementType;
    quantity: number;
    reason: MovementReason;
    notes?: string;
    unitType?: 'unit' | 'bulk';
    bulkQuantity?: number;
    unitsPerBulk?: number;
  }) => void;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  product,
  initialType = 'in',
  initialUnitType = 'unit',
  initialQuantity = 1,
  currency,
  onSubmit,
}) => {
  const [type, setType] = useState<MovementType>(initialType);
  const [unitMode, setUnitMode] = useState<'unit' | 'bulk'>(initialUnitType);
  const [inputCount, setInputCount] = useState<number>(initialQuantity || 1);
  const [rawCount, setRawCount] = useState<string>(String(initialQuantity || 1));
  const [reason, setReason] = useState<MovementReason>('compra');
  const [notes, setNotes] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  useEffect(() => {
    if (product) {
      setType(initialType);
      setUnitMode(initialUnitType || 'unit');
      const initialQty = initialQuantity && initialQuantity > 0 ? initialQuantity : 1;
      setInputCount(initialQty);
      setRawCount(String(initialQty));
      setReason(initialType === 'in' ? 'compra' : 'venta');
      setNotes('');
    }
  }, [product, initialType, initialUnitType, initialQuantity, isOpen]);

  if (!isOpen || !product) return null;

  const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
  const bulkUnitName = product.bulkUnitName || `Caja x${unitsPerBulk}`;

  // Total quantity in base individual units
  const totalUnits = unitMode === 'bulk' ? inputCount * unitsPerBulk : inputCount;

  const currentStock = product.stock;
  const nextStock = type === 'in' ? currentStock + totalUnits : Math.max(0, currentStock - totalUnits);
  const isNowLowStock = nextStock <= product.minStockAlert;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCount < 0) return;

    if (type === 'out' && totalUnits > currentStock) {
      if (
        !confirm(
          `La cantidad a retirar (${totalUnits} unidades) supera el stock disponible (${currentStock} uds). ¿Deseas continuar?`
        )
      ) {
        return;
      }
    }

    if (type === 'in') {
      Sound.playSuccessChime();
    } else {
      Sound.playScanBeep();
    }

    onSubmit({
      productId: product.id,
      type,
      quantity: totalUnits,
      reason,
      notes: notes.trim() || undefined,
      unitType: unitMode,
      bulkQuantity: unitMode === 'bulk' ? inputCount : undefined,
      unitsPerBulk: unitMode === 'bulk' ? unitsPerBulk : undefined,
    });
    onClose();
  };

  const quickAmounts = unitMode === 'bulk' ? [1, 2, 5, 10, 20] : [1, 5, 10, 24, 50];

  return (
    <div
      id="stock-movement-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#12141c]">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                type === 'in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {type === 'in' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {type === 'in' ? 'Registrar Entrada de Stock (+)' : 'Registrar Salida / Venta (-)'}
              </h2>
              <p className="text-[11px] text-zinc-400">Por unidades o por bultos completos</p>
            </div>
          </div>
          <button
            id="close-movement-modal-btn"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product summary card */}
        <div className="p-3.5 bg-[#12141c] border-b border-white/5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 p-1 flex-shrink-0 flex items-center justify-center">
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
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white truncate">{product.name}</h3>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
              <span>Ud: {product.barcodeUnit || product.barcode}</span>
              {product.barcodeBulk && (
                <span className="text-amber-400/90 font-mono">• Bulto: {product.barcodeBulk}</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Stock actual:{' '}
              <strong className={currentStock <= product.minStockAlert ? 'text-rose-400' : 'text-emerald-400'}>
                {currentStock} {product.unit || 'uds'}
              </strong>
              <span className="text-zinc-500 ml-1.5 font-mono text-[10px]">
                (≈ {Math.floor(currentStock / unitsPerBulk)} {bulkUnitName})
              </span>
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* Movement Type Toggle (In vs Out) */}
          <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              type="button"
              id="select-type-in"
              onClick={() => {
                setType('in');
                setReason('compra');
              }}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                type === 'in'
                  ? 'bg-emerald-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Entrada (Stock +)</span>
            </button>
            <button
              type="button"
              id="select-type-out"
              onClick={() => {
                setType('out');
                setReason('venta');
              }}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                type === 'out'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Salida (Venta -)</span>
            </button>
          </div>

          {/* Unit vs Bulk Mode Selector */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-300">
              Modo de Carga / Despacho:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="mode-unit-btn"
                onClick={() => setUnitMode('unit')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  unitMode === 'unit'
                    ? 'bg-teal-500/15 border-teal-500 text-white shadow-sm'
                    : 'bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Tag className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-xs font-bold text-white">Por Unidad (1 ud)</span>
                </div>
                <p className="text-[10px] text-zinc-400">Venta minorista o ajuste individual</p>
              </button>

              <button
                type="button"
                id="mode-bulk-btn"
                onClick={() => setUnitMode('bulk')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  unitMode === 'bulk'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                    : 'bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-white">Por Bulto ({bulkUnitName})</span>
                </div>
                <p className="text-[10px] text-zinc-400">Pack cerrado ({unitsPerBulk} uds/caja)</p>
              </button>
            </div>
          </div>

          {/* Quantity Stepper */}
          <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
              <span>
                {unitMode === 'bulk' ? `Cantidad de ${bulkUnitName}:` : 'Cantidad de Unidades:'}
              </span>
              <span className="font-mono text-teal-400 font-bold">
                Total: {totalUnits} {product.unit || 'uds'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="qty-decrement-btn"
                onClick={() => {
                  const nextVal = Math.max(0, inputCount - 1);
                  setInputCount(nextVal);
                  setRawCount(String(nextVal));
                }}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-lg flex items-center justify-center border border-white/10 active:scale-95 cursor-pointer"
              >
                -
              </button>
              <input
                id="quantity-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                value={rawCount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, '');
                  setRawCount(clean);
                  const parsed = parseInt(clean, 10);
                  if (!isNaN(parsed) && parsed >= 0) {
                    setInputCount(parsed);
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(rawCount, 10);
                  if (isNaN(parsed) || parsed < 0) {
                    setInputCount(0);
                    setRawCount('0');
                  } else {
                    setInputCount(parsed);
                    setRawCount(String(parsed));
                  }
                }}
                className="flex-1 bg-[#0f1118] border border-white/10 rounded-xl py-2 px-3 text-center text-lg font-mono font-bold text-white focus:outline-none focus:border-teal-500"
              />
              <button
                type="button"
                id="qty-increment-btn"
                onClick={() => {
                  const nextVal = inputCount + 1;
                  setInputCount(nextVal);
                  setRawCount(String(nextVal));
                }}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-lg flex items-center justify-center border border-white/10 active:scale-95 cursor-pointer"
              >
                +
              </button>
              {/* Bulto/Caja Assistant button right next to the + / - buttons */}
              <button
                type="button"
                id="qty-open-bulk-modal-btn"
                onClick={() => setBulkModalOpen(true)}
                className="w-10 h-10 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold flex items-center justify-center border border-amber-500/30 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                title="Asistente de Carga por Bultos (Convertir bultos a unidades)"
              >
                <Package className="w-4 h-4" />
              </button>
            </div>

            {/* Quick amount chips */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-zinc-500">Rápido:</span>
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setInputCount(amt);
                    setRawCount(String(amt));
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-colors ${
                    inputCount === amt
                      ? 'bg-teal-500 text-black font-bold'
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  +{amt} {unitMode === 'bulk' ? 'cajas' : 'uds'}
                </button>
              ))}
            </div>

            {/* Stock Impact Preview */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                {unitMode === 'bulk' ? `Impacto (${inputCount} bultos x ${unitsPerBulk}):` : 'Impacto en Stock:'}
              </span>
              <span className="font-bold font-mono text-teal-300">
                {type === 'in' ? `+${totalUnits}` : `-${totalUnits}`} {product.unit || 'uds'}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Motivo / Operación:</label>
            <select
              id="reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value as MovementReason)}
              className="w-full bg-[#0f1118] border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              {type === 'in' ? (
                <>
                  <option value="compra">Compra a proveedor / distribuidora</option>
                  <option value="devolucion">Devolución de cliente</option>
                  <option value="ajuste">Ajuste de inventario</option>
                </>
              ) : (
                <>
                  <option value="venta">Venta mostrador / caja</option>
                  <option value="merma">Merma / Producto dañado o vencido</option>
                  <option value="ajuste">Ajuste negativo de inventario</option>
                </>
              )}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Nota o Remito (opcional):</label>
            <input
              id="movement-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Factura 0048 / Bultos descargados en depósito..."
              className="w-full bg-[#0f1118] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Stock Calculation Preview */}
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Nuevo stock resultante:</span>
            <div className="flex items-center gap-1 font-bold">
              <span className="text-zinc-400">{currentStock}</span>
              <span className="text-zinc-600">→</span>
              <span className={isNowLowStock ? 'text-rose-400' : 'text-emerald-400'}>
                {nextStock} {product.unit || 'uds'}
              </span>
              {isNowLowStock && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 ml-1" />}
            </div>
          </div>

          {/* Submit Action */}
          <button
            id="confirm-movement-btn"
            type="submit"
            className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
              type === 'in'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white'
                : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              Confirmar {type === 'in' ? 'Entrada' : 'Salida'} ({totalUnits} {product.unit || 'uds'})
            </span>
          </button>
        </form>
      </div>

      {/* Asistente de Carga por Bultos */}
      {bulkModalOpen && (
        <BulkToUnitsModal
          isOpen={bulkModalOpen}
          onClose={() => setBulkModalOpen(false)}
          initialUnitsPerBulk={unitsPerBulk}
          bulkUnitName={bulkUnitName}
          productName={product.name}
          onConfirm={(calculatedTotal) => {
            // When converting bultos to total units, set mode to unit and directly inject calculated units
            setUnitMode('unit');
            setInputCount(calculatedTotal);
            setRawCount(String(calculatedTotal));
          }}
        />
      )}
    </div>
  );
};
