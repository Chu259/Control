import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { Sound } from '../services/sound';

interface BulkToUnitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (totalUnits: number) => void;
  initialUnitsPerBulk?: number;
  bulkUnitName?: string;
  productName?: string;
}

/**
 * 3D Isometric Boxes Cluster (Neon Amber) matching Screenshot_2026-09-26-12-24-38-687.jpg
 */
const IsometricBoxesIcon: React.FC = () => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
  >
    {/* Top Box */}
    <path
      d="M32 5 L45 12.5 L32 20 L19 12.5 Z"
      fill="#F59E0B"
      fillOpacity="0.4"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M19 12.5 L32 20 L32 33 L19 25.5 Z"
      fill="#D97706"
      fillOpacity="0.65"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M32 20 L45 12.5 L45 25.5 L32 33 Z"
      fill="#B45309"
      fillOpacity="0.85"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />

    {/* Bottom Left Box */}
    <path
      d="M19 27.5 L32 35 L19 42.5 L6 35 Z"
      fill="#F59E0B"
      fillOpacity="0.4"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M6 35 L19 42.5 L19 55.5 L6 48 Z"
      fill="#D97706"
      fillOpacity="0.65"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M19 42.5 L32 35 L32 48 L19 55.5 Z"
      fill="#B45309"
      fillOpacity="0.85"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />

    {/* Bottom Right Box */}
    <path
      d="M45 27.5 L58 35 L45 42.5 L32 35 Z"
      fill="#F59E0B"
      fillOpacity="0.4"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M32 35 L45 42.5 L45 55.5 L32 48 Z"
      fill="#D97706"
      fillOpacity="0.65"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M45 42.5 L58 35 L58 48 L45 55.5 Z"
      fill="#B45309"
      fillOpacity="0.85"
      stroke="#FBBF24"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 3D Isometric Stacked Layers (Neon Cyan/Blue) matching Screenshot_2026-09-26-12-24-38-687.jpg
 */
const StackedLayersIcon: React.FC = () => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]"
  >
    {/* Top Layer Plate */}
    <path
      d="M32 7 L54 18 L32 29 L10 18 Z"
      fill="#0284C7"
      fillOpacity="0.4"
      stroke="#38BDF8"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M10 18 L10 23 L32 34 L54 23 L54 18"
      stroke="#38BDF8"
      strokeWidth="3"
      strokeLinejoin="round"
    />

    {/* Middle Layer Plate */}
    <path
      d="M10 29 L32 40 L54 29"
      stroke="#38BDF8"
      strokeWidth="3"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M10 33 L32 44 L54 33"
      stroke="#38BDF8"
      strokeWidth="3"
      strokeLinejoin="round"
      fill="none"
    />

    {/* Bottom Layer Plate */}
    <path
      d="M10 41 L32 52 L54 41"
      stroke="#38BDF8"
      strokeWidth="3"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M10 46 L32 57 L54 46"
      stroke="#38BDF8"
      strokeWidth="3"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/**
 * Neon Glowing Plus Circle Badge (Teal/Emerald) matching Screenshot_2026-09-26-12-24-38-687.jpg
 */
const PlusCircleNeonIcon: React.FC = () => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 drop-shadow-[0_0_10px_rgba(45,212,191,0.6)]"
  >
    {/* Outer glow ring */}
    <circle
      cx="32"
      cy="32"
      r="25"
      stroke="#2DD4BF"
      strokeWidth="3.5"
      fill="#0F766E"
      fillOpacity="0.3"
    />
    {/* Inner decorative ring */}
    <circle
      cx="32"
      cy="32"
      r="20"
      stroke="#14B8A6"
      strokeWidth="1.5"
      strokeOpacity="0.4"
      fill="none"
    />
    {/* Plus symbol */}
    <line
      x1="32"
      y1="19"
      x2="32"
      y2="45"
      stroke="#2DD4BF"
      strokeWidth="4.5"
      strokeLinecap="round"
    />
    <line
      x1="19"
      y1="32"
      x2="45"
      y2="32"
      stroke="#2DD4BF"
      strokeWidth="4.5"
      strokeLinecap="round"
    />
  </svg>
);

