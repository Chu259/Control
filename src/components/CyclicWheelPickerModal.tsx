import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Calendar,
  X,
  Check,
  RotateCw,
  Lock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface CyclicWheelPickerModalProps {
  isOpen: boolean;
  initialTab?: 'day' | 'month';
  selectedDay: number;
  selectedMonth: number;
  selectedYear: number;
  onSelectDay: (day: number) => void;
  onSelectMonth: (month: number) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTH_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const ITEM_HEIGHT = 46; // px per item in the wheel
const VISIBLE_COUNT = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 230px
const CENTER_OFFSET = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2; // 92px
const REPEAT_CYCLES = 9; // Number of cyclic repeats for true infinite loop

export const CyclicWheelPickerModal: React.FC<CyclicWheelPickerModalProps> = ({
  isOpen,
  initialTab = 'day',
  selectedDay,
  selectedMonth,
  selectedYear,
  onSelectDay,
  onSelectMonth,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'day' | 'month'>(initialTab);
  const [viewMode, setViewMode] = useState<'wheel' | 'grid'>('wheel');

  // Scroll containers
  const dayScrollRef = useRef<HTMLDivElement | null>(null);
  const monthScrollRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Sync tab with initialTab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Days 1..31 repeated
  const dayItems = useMemo(() => {
    const arr: number[] = [];
    for (let c = 0; c < REPEAT_CYCLES; c++) {
      for (let d = 1; d <= 31; d++) {
        arr.push(d);
      }
    }
    return arr;
  }, []);

  // Months 1..12 repeated
  const monthItems = useMemo(() => {
    const arr: number[] = [];
    for (let c = 0; c < REPEAT_CYCLES; c++) {
      for (let m = 1; m <= 12; m++) {
        arr.push(m);
      }
    }
    return arr;
  }, []);

  const dayCycleHeight = 31 * ITEM_HEIGHT;
  const monthCycleHeight = 12 * ITEM_HEIGHT;

  // Scroll helper to position the selected value at the center
  const scrollToDay = useCallback(
    (day: number, smooth: boolean = false) => {
      if (!dayScrollRef.current) return;
      // Target middle cycle (cycle index 4 out of 9)
      const targetIndex = 4 * 31 + (day - 1);
      const targetScrollTop = targetIndex * ITEM_HEIGHT;
      if (smooth) {
        dayScrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      } else {
        dayScrollRef.current.scrollTop = targetScrollTop;
      }
    },
    []
  );

  const scrollToMonth = useCallback(
    (month: number, smooth: boolean = false) => {
      if (!monthScrollRef.current) return;
      // Target middle cycle (cycle index 4 out of 9)
      const targetIndex = 4 * 12 + (month - 1);
      const targetScrollTop = targetIndex * ITEM_HEIGHT;
      if (smooth) {
        monthScrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      } else {
        monthScrollRef.current.scrollTop = targetScrollTop;
      }
    },
    []
  );

  // When modal opens or tab changes, position scroll
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (activeTab === 'day') {
        scrollToDay(selectedDay, false);
      } else {
        scrollToMonth(selectedMonth, false);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, activeTab, scrollToDay, scrollToMonth, selectedDay, selectedMonth]);

  // Handle Day Infinite Scroll Loop
  const handleDayScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const currentScrollTop = container.scrollTop;

    // INFINITE CYCLIC LOOP: If close to top or bottom, silently reset scrollTop
    // Cycle 0..8. Middle cycle is 4.
    const minThreshold = 2 * dayCycleHeight;
    const maxThreshold = 7 * dayCycleHeight;

    if (currentScrollTop < minThreshold) {
      container.scrollTop = currentScrollTop + 3 * dayCycleHeight;
      return;
    } else if (currentScrollTop > maxThreshold) {
      container.scrollTop = currentScrollTop - 3 * dayCycleHeight;
      return;
    }

    // Determine currently centered item
    const centerIndex = Math.round(container.scrollTop / ITEM_HEIGHT);
    const dayValue = (centerIndex % 31) + 1;

    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    isUserScrollingRef.current = true;
    scrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      if (dayValue >= 1 && dayValue <= 31 && dayValue !== selectedDay) {
        onSelectDay(dayValue);
      }
    }, 70);
  };

  // Handle Month Infinite Scroll Loop
  const handleMonthScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const currentScrollTop = container.scrollTop;

    // INFINITE CYCLIC LOOP: If close to top or bottom, silently reset scrollTop
    const minThreshold = 2 * monthCycleHeight;
    const maxThreshold = 7 * monthCycleHeight;

    if (currentScrollTop < minThreshold) {
      container.scrollTop = currentScrollTop + 3 * monthCycleHeight;
      return;
    } else if (currentScrollTop > maxThreshold) {
      container.scrollTop = currentScrollTop - 3 * monthCycleHeight;
      return;
    }

    // Determine currently centered item
    const centerIndex = Math.round(container.scrollTop / ITEM_HEIGHT);
    const monthValue = (centerIndex % 12) + 1;

    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    isUserScrollingRef.current = true;
    scrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      if (monthValue >= 1 && monthValue <= 12 && monthValue !== selectedMonth) {
        onSelectMonth(monthValue);
      }
    }, 70);
  };

  // Direct 1-touch tap on a day
  const handleSelectDayDirect = (day: number) => {
    onSelectDay(day);
    scrollToDay(day, true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  // Direct 1-touch tap on a month
  const handleSelectMonthDirect = (month: number) => {
    onSelectMonth(month);
    scrollToMonth(month, true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#161a26] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag bar */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-2.5 sm:hidden" />

        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Selector de Fecha Rodillo</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                  Bucle 360°
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Giro cíclico infinito o toque directo de 1 clic
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection: Día / Mes / Año (Año Congelado) */}
        <div className="p-3 bg-black/20 border-b border-white/5">
          <div className="grid grid-cols-3 gap-2">
            {/* Día Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('day')}
              className={`p-2.5 rounded-2xl border text-center transition-all ${
                activeTab === 'day'
                  ? 'bg-teal-500/20 border-teal-400 text-teal-200 shadow-lg ring-1 ring-teal-400/50'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <span className="text-[10px] font-bold block uppercase tracking-wider text-zinc-400">
                Día (1-31)
              </span>
              <span className="text-xl font-black font-mono block mt-0.5 text-white">
                {String(selectedDay).padStart(2, '0')}
              </span>
              <span className="text-[9px] text-teal-400/90 font-medium block">
                {activeTab === 'day' ? '● En Pantalla' : 'Tocar para abrir'}
              </span>
            </button>

            {/* Mes Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('month')}
              className={`p-2.5 rounded-2xl border text-center transition-all ${
                activeTab === 'month'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-lg ring-1 ring-amber-400/50'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <span className="text-[10px] font-bold block uppercase tracking-wider text-zinc-400">
                Mes (1-12)
              </span>
              <span className="text-xl font-black font-mono block mt-0.5 text-amber-300">
                {String(selectedMonth).padStart(2, '0')}
              </span>
              <span className="text-[9px] text-amber-400/90 font-medium block truncate">
                {MONTH_SHORT[selectedMonth - 1]}
              </span>
            </button>

            {/* Año Tab - Congelado Automáticamente en 2026 */}
            <div className="p-2.5 rounded-2xl border border-white/5 bg-white/[0.02] text-center opacity-80 cursor-not-allowed">
              <span className="text-[10px] font-bold block uppercase tracking-wider text-zinc-500 flex items-center justify-center gap-1">
                <Lock className="w-2.5 h-2.5 text-zinc-500" />
                Año
              </span>
              <span className="text-xl font-black font-mono block mt-0.5 text-zinc-300">
                {selectedYear}
              </span>
              <span className="text-[9px] text-emerald-400 font-semibold block">
                🔒 Congelado
              </span>
            </div>
          </div>

          {/* Quick toggle between Roller Wheel and 1-Touch Grid */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-xs">
            <span className="text-[11px] text-zinc-400">
              Modo de selección:
            </span>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setViewMode('wheel')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'wheel'
                    ? 'bg-teal-500 text-black shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <RotateCw className="w-3 h-3" />
                Rodillo Cíclico 360°
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-amber-500 text-black shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Listado 1-Toque
              </button>
            </div>
          </div>
        </div>

        {/* Body: Wheel or Grid */}
        <div className="p-4 flex-1 overflow-y-auto">
          {viewMode === 'wheel' ? (
            <div className="flex flex-col items-center justify-center">
              {/* Instructions banner */}
              <div className="text-center mb-3">
                <p className="text-xs font-semibold text-zinc-300">
                  {activeTab === 'day'
                    ? 'Desliza el rodillo de días (del 31 pasa al 1 sin trabarse)'
                    : 'Desliza el rodillo de meses (de Diciembre pasa a Enero)'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  También puedes tocar cualquier número para fijarlo al instante
                </p>
              </div>

              {/* Infinite Roller Viewport */}
              <div
                className="relative w-full max-w-[280px] rounded-2xl overflow-hidden bg-black/50 border border-white/10 shadow-inner select-none"
                style={{ height: `${CONTAINER_HEIGHT}px` }}
              >
                {/* Center highlight glass bar */}
                <div
                  className="absolute inset-x-2 rounded-xl pointer-events-none z-10 border-2 transition-all flex items-center justify-between px-3"
                  style={{
                    top: `${CENTER_OFFSET}px`,
                    height: `${ITEM_HEIGHT}px`,
                    borderColor: activeTab === 'day' ? '#2dd4bf' : '#fbbf24',
                    background:
                      activeTab === 'day'
                        ? 'linear-gradient(90deg, rgba(45,212,191,0.15) 0%, rgba(45,212,191,0.05) 100%)'
                        : 'linear-gradient(90deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.05) 100%)',
                    boxShadow:
                      activeTab === 'day'
                        ? '0 0 15px rgba(45,212,191,0.25)'
                        : '0 0 15px rgba(251,191,36,0.25)',
                  }}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      activeTab === 'day' ? 'text-teal-300' : 'text-amber-300'
                    }`}
                  >
                    Fijado
                  </span>
                  <Check
                    className={`w-4 h-4 ${
                      activeTab === 'day' ? 'text-teal-400' : 'text-amber-400'
                    }`}
                  />
                </div>

                {/* Top and Bottom gradient masks */}
                <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-[#161a26] via-[#161a26]/80 to-transparent pointer-events-none z-20" />
                <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#161a26] via-[#161a26]/80 to-transparent pointer-events-none z-20" />

                {/* Day Wheel */}
                {activeTab === 'day' && (
                  <div
                    ref={dayScrollRef}
                    onScroll={handleDayScroll}
                    className="w-full h-full overflow-y-scroll scrollbar-none snap-y snap-mandatory relative z-0"
                    style={{
                      scrollSnapType: 'y mandatory',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {/* Padding top to center first element */}
                    <div style={{ height: `${CENTER_OFFSET}px` }} />

                    {dayItems.map((dayVal, idx) => {
                      const isSelected = dayVal === selectedDay;
                      return (
                        <div
                          key={`day-${idx}`}
                          onClick={() => handleSelectDayDirect(dayVal)}
                          style={{
                            height: `${ITEM_HEIGHT}px`,
                            scrollSnapAlign: 'center',
                          }}
                          className={`flex items-center justify-center cursor-pointer transition-all ${
                            isSelected
                              ? 'text-white text-2xl font-black font-mono scale-110'
                              : 'text-zinc-500 hover:text-zinc-300 text-lg font-bold font-mono opacity-60'
                          }`}
                        >
                          <span>{String(dayVal).padStart(2, '0')}</span>
                        </div>
                      );
                    })}

                    {/* Padding bottom */}
                    <div style={{ height: `${CENTER_OFFSET}px` }} />
                  </div>
                )}

                {/* Month Wheel */}
                {activeTab === 'month' && (
                  <div
                    ref={monthScrollRef}
                    onScroll={handleMonthScroll}
                    className="w-full h-full overflow-y-scroll scrollbar-none snap-y snap-mandatory relative z-0"
                    style={{
                      scrollSnapType: 'y mandatory',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {/* Padding top */}
                    <div style={{ height: `${CENTER_OFFSET}px` }} />

                    {monthItems.map((monthVal, idx) => {
                      const isSelected = monthVal === selectedMonth;
                      return (
                        <div
                          key={`month-${idx}`}
                          onClick={() => handleSelectMonthDirect(monthVal)}
                          style={{
                            height: `${ITEM_HEIGHT}px`,
                            scrollSnapAlign: 'center',
                          }}
                          className={`flex items-center justify-center gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'text-amber-300 text-xl font-black scale-110'
                              : 'text-zinc-500 hover:text-zinc-300 text-base font-semibold opacity-60'
                          }`}
                        >
                          <span className="font-mono text-xs opacity-75">
                            {String(monthVal).padStart(2, '0')}.
                          </span>
                          <span>{MONTH_NAMES[monthVal - 1]}</span>
                        </div>
                      );
                    })}

                    {/* Padding bottom */}
                    <div style={{ height: `${CENTER_OFFSET}px` }} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 1-Touch Quick Grid View */
            <div className="space-y-3">
              {activeTab === 'day' ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-300">
                      Toca un día para seleccionar de 1 solo toque:
                    </span>
                    <span className="text-[11px] text-teal-400 font-mono font-bold">
                      Día actual: {selectedDay}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                      const isCurrent = d === selectedDay;
                      return (
                        <button
                          key={`grid-day-${d}`}
                          type="button"
                          onClick={() => handleSelectDayDirect(d)}
                          className={`h-11 rounded-xl font-mono text-sm font-bold transition-all active:scale-95 flex items-center justify-center border ${
                            isCurrent
                              ? 'bg-teal-500 text-black border-teal-300 shadow-lg shadow-teal-500/30 ring-2 ring-teal-400'
                              : 'bg-white/[0.04] hover:bg-white/[0.09] text-white border-white/10'
                          }`}
                        >
                          {String(d).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-300">
                      Toca un mes para seleccionar de 1 solo toque:
                    </span>
                    <span className="text-[11px] text-amber-400 font-bold">
                      {MONTH_NAMES[selectedMonth - 1]}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {MONTH_NAMES.map((name, idx) => {
                      const mNum = idx + 1;
                      const isCurrent = mNum === selectedMonth;
                      return (
                        <button
                          key={`grid-month-${mNum}`}
                          type="button"
                          onClick={() => handleSelectMonthDirect(mNum)}
                          className={`p-3 rounded-2xl text-left transition-all active:scale-95 border flex flex-col justify-between ${
                            isCurrent
                              ? 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400'
                              : 'bg-white/[0.04] hover:bg-white/[0.09] text-white border-white/10'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              isCurrent ? 'text-black/80' : 'text-zinc-400'
                            }`}
                          >
                            Mes {String(mNum).padStart(2, '0')}
                          </span>
                          <span className="text-xs font-bold leading-tight mt-1">
                            {name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: Date Preview & Confirm Button */}
        <div className="p-3 bg-black/40 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-zinc-400">Fecha fijada:</span>
            <span className="text-xs font-mono font-bold text-white bg-teal-500/20 border border-teal-500/40 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
              <span>{String(selectedDay).padStart(2, '0')}</span>
              <span className="text-teal-400">/</span>
              <span>{String(selectedMonth).padStart(2, '0')}</span>
              <span className="text-teal-400">/</span>
              <span className="text-emerald-300">{selectedYear}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black font-extrabold text-xs rounded-2xl shadow-lg shadow-teal-950/40 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>LISTO • APLICAR FECHA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
