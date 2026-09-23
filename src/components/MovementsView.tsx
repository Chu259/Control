import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Search, Calendar, Package, Filter, User, Shield, Layers, Barcode, X } from 'lucide-react';
import { StockMovement } from '../types';

interface MovementsViewProps {
  movements: StockMovement[];
  currency: string;
  onScanSearch?: (callback: (val: string) => void) => void;
}

export const MovementsView: React.FC<MovementsViewProps> = ({ movements, currency, onScanSearch }) => {
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  // Extract unique users from movements
  const uniqueUsers = Array.from(
    new Set(movements.map((m) => m.userName).filter(Boolean))
  ) as string[];

  const filteredMovements = movements.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (userFilter !== 'all' && m.userName !== userFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        m.productName.toLowerCase().includes(q) ||
        m.barcode.includes(q) ||
        (m.notes && m.notes.toLowerCase().includes(q)) ||
        (m.userName && m.userName.toLowerCase().includes(q)) ||
        m.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalIn = movements
    .filter((m) => m.type === 'in')
    .reduce((sum, m) => sum + m.quantity, 0);

  const totalOut = movements
    .filter((m) => m.type === 'out')
    .reduce((sum, m) => sum + m.quantity, 0);

  return (
    <div id="movements-view" className="p-4 space-y-4 pb-24 max-w-2xl mx-auto">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-[#161922] border border-emerald-500/20 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400">Total Entradas</p>
            <p className="text-base font-bold text-emerald-400">+{totalIn} unidades</p>
          </div>
        </div>

        <div className="p-3 bg-[#161922] border border-rose-500/20 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
            <ArrowDownRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400">Total Salidas</p>
            <p className="text-base font-bold text-rose-400">-{totalOut} unidades</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & User Selector */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 flex-1">
          <button
            id="filter-mov-all"
            onClick={() => setFilterType('all')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'all' ? 'bg-white/10 text-white' : 'text-zinc-400'
            }`}
          >
            Todos ({movements.length})
          </button>
          <button
            id="filter-mov-in"
            onClick={() => setFilterType('in')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'in' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400'
            }`}
          >
            Entradas (+)
          </button>
          <button
            id="filter-mov-out"
            onClick={() => setFilterType('out')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'out' ? 'bg-rose-500/20 text-rose-300' : 'text-zinc-400'
            }`}
          >
            Salidas (-)
          </button>
        </div>

        {/* User Filter Dropdown */}
        {uniqueUsers.length > 0 && (
          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-xl border border-white/5">
            <User className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer py-1 font-medium"
              title="Filtrar movimientos por usuario responsable"
            >
              <option value="all" className="bg-[#161922] text-white">Todos los usuarios</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u} className="bg-[#161922] text-white">
                  {u}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Search Filter with Barcode Reader */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          id="search-movements-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar movimiento por producto, motivo o usuario..."
          className="w-full bg-[#161922] border border-white/10 rounded-xl pl-9 pr-16 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-white text-xs p-1"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {onScanSearch && (
            <button
              type="button"
              id="btn-scan-movements-search"
              onClick={() => onScanSearch((val) => setQuery(val))}
              className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
              title="Escanear código de barra para buscar"
            >
              <Barcode className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Movements list */}
      <div className="space-y-2">
        {filteredMovements.length === 0 ? (
          <div className="p-8 text-center bg-[#161922] border border-white/5 rounded-2xl">
            <Package className="w-10 h-10 text-zinc-500 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-zinc-400">No hay movimientos registrados con este filtro.</p>
          </div>
        ) : (
          filteredMovements.map((mov) => {
            const isEntry = mov.type === 'in';
            const isBulk = mov.format === 'bulk' || mov.unitType === 'bulk';
            const dateStr = new Date(mov.timestamp).toLocaleString('es-ES', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={mov.id}
                className="bg-[#161922] border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-white/10 transition-colors"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isEntry ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {isEntry ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-white truncate">{mov.productName}</h4>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/5 text-zinc-400">
                      {mov.reason}
                    </span>
                    {isBulk && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                        <Layers className="w-2.5 h-2.5" />
                        <span>Bulto ({mov.bulkQuantity || 1} cj)</span>
                      </span>
                    )}
                  </div>

                  {/* Sub-info: Date, Notes & User identification */}
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-1 flex-wrap">
                    <span>{dateStr}</span>

                    {/* Identified User Badge */}
                    <span className="flex items-center gap-1 text-sky-300 font-sans font-medium text-[10.5px] bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                      <User className="w-3 h-3 text-sky-400" />
                      <span>{mov.userName || 'Usuario'}</span>
                      {mov.userRole && (
                        <span className="text-[9px] text-zinc-400 uppercase">
                          ({mov.userRole === 'admin' ? 'Admin' : 'Operador'})
                        </span>
                      )}
                    </span>

                    {mov.notes && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[130px] italic text-zinc-300">
                          {mov.notes}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span
                    className={`text-sm font-extrabold font-mono ${
                      isEntry ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isEntry ? '+' : '-'}{mov.quantity}
                  </span>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Stock: {mov.previousStock} → {mov.newStock}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
