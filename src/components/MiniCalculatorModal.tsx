import React, { useState, useEffect } from 'react';
import { Calculator, X, Delete, Check, Sparkles } from 'lucide-react';
import { Sound } from '../services/sound';

interface MiniCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (value: number) => void;
  initialValue?: number;
  title?: string;
  subtitle?: string;
  unitsPerBulk?: number;
  bulkUnitName?: string;
}

/**
 * Safely evaluates mathematical expressions (e.g. "120 * 24", "10 + 5 * 12", etc.)
 * without using dangerous eval().
 */
export function evaluateMathExpression(expr: string): number | null {
  try {
    // Sanitize string to allow only digits, decimal point, operators and parentheses
    const sanitized = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.')
      .replace(/[^0-9+\-*/().]/g, '');

    if (!sanitized.trim()) return null;

    // Reject malicious or unbalanced constructs
    if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) return null;

    // Use Function constructor in a closed scope to compute numeric value
    // eslint-disable-next-line no-new-func
    const computed = Function(`"use strict"; return (${sanitized})`)();
    if (typeof computed === 'number' && !isNaN(computed) && isFinite(computed)) {
      return computed;
    }
    return null;
  } catch {
    return null;
  }
}

export const MiniCalculatorModal: React.FC<MiniCalculatorModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialValue,
  title = 'Calculadora Rápida',
  subtitle = 'Multiplica bultos × unidades, suma stock y aplica el resultado directo',
  unitsPerBulk,
  bulkUnitName,
}) => {
  const [expression, setExpression] = useState<string>('');
  const [liveResult, setLiveResult] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialValue && initialValue > 0) {
        setExpression(String(initialValue));
        setLiveResult(initialValue);
      } else {
        setExpression('');
        setLiveResult(0);
      }
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    if (!expression.trim()) {
      setLiveResult(null);
      return;
    }
    const val = evaluateMathExpression(expression);
    setLiveResult(val !== null ? Math.round(val * 100) / 100 : null);
  }, [expression]);

  if (!isOpen) return null;

  const handleAppend = (char: string) => {
    setExpression((prev) => {
      // Avoid double operators
      const operators = ['+', '-', '*', '/', '×', '÷'];
      if (operators.includes(char) && operators.includes(prev.slice(-1))) {
        return prev.slice(0, -1) + char;
      }
      return prev + char;
    });
  };

  const handleClear = () => {
    setExpression('');
    setLiveResult(null);
  };

  const handleBackspace = () => {
    setExpression((prev) => prev.slice(0, -1));
  };

  const handleApplyResult = () => {
    const finalVal = liveResult !== null ? liveResult : evaluateMathExpression(expression);
    if (finalVal !== null && finalVal >= 0) {
      Sound.playSuccessChime();
      onApply(Math.round(finalVal));
      onClose();
    } else {
      Sound.playWarningBeep();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyResult();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      id="mini-calculator-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div className="relative w-full max-w-sm bg-[#151822] border border-teal-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#10131c]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{title}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Auto-cálculo
                </span>
              </h3>
              <p className="text-[10px] text-zinc-400 truncate max-w-[210px]">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="p-3.5 bg-[#0b0e14] border-b border-white/5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
            <span>Operación:</span>
            {unitsPerBulk && unitsPerBulk > 1 && (
              <span className="text-amber-400/90 font-mono text-[10px]">
                📦 {bulkUnitName || 'Bulto'}: x{unitsPerBulk} uds
              </span>
            )}
          </div>
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="ej: 120 * 24 + 10"
            autoFocus
            className="w-full bg-transparent text-right font-mono text-xl text-white font-bold tracking-wider focus:outline-none placeholder:text-zinc-600"
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Resultado Final:
            </span>
            <span className="font-mono text-xl font-extrabold text-teal-400">
              {liveResult !== null ? liveResult.toLocaleString() : '---'}{' '}
              <span className="text-xs font-normal text-zinc-400">uds</span>
            </span>
          </div>
        </div>

        {/* Quick Bulk Presets if unitsPerBulk is known */}
        {unitsPerBulk && unitsPerBulk > 1 && (
          <div className="px-3 pt-2.5 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-[10px] text-zinc-500 whitespace-nowrap">Bultos:</span>
            {[1, 2, 5, 10, 20].map((bultos) => (
              <button
                key={bultos}
                type="button"
                onClick={() => setExpression(`${bultos} * ${unitsPerBulk}`)}
                className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-mono text-[10px] whitespace-nowrap transition-colors"
                title={`${bultos} bulto(s) × ${unitsPerBulk} uds`}
              >
                {bultos} cj ({bultos * unitsPerBulk})
              </button>
            ))}
          </div>
        )}

        {/* Keypad Grid */}
        <div className="p-3 grid grid-cols-4 gap-2">
          {/* Row 1 */}
          <button
            type="button"
            onClick={handleClear}
            className="h-11 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-sm border border-rose-500/20 active:scale-95 transition-all"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleAppend('(')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-sm border border-white/5 active:scale-95 transition-all"
          >
            (
          </button>
          <button
            type="button"
            onClick={() => handleAppend(')')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-sm border border-white/5 active:scale-95 transition-all"
          >
            )
          </button>
          <button
            type="button"
            onClick={() => handleAppend('/')}
            className="h-11 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-base border border-indigo-500/30 active:scale-95 transition-all"
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            type="button"
            onClick={() => handleAppend('7')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleAppend('8')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleAppend('9')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleAppend('*')}
            className="h-11 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-base border border-amber-500/30 active:scale-95 transition-all"
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            type="button"
            onClick={() => handleAppend('4')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleAppend('5')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleAppend('6')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleAppend('-')}
            className="h-11 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-base border border-indigo-500/30 active:scale-95 transition-all"
          >
            -
          </button>

          {/* Row 4 */}
          <button
            type="button"
            onClick={() => handleAppend('1')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleAppend('2')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleAppend('3')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handleAppend('+')}
            className="h-11 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-base border border-indigo-500/30 active:scale-95 transition-all"
          >
            +
          </button>

          {/* Row 5 */}
          <button
            type="button"
            onClick={() => handleAppend('0')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleAppend('.')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/5 active:scale-95 transition-all"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 font-bold text-sm border border-white/5 active:scale-95 transition-all flex items-center justify-center"
            title="Borrar último dígito"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (liveResult !== null) {
                setExpression(String(liveResult));
              }
            }}
            className="h-11 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold text-base border border-teal-500/30 active:scale-95 transition-all"
            title="Calcular"
          >
            =
          </button>
        </div>

        {/* Footer Apply Button */}
        <div className="p-3 border-t border-white/10 bg-[#10131c]">
          <button
            type="button"
            id="btn-apply-calculator-result"
            onClick={handleApplyResult}
            disabled={liveResult === null || liveResult < 0}
            className="w-full py-3 px-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 disabled:opacity-40 text-black font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              Inyectar Resultado {liveResult !== null ? `(${liveResult.toLocaleString()} uds)` : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
