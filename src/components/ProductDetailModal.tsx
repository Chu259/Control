import React, { useState } from 'react';
import {
  X,
  Barcode,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  History,
  Calendar,
  Layers,
  Copy,
  Check,
  Tag,
  Boxes,
  ShoppingCart,
  CheckCircle2,
  User,
} from 'lucide-react';
import { Product, StockMovement, MovementType } from '../types';
import { checkStockAlert } from '../utils/stockAlert';
import { ShoppingService } from '../services/shoppingService';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  currency?: string;
  movements: StockMovement[];
  onOpenMovement: (product: Product, type: MovementType, unitType?: 'unit' | 'bulk') => void;
  onEdit: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  movements,
  onOpenMovement,
  onEdit,
}) => {
  const [copiedField, setCopiedField] = useState<'unit' | 'bulk' | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const productMovements = movements
    .filter((m) => m.productId === product.id)
    .slice(0, 10);

  const alertStatus = checkStockAlert(product);
  const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
  const bulkUnitName = product.bulkUnitName || `Caja x${unitsPerBulk}`;
  const fullBulks = Math.floor(product.stock / unitsPerBulk);
  const looseUnits = product.stock % unitsPerBulk;

  const handleCopy = (text: string, field: 'unit' | 'bulk') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAddToShopping = () => {
    ShoppingService.addToShoppingList(product.id, 'Agregado desde detalle');
    setActionNotice('¡Añadido a Lista de Compras!');
    setTimeout(() => setActionNotice(null), 2500);
  };

  const handleAddToReplenishment = () => {
    ShoppingService.addToReplenishmentList(product.id, product.notes || 'Reponer en góndola');
    setActionNotice('¡Añadido a Lista de Reposición!');
    setTimeout(() => setActionNotice(null), 2500);
  };

  return (
    <div
      id="product-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl my-auto animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#12141c]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Detalle de Producto</h2>
              <p className="text-[11px] text-zinc-400">Existencias físicas y códigos de barra</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-teal-400 hover:text-teal-300 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Top Hero: Image & Name */}
          <div className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
            <div className="w-16 h-16 rounded-lg bg-white p-1.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <Package className="w-8 h-8 text-zinc-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  {product.category}
                </span>
                {alertStatus.isLow && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {alertStatus.alertLabel}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mt-1 leading-snug">{product.name}</h3>
              {product.notes && <p className="text-xs text-zinc-400 mt-0.5">{product.notes}</p>}
            </div>
          </div>

          {/* Barcodes Section (Unit & Bulk) */}
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <span className="text-xs font-semibold text-zinc-300">Códigos de Barra Asignados</span>

            <div className="space-y-1.5">
              {/* Unit Barcode */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#12141c] border border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono">
                  <Tag className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-zinc-400 text-[11px]">Unidad:</span>
                  <span className="font-bold text-teal-300">{product.barcodeUnit || product.barcode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(product.barcodeUnit || product.barcode, 'unit')}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors px-1"
                >
                  {copiedField === 'unit' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'unit' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              {/* Bulk Barcode */}
              {product.barcodeBulk ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-1.5 text-xs text-amber-200 font-mono">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-zinc-400 text-[11px]">Bulto / Pack:</span>
                    <span className="font-bold">{product.barcodeBulk}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(product.barcodeBulk!, 'bulk')}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors px-1"
                  >
                    {copiedField === 'bulk' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'bulk' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-500">
                  Sin código de bulto registrado. (Puedes asignarlo en Editar)
                </div>
              )}
            </div>
          </div>

          {/* Physical Inventory Breakdown */}
          <div className="p-3.5 rounded-xl bg-[#1c202d] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-teal-400" />
                <span>Desglose de Existencias</span>
              </span>
              <span className="text-xs font-mono font-bold text-amber-300">
                Empaque: {bulkUnitName}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <p className="text-[10px] text-zinc-400">Total Unidades</p>
                <p className={`text-base font-black mt-0.5 font-mono ${alertStatus.isLowUnit ? 'text-rose-400' : 'text-teal-400'}`}>
                  {product.stock}
                </p>
                <p className="text-[9px] text-zinc-500">{product.unit || 'uds'}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <p className="text-[10px] text-zinc-400">Bultos Cerrados</p>
                <p className={`text-base font-black mt-0.5 font-mono ${alertStatus.isLowBulk ? 'text-rose-400' : 'text-amber-300'}`}>
                  {fullBulks}
                </p>
                <p className="text-[9px] text-zinc-500">cajas / packs</p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <p className="text-[10px] text-zinc-400">Uds Sueltas</p>
                <p className="text-base font-black mt-0.5 font-mono text-zinc-300">
                  {looseUnits}
                </p>
                <p className="text-[9px] text-zinc-500">unidades</p>
              </div>
            </div>

            {/* Dual Stock Minimum Alerts info */}
            <div className="space-y-1 pt-1 border-t border-white/5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Alerta Mínima (Unidades):</span>
                <span className={`font-mono font-bold ${alertStatus.isLowUnit ? 'text-rose-400' : 'text-zinc-300'}`}>
                  {alertStatus.minUnitAlert} {product.unit || 'uds'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Alerta Mínima (Bultos):</span>
                <span className={`font-mono font-bold ${alertStatus.isLowBulk ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {alertStatus.minBulkAlert} bultos ({bulkUnitName})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Capacidad Sugerida en Góndola:</span>
                <span className="font-mono font-bold text-teal-300">
                  {product.suggestedGondolaQuantity || Math.max(alertStatus.minUnitAlert * 2, unitsPerBulk)} {product.unit || 'uds'}
                </span>
              </div>
              {alertStatus.isLow && (
                <div className="mt-1 p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <span>{alertStatus.alertLabel}: Requiere abastecimiento</span>
                </div>
              )}
            </div>

            {/* Quick Actions for Shopping & Replenishment Lists */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={handleAddToShopping}
                className="py-1.5 px-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-sky-500/30 transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Añadir a Compras</span>
              </button>

              <button
                type="button"
                onClick={handleAddToReplenishment}
                className="py-1.5 px-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-500/30 transition-colors"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Añadir a Reposición</span>
              </button>
            </div>

            {actionNotice && (
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{actionNotice}</span>
              </div>
            )}
          </div>

          {/* Primary Operations Actions: Unit vs Bulk */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-400">Registrar Movimientos de Stock</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="detail-movement-in"
                onClick={() => {
                  onClose();
                  onOpenMovement(product, 'in', 'unit');
                }}
                className="py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ Entrada (Unidad)</span>
              </button>

              <button
                id="detail-movement-out"
                onClick={() => {
                  onClose();
                  onOpenMovement(product, 'out', 'unit');
                }}
                disabled={product.stock <= 0}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>- Salida (Unidad)</span>
              </button>
            </div>

            {/* Quick Bulk Movement triggers */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenMovement(product, 'in', 'bulk');
                }}
                className="py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all active:scale-95"
              >
                <Package className="w-3.5 h-3.5" />
                <span>+ Entrada por Bulto</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenMovement(product, 'out', 'bulk');
                }}
                disabled={product.stock < unitsPerBulk}
                className="py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-white/5 transition-all active:scale-95"
              >
                <Package className="w-3.5 h-3.5" />
                <span>- Salida por Bulto</span>
              </button>
            </div>
          </div>

          {/* Movement History */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-1 font-semibold text-white">
                <History className="w-3.5 h-3.5 text-teal-400" />
                <span>Historial de Movimientos Recientes</span>
              </div>
              <span>{productMovements.length} registro(s)</span>
            </div>

            {productMovements.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-2 text-center">
                Aún no hay movimientos registrados para este producto
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {productMovements.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center ${
                          m.type === 'in'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {m.type === 'in' ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-white capitalize">
                            {m.type === 'in' ? 'Entrada' : 'Salida'} • {m.reason}
                          </p>
                          {(m.format === 'bulk' || m.unitType === 'bulk') && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Bulto ({m.bulkQuantity || 1} cj)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(m.timestamp).toLocaleString('es-ES', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                          <span className="text-sky-300 flex items-center gap-0.5 bg-sky-500/10 px-1.5 py-0.2 rounded font-sans font-medium">
                            <User className="w-2.5 h-2.5 text-sky-400" />
                            <span>{m.userName || 'Usuario'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span
                        className={`font-bold ${
                          m.type === 'in' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {m.type === 'in' ? '+' : '-'}
                        {m.quantity} uds
                      </span>
                      <p className="text-[10px] text-zinc-500">
                        {m.previousStock} → {m.newStock}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