export const BulkToUnitsModal: React.FC<BulkToUnitsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialUnitsPerBulk = 12,
  bulkUnitName = 'Bulto',
  productName,
}) => {
  // Memory cleanup on open: Bultos and loose units reset to empty every time
  const [bultos, setBultos] = useState<string>('');
  const [unitsPerBulk, setUnitsPerBulk] = useState<string>(
    String(initialUnitsPerBulk > 0 ? initialUnitsPerBulk : 12)
  );
  const [looseUnits, setLooseUnits] = useState<string>('');
  const bultosInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const upb = initialUnitsPerBulk > 0 ? initialUnitsPerBulk : 12;
      setUnitsPerBulk(String(upb));
      setBultos('');
      setLooseUnits('');

      setTimeout(() => {
        if (bultosInputRef.current) {
          bultosInputRef.current.focus();
          bultosInputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, initialUnitsPerBulk]);

  // Handle native Android back button
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
  const calculatedTotal = Math.max(0, numBultos * numUnitsPerBulk + numLooseUnits);

  // Keypad delta addition to bultos in real time
  const handleAddBultos = (amount: number) => {
    Sound.playScanBeep();
    setBultos((prev) => {
      const current = parseInt(prev, 10) || 0;
      const next = Math.max(0, current + amount);
      return next > 0 ? String(next) : '';
    });
  };

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#131620] border border-amber-500/25 rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0e111a]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
              <span className="font-mono text-sm font-black">📦</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                Asistente de Carga por Bultos
              </h3>
              {productName && (
                <p className="text-[10px] text-zinc-400 truncate">{productName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleConfirm} className="p-3.5 sm:p-4 space-y-3">
          {/* Top Real-time Calculation Card (matches screenshot top header) */}
          <div className="p-3 bg-[#0a0d14] rounded-2xl border border-white/10 shadow-inner">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Cálculo en vivo:</span>
              <span className="font-mono text-xs sm:text-sm text-amber-300 font-bold">
                ({numBultos} bultos × {numUnitsPerBulk}) + {numLooseUnits}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
              <span className="text-xs sm:text-sm font-semibold text-white">
                Total Unidades Físicas:
              </span>
              <div className="flex items-baseline gap-1 font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                <span>{calculatedTotal.toLocaleString()}</span>
                <span className="text-xs font-normal text-zinc-400">uds</span>
              </div>
            </div>
          </div>

          {/* 3 Main Visual Rows (Visual Card Layout from Screenshot_2026-09-26-12-24-38-687.jpg) */}
          <div className="space-y-2.5">
            {/* Row 1: Cantidad de Bultos / Packs */}
            <div className="flex items-center bg-[#0d1018] border border-amber-500/25 hover:border-amber-500/40 rounded-2xl p-2.5 sm:p-3 transition-colors shadow-sm">
              {/* Left Big 3D Isometric Boxes Icon */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center bg-black/40 rounded-2xl border border-amber-500/20 flex-shrink-0">
                <IsometricBoxesIcon />
              </div>

              {/* Right Content: Title + Big Number */}
              <div className="flex-1 min-w-0 pl-3 sm:pl-4">
                <label
                  htmlFor="bulk-modal-bultos-input"
                  className="block text-xs sm:text-sm font-extrabold text-amber-400 tracking-wide cursor-pointer truncate"
                >
                  Cantidad de Bultos / Packs
                </label>
                <div className="flex items-center justify-between mt-0.5">
                  <input
                    ref={bultosInputRef}
                    id="bulk-modal-bultos-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={bultos}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setBultos(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full bg-transparent border-0 p-0 text-3xl sm:text-4xl font-mono font-black text-amber-300 focus:outline-none placeholder:text-zinc-700"
                  />
                  {bultos && (
                    <button
                      type="button"
                      onClick={() => setBultos('')}
                      className="text-[10px] font-bold text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 ml-2 flex-shrink-0"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Unidades que trae cada Bulto */}
            <div className="flex items-center bg-[#0d1018] border border-sky-500/25 hover:border-sky-500/40 rounded-2xl p-2.5 sm:p-3 transition-colors shadow-sm">
              {/* Left Big 3D Stacked Layers Icon */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center bg-black/40 rounded-2xl border border-sky-500/20 flex-shrink-0">
                <StackedLayersIcon />
              </div>

              {/* Right Content: Title + Big Number */}
              <div className="flex-1 min-w-0 pl-3 sm:pl-4">
                <label
                  htmlFor="bulk-modal-units-per-bulk-input"
                  className="block text-xs sm:text-sm font-extrabold text-sky-400 tracking-wide cursor-pointer truncate"
                >
                  Unidades que trae cada Bulto:
                </label>
                <div className="flex items-center justify-between mt-0.5">
                  <input
                    id="bulk-modal-units-per-bulk-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={unitsPerBulk}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setUnitsPerBulk(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="12"
                    className="w-full bg-transparent border-0 p-0 text-2xl sm:text-3xl font-mono font-black text-sky-300 focus:outline-none placeholder:text-zinc-700"
                  />
                  <span className="text-xs font-bold text-zinc-500 font-mono flex-shrink-0">
                    uds/cj
                  </span>
                </div>
              </div>
            </div>

            {/* Row 3: Unidades Sueltas */}
            <div className="flex items-center bg-[#0d1018] border border-teal-500/25 hover:border-teal-500/40 rounded-2xl p-2.5 sm:p-3 transition-colors shadow-sm">
              {/* Left Big Neon Plus Circle Icon */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center bg-black/40 rounded-2xl border border-teal-500/20 flex-shrink-0">
                <PlusCircleNeonIcon />
              </div>

              {/* Right Content: Title + Big Number */}
              <div className="flex-1 min-w-0 pl-3 sm:pl-4">
                <label
                  htmlFor="bulk-modal-loose-units-input"
                  className="block text-xs sm:text-sm font-extrabold text-teal-400 tracking-wide cursor-pointer truncate"
                >
                  Unidades Sueltas:
                </label>
                <div className="flex items-center justify-between mt-0.5">
                  <input
                    id="bulk-modal-loose-units-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={looseUnits}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setLooseUnits(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full bg-transparent border-0 p-0 text-3xl sm:text-4xl font-mono font-black text-emerald-400 focus:outline-none placeholder:text-zinc-700"
                  />
                  <span className="text-xs font-bold text-zinc-500 font-mono flex-shrink-0">
                    sueltas
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Keypad Grid of Boxes (matches Screenshot 3x3 layout) */}
          <div className="pt-1">
            <div className="grid grid-cols-3 gap-2">
              {/* Row 1: [ 1 Cj ]  [ 2 Cj ]  [ 3 Cj ] */}
              <button
                type="button"
                id="btn-quick-1cj"
                onClick={() => handleAddBultos(1)}
                className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
              >
                1 Cj
              </button>
              <button
                type="button"
                id="btn-quick-2cj"
                onClick={() => handleAddBultos(2)}
                className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
              >
                2 Cj
              </button>
              <button
                type="button"
                id="btn-quick-3cj"
                onClick={() => handleAddBultos(3)}
                className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
              >
                3 Cj
              </button>

              {/* Row 2: [ 5 Cj ]  [ 10 Cj ] [ 20 Cj ] */}
              <button
                type="button"
                id="btn-quick-5cj"
                onClick={() => handleAddBultos(5)}
                className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
              >
                5 Cj
              </button>
              <button
                type="button"
                id="btn-quick-10cj"
                onClick={() => handleAddBultos(10)}
                className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
              >
                10 Cj
              </button>
              <button
                type="button"
                id="btn-quick-20cj"
                onClick={() => handleAddBultos(20)}
                className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
              >
                20 Cj
              </button>

              {/* Row 3: [ 50 Cj ] [ + 1 Cj ]  [ - 1 Cj ] */}
              <button
                type="button"
                id="btn-quick-50cj"
                onClick={() => handleAddBultos(50)}
                className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
              >
                50 Cj
              </button>
              <button
                type="button"
                id="btn-quick-plus1cj"
                onClick={() => handleAddBultos(1)}
                className="h-11 sm:h-12 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/80 active:bg-emerald-800 text-emerald-300 font-mono font-black text-sm sm:text-base border border-emerald-500/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm select-none"
                title="Sumar 1 bulto"
              >
                + 1 Cj
              </button>
              <button
                type="button"
                id="btn-quick-minus1cj"
                onClick={() => handleAddBultos(-1)}
                className="h-11 sm:h-12 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-800 text-rose-300 font-mono font-black text-sm sm:text-base border border-rose-500/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm select-none"
                title="Restar 1 bulto"
              >
                – 1 Cj
              </button>
            </div>
          </div>

          {/* Bottom Confirm Button: Vibrant Green with double check icon (matching Screenshot) */}
          <div className="pt-1.5">
            <button
              id="btn-confirm-bulk-to-units"
              type="submit"
              className="w-full py-3.5 px-4 bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white font-black text-base sm:text-lg rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-6 h-6 stroke-[3]" />
              <span>✓ Confirmar Ingreso ({calculatedTotal.toLocaleString()} uds)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
