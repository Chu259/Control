import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ArrowDownLeft, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { Sound } from '../services/sound';

export interface BulkToUnitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (totalUnits: number) => void;
  onConfirmMovement?: (totalUnits: number, type: 'in' | 'out') => void;
  movementType?: 'in' | 'out'; // When provided, works in Entrada or Salida mode
  initialUnitsPerBulk?: number;
  bulkUnitName?: string;
  productName?: string;
  currentStock?: number;
}

type ActiveField = 'unitsPerBulk' | 'bultos' | 'looseUnits';

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
  onConfirmMovement,
  movementType,
  initialUnitsPerBulk = 12,
  bulkUnitName = 'Bulto',
  productName,
  currentStock,
}) => {
  // Memory cleanup on open: Bultos and loose units reset to empty every time
  const [bultos, setBultos] = useState<string>('');
  const [unitsPerBulk, setUnitsPerBulk] = useState<string>(
    String(initialUnitsPerBulk > 0 ? initialUnitsPerBulk : 12)
  );
  const [looseUnits, setLooseUnits] = useState<string>('');
  
  // Requirement 4: Initial active field is 'bultos' by default
  const [activeField, setActiveField] = useState<ActiveField>('bultos');

  const bultosInputRef = useRef<HTMLInputElement>(null);
  const unitsPerBulkInputRef = useRef<HTMLInputElement>(null);
  const looseUnitsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const upb = initialUnitsPerBulk > 0 ? initialUnitsPerBulk : 12;
      setUnitsPerBulk(String(upb));
      setBultos('');
      setLooseUnits('');
      // Requirement 4: Foco por defecto en Cantidad de Bultos
      setActiveField('bultos');

      setTimeout(() => {
        if (bultosInputRef.current) {
          bultosInputRef.current.focus();
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

  // Requirement 3: Contextual Keypad Actions
  // 1. For Bultos (Campo Naranja): Accumulative addition/subtraction
  const handleBultosKey = (amount: number) => {
    Sound.playScanBeep();
    setBultos((prev) => {
      const current = parseInt(prev, 10) || 0;
      const next = Math.max(0, current + amount);
      return next > 0 ? String(next) : '';
    });
  };

  // 2. For UnitsPerBulk (Campo Azul): Factory standard presets or +/- 1
  const handleUnitsPerBulkPreset = (val: number) => {
    Sound.playScanBeep();
    setUnitsPerBulk(String(val));
  };

  const handleUnitsPerBulkAdjust = (delta: number) => {
    Sound.playScanBeep();
    setUnitsPerBulk((prev) => {
      const current = parseInt(prev, 10) || 0;
      const next = Math.max(1, current + delta);
      return String(next);
    });
  };

  const handleClearUnitsPerBulk = () => {
    Sound.playScanBeep();
    setUnitsPerBulk('');
  };

  // 3. For LooseUnits (Campo Verde Agua): Accumulative addition/subtraction
  const handleLooseUnitsKey = (amount: number) => {
    Sound.playScanBeep();
    setLooseUnits((prev) => {
      const current = parseInt(prev, 10) || 0;
      const next = Math.max(0, current + amount);
      return next > 0 ? String(next) : '';
    });
  };

  const handleClearLooseUnits = () => {
    Sound.playScanBeep();
    setLooseUnits('');
  };

  const handleConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (calculatedTotal <= 0) {
      Sound.playWarningBeep();
      return;
    }
    Sound.playSuccessChime();

    if (movementType && onConfirmMovement) {
      onConfirmMovement(calculatedTotal, movementType);
    } else if (onConfirm) {
      onConfirm(calculatedTotal);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Determine modal theme & labels based on movementType ('in' | 'out' | undefined)
  const isEntry = movementType === 'in';
  const isExit = movementType === 'out';
  const isMovement = isEntry || isExit;

  const titleText = isEntry
    ? 'Asistente de Entrada por Bultos'
    : isExit
    ? 'Asistente de Salida por Bultos'
    : 'Asistente de Carga por Bultos';

  const badgeColor = isEntry
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    : isExit
    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

  const badgeText = isEntry ? '+ ENTRADA' : isExit ? '- SALIDA' : '📦 BULTOS';

  const resultingStock =
    currentStock !== undefined
      ? isEntry
        ? currentStock + calculatedTotal
        : Math.max(0, currentStock - calculatedTotal)
      : null;

  return (
    <div
      id="bulk-to-units-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div
        className={`relative w-full max-w-sm sm:max-w-md bg-[#131620] border ${
          isExit ? 'border-rose-500/30' : isEntry ? 'border-emerald-500/30' : 'border-amber-500/25'
        } rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0e111a]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl ${
                isExit
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : isEntry
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              } flex items-center justify-center border flex-shrink-0`}
            >
              {isEntry ? (
                <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
              ) : isExit ? (
                <ArrowUpRight className="w-4 h-4 stroke-[3]" />
              ) : (
                <span className="font-mono text-sm font-black">📦</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">{titleText}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${badgeColor}`}>
                  {badgeText}
                </span>
              </div>
              {productName && (
                <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-medium">{productName}</p>
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
          {/* Top Real-time Calculation Card */}
          <div className="p-3 bg-[#0a0d14] rounded-2xl border border-white/10 shadow-inner">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Cálculo en vivo:</span>
              <span className="font-mono text-xs sm:text-sm text-amber-300 font-bold">
                ({numBultos} bultos × {numUnitsPerBulk}) + {numLooseUnits}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
              <span className="text-xs sm:text-sm font-semibold text-white">
                {isEntry
                  ? 'Total Unidades a Sumar:'
                  : isExit
                  ? 'Total Unidades a Restar:'
                  : 'Total Unidades Físicas:'}
              </span>
              <div
                className={`flex items-baseline gap-1 font-mono text-2xl sm:text-3xl font-black ${
                  isExit ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                <span>
                  {isEntry ? '+' : isExit ? '–' : ''}
                  {calculatedTotal.toLocaleString()}
                </span>
                <span className="text-xs font-normal text-zinc-400">uds</span>
              </div>
            </div>

            {/* Impact preview when in stock movement mode */}
            {isMovement && currentStock !== undefined && (
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Impacto en Stock:</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-zinc-400">{currentStock} uds</span>
                  <span className="text-zinc-500">→</span>
                  <span className={isExit ? 'text-rose-300' : 'text-emerald-300'}>
                    {resultingStock} uds
                  </span>
                </div>
              </div>
            )}

            {/* Warning if Exit exceeds physical stock */}
            {isExit && currentStock !== undefined && calculatedTotal > currentStock && (
              <div className="mt-2 p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span>Atención: El egreso ({calculatedTotal} uds) supera el stock registrado ({currentStock} uds).</span>
              </div>
            )}
          </div>

          {/* REQUIREMENT 1: Reordered fields with Field 1 (Azul) at the top */}
          <div className="space-y-2.5">
            {/* Field 1 (AZUL): Unidades que trae cada Bulto (Top priority data base) */}
            <div
              onClick={() => {
                setActiveField('unitsPerBulk');
                unitsPerBulkInputRef.current?.focus();
              }}
              className={`flex items-center rounded-2xl p-2.5 sm:p-3 transition-all shadow-sm cursor-pointer ${
                activeField === 'unitsPerBulk'
                  ? 'bg-[#0b172a] border-2 border-sky-400 ring-2 ring-sky-400/30'
                  : 'bg-[#0d1018] border border-sky-500/25 hover:border-sky-500/40'
              }`}
            >
              {/* Left Big 3D Stacked Layers Icon */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center bg-black/40 rounded-2xl border border-sky-500/20 flex-shrink-0">
                <StackedLayersIcon />
              </div>

              {/* Right Content: Title + Big Number */}
              <div className="flex-1 min-w-0 pl-3 sm:pl-4">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="bulk-modal-units-per-bulk-input"
                    className="block text-xs sm:text-sm font-extrabold text-sky-400 tracking-wide cursor-pointer truncate"
                  >
                    Unidades que trae cada Bulto:
                  </label>
                  {activeField === 'unitsPerBulk' && (
                    <span className="text-[9px] font-bold text-sky-300 bg-sky-500/20 border border-sky-500/40 px-1.5 py-0.5 rounded-md">
                      Activo
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  {/* REQUIREMENT 2: inputMode="none" to block Android native software keyboard */}
                  <input
                    ref={unitsPerBulkInputRef}
                    id="bulk-modal-units-per-bulk-input"
                    type="text"
                    inputMode="none"
                    value={unitsPerBulk}
                    onFocus={() => setActiveField('unitsPerBulk')}
                    readOnly
                    placeholder="12"
                    className="w-full bg-transparent border-0 p-0 text-2xl sm:text-3xl font-mono font-black text-sky-300 focus:outline-none placeholder:text-zinc-700 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-500 font-mono flex-shrink-0">
                    uds/cj
                  </span>
                </div>
              </div>
            </div>

            {/* Field 2 (NARANJA/ÁMBAR): Cantidad de Bultos / Packs */}
            <div
              onClick={() => {
                setActiveField('bultos');
                bultosInputRef.current?.focus();
              }}
              className={`flex items-center rounded-2xl p-2.5 sm:p-3 transition-all shadow-sm cursor-pointer ${
                activeField === 'bultos'
                  ? 'bg-[#1a1308] border-2 border-amber-400 ring-2 ring-amber-400/30'
                  : 'bg-[#0d1018] border border-amber-500/25 hover:border-amber-500/40'
              }`}
            >
              {/* Left Big 3D Isometric Boxes Icon */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center bg-black/40 rounded-2xl border border-amber-500/20 flex-shrink-0">
                <IsometricBoxesIcon />
              </div>

              {/* Right Content: Title + Big Number */}
              <div className="flex-1 min-w-0 pl-3 sm:pl-4">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="bulk-modal-bultos-input"
                    className="block text-xs sm:text-sm font-extrabold text-amber-400 tracking-wide cursor-pointer truncate"
                  >
                    Cantidad de Bultos / Packs
                  </label>
                  {activeField === 'bultos' && (
                    <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded-md">
                      Activo
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  {/* REQUIREMENT 2: inputMode="none" to block Android native software keyboard */}
                  <input
                    ref={bultosInputRef}
                    id="bulk-modal-bultos-input"
                    type="text"
                    inputMode="none"
                    value={bultos}
                    onFocus={() => setActiveField('bultos')}
                    readOnly
                    placeholder="0"
                    className="w-full bg-transparent border-0 p-0 text-3xl sm:text-4xl font-mono font-black text-amber-300 focus:outline-none placeholder:text-zinc-700 cursor-pointer"
                  />
                  {bultos && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBultos('');
                        setActiveField('bultos');
                      }}
                      className="text-[10px] font-bold text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 ml-2 flex-shrink-0"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Field 3 (VERDE AGUA/TEAL): Unidades Sueltas */}
            <div
              onClick={() => {
                setActiveField('looseUnits');
                looseUnitsInputRef.current?.focus();
              }}
              className={`flex items-center rounded-2xl p-2.5 sm:p-3 transition-all shadow-sm cursor-pointer ${
                activeField === 'looseUnits'
                  ? 'bg-[#081a17] border-2 border-teal-400 ring-2 ring-teal-400/30'
                  : 'bg-[#0d1018] border border-teal-500/25 hover:border-teal-500/40'
              }`}
            >
              {/* Left Big Neon Plus Circle Icon */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center bg-black/40 rounded-2xl border border-teal-500/20 flex-shrink-0">
                <PlusCircleNeonIcon />
              </div>

              {/* Right Content: Title + Big Number */}
              <div className="flex-1 min-w-0 pl-3 sm:pl-4">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="bulk-modal-loose-units-input"
                    className="block text-xs sm:text-sm font-extrabold text-teal-400 tracking-wide cursor-pointer truncate"
                  >
                    Unidades Sueltas:
                  </label>
                  {activeField === 'looseUnits' && (
                    <span className="text-[9px] font-bold text-teal-300 bg-teal-500/20 border border-teal-500/40 px-1.5 py-0.5 rounded-md">
                      Activo
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  {/* REQUIREMENT 2: inputMode="none" to block Android native software keyboard */}
                  <input
                    ref={looseUnitsInputRef}
                    id="bulk-modal-loose-units-input"
                    type="text"
                    inputMode="none"
                    value={looseUnits}
                    onFocus={() => setActiveField('looseUnits')}
                    readOnly
                    placeholder="0"
                    className="w-full bg-transparent border-0 p-0 text-3xl sm:text-4xl font-mono font-black text-emerald-400 focus:outline-none placeholder:text-zinc-700 cursor-pointer"
                  />
                  {looseUnits && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLooseUnits('');
                        setActiveField('looseUnits');
                      }}
                      className="text-[10px] font-bold text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 ml-2 flex-shrink-0"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* REQUIREMENT 3: DYNAMIC CONTEXTUAL KEYPAD GRID BASED ON activeField */}
          <div className="pt-1">
            {/* Header info indicating which field is controlled */}
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span
                className={`text-[11px] font-black uppercase tracking-wider ${
                  activeField === 'unitsPerBulk'
                    ? 'text-sky-400'
                    : activeField === 'bultos'
                    ? 'text-amber-400'
                    : 'text-teal-400'
                }`}
              >
                {activeField === 'unitsPerBulk'
                  ? 'Packs de Fábrica (Unidades por Bulto):'
                  : activeField === 'bultos'
                  ? 'Bultos Rápidos Acumulativos (Sumar):'
                  : 'Unidades Sueltas Rápidas (Sumar):'}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {activeField === 'unitsPerBulk'
                  ? `${unitsPerBulk || 0} uds/cj`
                  : activeField === 'bultos'
                  ? `${numBultos} bulto(s)`
                  : `${numLooseUnits} suelta(s)`}
              </span>
            </div>

            {/* KEYPAD VARIANT 1: UNIDADES POR BULTO (CAMPO AZUL) */}
            {activeField === 'unitsPerBulk' && (
              <div className="grid grid-cols-3 gap-2 animate-fade-in">
                {/* Row 1: [ 6 ]  [ 12 ]  [ 20 ] */}
                <button
                  type="button"
                  id="btn-upb-6"
                  onClick={() => handleUnitsPerBulkPreset(6)}
                  className={`h-11 sm:h-12 rounded-2xl font-mono font-black text-base border active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none ${
                    unitsPerBulk === '6'
                      ? 'bg-sky-500 text-black border-sky-400 shadow-sky-500/20'
                      : 'bg-[#141b2c] hover:bg-sky-500/20 text-white hover:text-sky-300 border-white/10 hover:border-sky-500/40'
                  }`}
                >
                  6
                </button>
                <button
                  type="button"
                  id="btn-upb-12"
                  onClick={() => handleUnitsPerBulkPreset(12)}
                  className={`h-11 sm:h-12 rounded-2xl font-mono font-black text-base border active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none ${
                    unitsPerBulk === '12'
                      ? 'bg-sky-500 text-black border-sky-400 shadow-sky-500/20'
                      : 'bg-[#141b2c] hover:bg-sky-500/20 text-white hover:text-sky-300 border-white/10 hover:border-sky-500/40'
                  }`}
                >
                  12
                </button>
                <button
                  type="button"
                  id="btn-upb-20"
                  onClick={() => handleUnitsPerBulkPreset(20)}
                  className={`h-11 sm:h-12 rounded-2xl font-mono font-black text-base border active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none ${
                    unitsPerBulk === '20'
                      ? 'bg-sky-500 text-black border-sky-400 shadow-sky-500/20'
                      : 'bg-[#141b2c] hover:bg-sky-500/20 text-white hover:text-sky-300 border-white/10 hover:border-sky-500/40'
                  }`}
                >
                  20
                </button>

                {/* Row 2: [ 24 ]  [ 30 ]  [ 36 ] */}
                <button
                  type="button"
                  id="btn-upb-24"
                  onClick={() => handleUnitsPerBulkPreset(24)}
                  className={`h-11 sm:h-12 rounded-2xl font-mono font-black text-base border active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none ${
                    unitsPerBulk === '24'
                      ? 'bg-sky-500 text-black border-sky-400 shadow-sky-500/20'
                      : 'bg-[#141b2c] hover:bg-sky-500/20 text-white hover:text-sky-300 border-white/10 hover:border-sky-500/40'
                  }`}
                >
                  24
                </button>
                <button
                  type="button"
                  id="btn-upb-30"
                  onClick={() => handleUnitsPerBulkPreset(30)}
                  className={`h-11 sm:h-12 rounded-2xl font-mono font-black text-base border active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none ${
                    unitsPerBulk === '30'
                      ? 'bg-sky-500 text-black border-sky-400 shadow-sky-500/20'
                      : 'bg-[#141b2c] hover:bg-sky-500/20 text-white hover:text-sky-300 border-white/10 hover:border-sky-500/40'
                  }`}
                >
                  30
                </button>
                <button
                  type="button"
                  id="btn-upb-36"
                  onClick={() => handleUnitsPerBulkPreset(36)}
                  className={`h-11 sm:h-12 rounded-2xl font-mono font-black text-base border active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none ${
                    unitsPerBulk === '36'
                      ? 'bg-sky-500 text-black border-sky-400 shadow-sky-500/20'
                      : 'bg-[#141b2c] hover:bg-sky-500/20 text-white hover:text-sky-300 border-white/10 hover:border-sky-500/40'
                  }`}
                >
                  36
                </button>

                {/* Row 3: [ +1 ]  [ -1 ]  [ Borrar ] */}
                <button
                  type="button"
                  id="btn-upb-plus1"
                  onClick={() => handleUnitsPerBulkAdjust(1)}
                  className="h-11 sm:h-12 rounded-2xl bg-sky-950/60 hover:bg-sky-900/80 active:bg-sky-800 text-sky-300 font-mono font-black text-sm sm:text-base border border-sky-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                  title="Sumar 1 unidad al bulto"
                >
                  +1
                </button>
                <button
                  type="button"
                  id="btn-upb-minus1"
                  onClick={() => handleUnitsPerBulkAdjust(-1)}
                  className="h-11 sm:h-12 rounded-2xl bg-sky-950/60 hover:bg-sky-900/80 active:bg-sky-800 text-sky-300 font-mono font-black text-sm sm:text-base border border-sky-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                  title="Restar 1 unidad al bulto"
                >
                  -1
                </button>
                <button
                  type="button"
                  id="btn-upb-clear"
                  onClick={handleClearUnitsPerBulk}
                  className="h-11 sm:h-12 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-800 text-rose-300 font-mono font-black text-sm sm:text-base border border-rose-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                  title="Borrar unidades"
                >
                  Borrar
                </button>
              </div>
            )}

            {/* KEYPAD VARIANT 2: CANTIDAD DE BULTOS / PACKS (CAMPO NARANJA) */}
            {activeField === 'bultos' && (
              <div className="grid grid-cols-3 gap-2 animate-fade-in">
                {/* Row 1: [ 1 Cj ]  [ 2 Cj ]  [ 3 Cj ] */}
                <button
                  type="button"
                  id="btn-quick-1cj"
                  onClick={() => handleBultosKey(1)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  1 Cj
                </button>
                <button
                  type="button"
                  id="btn-quick-2cj"
                  onClick={() => handleBultosKey(2)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  2 Cj
                </button>
                <button
                  type="button"
                  id="btn-quick-3cj"
                  onClick={() => handleBultosKey(3)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  3 Cj
                </button>

                {/* Row 2: [ 5 Cj ]  [ 10 Cj ] [ 20 Cj ] */}
                <button
                  type="button"
                  id="btn-quick-5cj"
                  onClick={() => handleBultosKey(5)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  5 Cj
                </button>
                <button
                  type="button"
                  id="btn-quick-10cj"
                  onClick={() => handleBultosKey(10)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  10 Cj
                </button>
                <button
                  type="button"
                  id="btn-quick-20cj"
                  onClick={() => handleBultosKey(20)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  20 Cj
                </button>

                {/* Row 3: [ 50 Cj ] [ +1 Cj ]  [ -1 Cj ] */}
                <button
                  type="button"
                  id="btn-quick-50cj"
                  onClick={() => handleBultosKey(50)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#1b1f2c] hover:bg-amber-500/20 active:bg-amber-500/30 text-white hover:text-amber-300 font-mono font-black text-sm sm:text-base border border-white/10 hover:border-amber-500/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  50 Cj
                </button>
                <button
                  type="button"
                  id="btn-quick-plus1cj"
                  onClick={() => handleBultosKey(1)}
                  className="h-11 sm:h-12 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/80 active:bg-emerald-800 text-emerald-300 font-mono font-black text-sm sm:text-base border border-emerald-500/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm select-none"
                  title="Sumar 1 bulto"
                >
                  +1 Cj
                </button>
                <button
                  type="button"
                  id="btn-quick-minus1cj"
                  onClick={() => handleBultosKey(-1)}
                  className="h-11 sm:h-12 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-800 text-rose-300 font-mono font-black text-sm sm:text-base border border-rose-500/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm select-none"
                  title="Restar 1 bulto"
                >
                  -1 Cj
                </button>
              </div>
            )}

            {/* KEYPAD VARIANT 3: UNIDADES SUELTAS (CAMPO VERDE AGUA) - IDÉNTICA EN ESTRUCTURA A BULTOS */}
            {activeField === 'looseUnits' && (
              <div className="grid grid-cols-3 gap-2 animate-fade-in">
                {/* Row 1: [ 1 Ud ]  [ 2 Ud ]  [ 3 Ud ] */}
                <button
                  type="button"
                  id="btn-loose-1ud"
                  onClick={() => handleLooseUnitsKey(1)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#122220] hover:bg-teal-500/20 active:bg-teal-500/30 text-white hover:text-emerald-300 font-mono font-black text-sm sm:text-base border border-teal-500/30 hover:border-teal-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  1 Ud
                </button>
                <button
                  type="button"
                  id="btn-loose-2ud"
                  onClick={() => handleLooseUnitsKey(2)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#122220] hover:bg-teal-500/20 active:bg-teal-500/30 text-white hover:text-emerald-300 font-mono font-black text-sm sm:text-base border border-teal-500/30 hover:border-teal-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  2 Ud
                </button>
                <button
                  type="button"
                  id="btn-loose-3ud"
                  onClick={() => handleLooseUnitsKey(3)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#122220] hover:bg-teal-500/20 active:bg-teal-500/30 text-white hover:text-emerald-300 font-mono font-black text-sm sm:text-base border border-teal-500/30 hover:border-teal-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  3 Ud
                </button>

                {/* Row 2: [ 5 Ud ]  [ 10 Ud ] [ 20 Ud ] */}
                <button
                  type="button"
                  id="btn-loose-5ud"
                  onClick={() => handleLooseUnitsKey(5)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#122220] hover:bg-teal-500/20 active:bg-teal-500/30 text-white hover:text-emerald-300 font-mono font-black text-sm sm:text-base border border-teal-500/30 hover:border-teal-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  5 Ud
                </button>
                <button
                  type="button"
                  id="btn-loose-10ud"
                  onClick={() => handleLooseUnitsKey(10)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#122220] hover:bg-teal-500/20 active:bg-teal-500/30 text-white hover:text-emerald-300 font-mono font-black text-sm sm:text-base border border-teal-500/30 hover:border-teal-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  10 Ud
                </button>
                <button
                  type="button"
                  id="btn-loose-20ud"
                  onClick={() => handleLooseUnitsKey(20)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#122220] hover:bg-teal-500/20 active:bg-teal-500/30 text-white hover:text-emerald-300 font-mono font-black text-sm sm:text-base border border-teal-500/30 hover:border-teal-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  20 Ud
                </button>

                {/* Row 3: [ 50 Ud ] [ +1 Ud ]  [ -1 Ud ] */}
                <button
                  type="button"
                  id="btn-loose-50ud"
                  onClick={() => handleLooseUnitsKey(50)}
                  className="h-11 sm:h-12 rounded-2xl bg-[#122220] hover:bg-teal-500/20 active:bg-teal-500/30 text-white hover:text-emerald-300 font-mono font-black text-sm sm:text-base border border-teal-500/30 hover:border-teal-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm select-none"
                >
                  50 Ud
                </button>
                <button
                  type="button"
                  id="btn-loose-plus1ud"
                  onClick={() => handleLooseUnitsKey(1)}
                  className="h-11 sm:h-12 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/80 active:bg-emerald-800 text-emerald-300 font-mono font-black text-sm sm:text-base border border-emerald-500/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm select-none"
                  title="Sumar 1 unidad suelta"
                >
                  +1 Ud
                </button>
                <button
                  type="button"
                  id="btn-loose-minus1ud"
                  onClick={() => handleLooseUnitsKey(-1)}
                  className="h-11 sm:h-12 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-800 text-rose-300 font-mono font-black text-sm sm:text-base border border-rose-500/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm select-none"
                  title="Restar 1 unidad suelta"
                >
                  –1 Ud
                </button>
              </div>
            )}
          </div>

          {/* Bottom Confirm Button: Dynamic color and label for Entrada (+X uds), Salida (-X uds) or Ingreso */}
          <div className="pt-1.5">
            <button
              id="btn-confirm-bulk-to-units"
              type="submit"
              disabled={calculatedTotal <= 0}
              className={`w-full py-3.5 px-4 ${
                isExit
                  ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700'
                  : 'bg-[#10b981] hover:bg-[#059669] active:bg-[#047857]'
              } disabled:opacity-40 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer`}
            >
              <Check className="w-6 h-6 stroke-[3]" />
              <span>
                {isEntry
                  ? `✓ Confirmar Entrada (+${calculatedTotal.toLocaleString()} uds)`
                  : isExit
                  ? `✓ Confirmar Salida (–${calculatedTotal.toLocaleString()} uds)`
                  : `✓ Confirmar Ingreso (${calculatedTotal.toLocaleString()} uds)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
