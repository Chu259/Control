import React, { useState, useEffect, useRef } from 'react';
import { Package, X, Check, Layers, PlusCircle, ArrowRight } from 'lucide-react';
import { Sound } from '../services/sound';

interface BulkToUnitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (totalUnits: number) => void;
  initialUnitsPerBulk?: number;
  bulkUnitName?: string;
  productName?: string;
  currentUnits?: number;
}

export const BulkToUnitsModal: React.FC<BulkToUnitsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialUnitsPerBulk = 12,
  bulkUnitName = 'Bulto',
  productName,
  currentUnits,
}) => {
  const [bultos, setBultos] = useState<string>('');
  const [unitsPerBulk, setUnitsPerBulk] = useState<string>(String(initialUnitsPerBulk > 0 ? initialUnitsPerBulk : 12));
  const [looseUnits, setLooseUnits] = useState<string>('');
  const bultosInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const upb = initialUnitsPerBulk > 0 ? initialUnitsPerBulk : 12;
      setUnitsPerBulk(String(upb));

      if (currentUnits !== undefined && currentUnits > 0) {
        // Optionally pre-fill equivalent bultos and loose units
        const fullBultos = Math.floor(currentUnits / upb);
        const loose = currentUnits % upb;
        setBultos(fullBultos > 0 ? String(fullBultos) : '');
        setLooseUnits(loose > 0 ? String(loose) : '');
      } else {
        setBultos('');
        setLooseUnits('');
      }

      // Auto-focus the bultos input
      setTimeout(() => {
        if (bultosInputRef.current) {
          bultosInputRef.current.focus();
          bultosInputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, initialUnitsPerBulk, currentUnits]);

  // Listen for back button
  useEffect(() => {
    if (!isOpen) return;
    const handleBack = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('android_back_pressed', handleBack);
    return () => {
      window.removeEventListener('android_back_pressed', handleBack);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const numBultos = parseInt(bultos, 10) || 0;
  const numUnitsPerBulk = parseInt(unitsPerBulk, 10) || 0;
  const numLooseUnits = parseInt(looseUnits, 10) || 0;

  // Formula: (Bultos * Unidades por Bulto) + Unidades Sueltas
  const calculatedTotal = Math.max(0, (numBultos * numUnitsPerBulk) + numLooseUnits);

  const handleConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    Sound.playSuccessChime();
    onConfirm(calculatedTotal);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      id="bulk-to-units-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#151822] border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#10131c]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                <span>Asistente de Carga por Bultos</span>
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                {productName ? productName : 'Conversor de Bultos a Unidades Físicas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-4 space-y-3.5">
          {/* Real-time Calculation Summary Card */}
          <div className="p-3 bg-[#0d1017] rounded-2xl border border-white/10">
            <div className="text-[11px] text-zinc-400 flex items-center justify-between mb-1.5">
              <span>Cálculo en vivo:</span>
              <span className="font-mono text-xs text-amber-300">
                ({numBultos} bultos × {numUnitsPerBulk}) + {numLooseUnits}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-xs font-semibold text-zinc-300">
                Total Unidades Físicas:
              </span>
              <div className="flex items-baseline gap-1 font-mono text-2xl font-black text-emerald-400">
                <span>{calculatedTotal.toLocaleString()}</span>
                <span className="text-xs font-normal text-zinc-400">uds</span>
              </div>
            </div>
          </div>

          {/* Field 1: Cantidad de Bultos / Packs */}
          <div>
            <label className="block text-xs font-semibold text-zinc-200 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Package className="w-3.5 h-3.5" />
                <span>Cantidad de Bultos / Packs:</span>
              </span>
              <span className="text-[10px] text-zinc-400">Cajas cerradas</span>
            </label>
            <input
              ref={bultosInputRef}
              id="bulk-modal-bultos-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bultos}
              onChange={(e) => setBultos(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="w-full bg-[#0d1017] border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 shadow-inner"
            />
          </div>

          {/* Field 2: Unidades que trae cada Bulto (preloaded with unitsPerBulk, editable) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-200 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sky-300">
                <Layers className="w-3.5 h-3.5" />
                <span>Unidades que trae cada Bulto:</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {bulkUnitName || 'Empaque'}
              </span>
            </label>
            <input
              id="bulk-modal-units-per-bulk-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={unitsPerBulk}
              onChange={(e) => setUnitsPerBulk(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="12"
              className="w-full bg-[#0d1017] border border-white/10 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-sky-300 focus:outline-none focus:border-sky-400 shadow-inner"
            />
          </div>

          {/* Field 3: Unidades Sueltas (Opcional) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-200 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-teal-300">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Unidades Sueltas:</span>
              </span>
              <span className="text-[10px] text-zinc-400">Opcional (fuera de bulto)</span>
            </label>
            <input
              id="bulk-modal-loose-units-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={looseUnits}
              onChange={(e) => setLooseUnits(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="w-full bg-[#0d1017] border border-white/10 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-teal-400 shadow-inner"
            />
          </div>

          {/* Quick presets for common bulto counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 text-[11px]">
            <span className="text-[10px] text-zinc-500 whitespace-nowrap">Bultos rápidos:</span>
            {[1, 2, 5, 10, 20, 50].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setBultos(String(count))}
                className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] transition-colors whitespace-nowrap ${
                  numBultos === count
                    ? 'bg-amber-500 text-black font-extrabold border-amber-400'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                }`}
              >
                {count} cj
              </button>
            ))}
          </div>

          {/* Footer Submit Button: Green with Check "✓ Confirmar Ingreso" */}
          <div className="pt-2">
            <button
              id="btn-confirm-bulk-to-units"
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>
                ✓ Confirmar Ingreso ({calculatedTotal.toLocaleString()} uds)
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
