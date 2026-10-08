import React, { useState, useMemo } from 'react';
import {
  FileText,
  Filter,
  CheckCircle2,
  Share2,
  Calendar,
  User as UserIcon,
  ArrowUpDown,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Boxes,
  ShieldCheck,
} from 'lucide-react';
import { Product, StockMovement, StoreSettings, Category, AppUser } from '../types';
import { shareInventoryPDFNative, ReportOptions } from '../services/pdfReport';
import { AuthService } from '../services/authService';

interface ReportsViewProps {
  products: Product[];
  movements: StockMovement[];
  settings: StoreSettings;
  categories: Category[];
  currency?: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  products,
  movements,
  settings,
  categories,
}) => {
  // 1. Filtros Inteligentes de Auditoría (Antes de Generar el PDF)
  // - Filtro por Fecha: Rango estricto ("Desde / Hasta")
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // - Filtro por Usuario: Desplegable con empleados (Carlos, Lucía, Admin, etc.)
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // - Filtro por Tipo de Movimiento: "Todos", "Solo Entradas" o "Solo Salidas"
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'in' | 'out'>('all');

  // Otros filtros complementarios de existencias
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);
  const [includeMovements, setIncludeMovements] = useState<boolean>(true);

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Lista unificada de operarios / empleados
  const availableUsers = useMemo(() => {
    const list: { id: string; name: string; role?: string }[] = [];
    const registeredUsers = AuthService.getUsers();

    registeredUsers.forEach((u) => {
      list.push({ id: u.id, name: u.name, role: u.role });
    });

    // Agregar usuarios que aparezcan en movimientos pero no estén en la lista básica
    movements.forEach((m) => {
      if (m.userId && !list.some((u) => u.id === m.userId)) {
        list.push({ id: m.userId, name: m.userName || m.userId, role: m.userRole });
      } else if (m.userName && !list.some((u) => u.name.toLowerCase() === m.userName?.toLowerCase())) {
        list.push({ id: `name-${m.userName}`, name: m.userName, role: m.userRole });
      }
    });

    return list;
  }, [movements]);

  // Movimientos auditados que cumplen estrictamente con los 3 filtros
  const auditedMovements = useMemo(() => {
    let list = [...movements];

    if (startDate) {
      const startMs = new Date(`${startDate}T00:00:00`).getTime();
      list = list.filter((m) => new Date(m.timestamp).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(`${endDate}T23:59:59.999`).getTime();
      list = list.filter((m) => new Date(m.timestamp).getTime() <= endMs);
    }

    if (selectedUser !== 'all') {
      const filterKey = selectedUser.toLowerCase();
      list = list.filter(
        (m) =>
          (m.userId && m.userId.toLowerCase() === filterKey) ||
          (m.userName && m.userName.toLowerCase().includes(filterKey))
      );
    }

    if (movementTypeFilter !== 'all') {
      list = list.filter((m) => m.type === movementTypeFilter);
    }

    return list;
  }, [movements, startDate, endDate, selectedUser, movementTypeFilter]);

  // Cálculos físicos de catálogo de productos
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (onlyLowStock && p.stock > (p.minStockAlertUnit || p.minStockAlert || 5)) return false;
      return true;
    });
  }, [products, selectedCategory, onlyLowStock]);

  const totalUnits = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalBulks = filteredProducts.reduce((sum, p) => {
    const factor = Math.max(1, p.unitsPerBulk || 12);
    return sum + Math.floor(p.stock / factor);
  }, 0);
  const lowStockCount = filteredProducts.filter((p) => {
    const min = p.minStockAlertUnit || p.minStockAlert || 5;
    return p.stock <= min;
  }).length;

  // Atajos rápidos de fecha
  const setTodayFilter = () => {
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(today);
  };

  const setLast7DaysFilter = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  const setThisMonthFilter = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(lastDay.toISOString().slice(0, 10));
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleShareInventoryReport = async () => {
    setIsGenerating(true);
    setDownloadSuccess(null);

    try {
      const selectedUserName =
        selectedUser === 'all'
          ? 'Todos los empleados'
          : availableUsers.find((u) => u.id === selectedUser || u.name === selectedUser)?.name || selectedUser;

      const options: ReportOptions = {
        categoryFilter: selectedCategory,
        includeLowStockOnly: onlyLowStock,
        includeMovements,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userFilter: selectedUser,
        userNameLabel: selectedUserName,
        movementTypeFilter,
      };

      const res = await shareInventoryPDFNative(products, movements, settings, options);
      setIsGenerating(false);

      if (res.method === 'cancelled_by_user') {
        return;
      }

      setDownloadSuccess('¡Reporte PDF generado y compartido con éxito! Diseño vectorial nítido con filtros aplicados.');
      setTimeout(() => setDownloadSuccess(null), 5000);
    } catch (err: any) {
      setIsGenerating(false);
      console.error(err);
      alert('Error al compartir el reporte PDF: ' + (err?.message || 'Error desconocido'));
    }
  };

  return (
    <div id="reports-view" className="p-4 space-y-5 pb-24 max-w-2xl mx-auto">
      {/* Encabezado del Módulo de Reportes */}
      <div className="bg-gradient-to-r from-emerald-950/50 via-[#161f26] to-[#12141c] border border-emerald-500/20 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/30 text-emerald-400 flex items-center justify-center font-bold shadow-inner flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Reportes y Balance de Existencias
            </h2>
            <p className="text-xs text-zinc-400">
              Auditoría física de unidades, bultos y movimientos por operario
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* REGLA 1: PANEL DE FILTROS INTELIGENTES ANTES DE GENERAR PDF  */}
        {/* ============================================================ */}
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3.5 bg-black/30 p-3.5 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
              <Filter className="w-4 h-4 text-teal-400" />
              <span>Panel de Filtros Inteligentes de Auditoría</span>
            </div>
            {(startDate || endDate || selectedUser !== 'all' || movementTypeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  clearDateFilter();
                  setSelectedUser('all');
                  setMovementTypeFilter('all');
                }}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>

          {/* 1. FILTRO POR FECHA (Rango estricto "Desde / Hasta") */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>1. Rango de Fecha Estricto:</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={setTodayFilter}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-zinc-300"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={setLast7DaysFilter}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-zinc-300"
                >
                  7 días
                </button>
                <button
                  type="button"
                  onClick={setThisMonthFilter}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-zinc-300"
                >
                  Este Mes
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-[10px] text-zinc-400 mb-0.5">Desde:</span>
                <input
                  id="filter-date-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-400 mb-0.5">Hasta:</span>
                <input
                  id="filter-date-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 2. FILTRO POR USUARIO (Menú desplegable con Carlos, Lucía, Admin, etc.) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-teal-400" />
              <span>2. Operario / Empleado:</span>
            </label>
            <select
              id="filter-user-select"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="all">👥 Todos los empleados (Auditoría general)</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  👤 {u.name} {u.role === 'admin' ? '(Admin)' : '(Operario)'}
                </option>
              ))}
            </select>
          </div>

          {/* 3. FILTRO POR TIPO DE MOVIMIENTO (Todos / Solo Entradas / Solo Salidas) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span>3. Tipo de Movimiento:</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="filter-type-all"
                onClick={() => setMovementTypeFilter('all')}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all ${
                  movementTypeFilter === 'all'
                    ? 'bg-white/15 text-white border-white/30 shadow-xs'
                    : 'bg-[#0e1017] text-zinc-400 border-white/5 hover:text-white'
                }`}
              >
                <span>Todos</span>
              </button>

              <button
                type="button"
                id="filter-type-in"
                onClick={() => setMovementTypeFilter('in')}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all ${
                  movementTypeFilter === 'in'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                    : 'bg-[#0e1017] text-zinc-400 border-white/5 hover:text-emerald-400'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Solo Entradas</span>
              </button>

              <button
                type="button"
                id="filter-type-out"
                onClick={() => setMovementTypeFilter('out')}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all ${
                  movementTypeFilter === 'out'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-xs'
                    : 'bg-[#0e1017] text-zinc-400 border-white/5 hover:text-rose-400'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                <span>Solo Salidas</span>
              </button>
            </div>
          </div>

          {/* Resumen en tiempo real de movimientos coincidentes */}
          <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/5">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Movimientos que se incluirán en el PDF:</span>
            </span>
            <span className="font-mono font-bold text-teal-300">
              {auditedMovements.length} fila(s)
            </span>
          </div>
        </div>

        {/* Botón Único de Emisión de PDF (Inmediatamente después de los filtros) */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col items-center justify-center w-full">
          <button
            id="btn-share-inventory-report"
            onClick={handleShareInventoryReport}
            disabled={isGenerating}
            className="w-full sm:w-auto min-w-[280px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 hover:from-emerald-300 hover:via-teal-300 hover:to-emerald-300 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Share2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            <span>
              {isGenerating ? 'Generando Reporte PDF...' : 'Compartir Reporte de Existencias (PDF)'}
            </span>
          </button>
          <p className="text-[11px] text-zinc-400 mt-2 text-center">
            Genera un documento PDF vectorial A4 de alta nitidez conectado para enviarlo por WhatsApp.
          </p>
        </div>

        {downloadSuccess && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}
      </div>

      {/* Indicadores Físicos de Inventario */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-[#161922] border border-white/5 rounded-xl">
          <p className="text-[10px] text-zinc-400">Productos</p>
          <p className="text-sm sm:text-base font-bold text-teal-400 mt-0.5">
            {filteredProducts.length}
          </p>
          <p className="text-[9px] text-zinc-500">artículos en lista</p>
        </div>

        <div className="p-3 bg-[#161922] border border-white/5 rounded-xl">
          <p className="text-[10px] text-zinc-400">Existencias Totales</p>
          <p className="text-sm sm:text-base font-bold text-white mt-0.5">
            {totalUnits}
          </p>
          <p className="text-[9px] text-zinc-500">unidades individuales</p>
        </div>

        <div className="p-3 bg-[#161922] border border-white/5 rounded-xl">
          <p className="text-[10px] text-zinc-400">Bultos Estimados</p>
          <p className="text-sm sm:text-base font-bold text-amber-300 mt-0.5">
            {totalBulks}
          </p>
          <p className="text-[9px] text-zinc-500">cajas / packs cerrados</p>
        </div>

        <div className="p-3 bg-[#161922] border border-white/5 rounded-xl">
          <p className="text-[10px] text-zinc-400">Alertas Stock</p>
          <p className="text-sm sm:text-base font-bold text-rose-400 mt-0.5">
            {lowStockCount}
          </p>
          <p className="text-[9px] text-zinc-500">requieren reposición</p>
        </div>
      </div>

      {/* Opciones de Catálogo y Agrupación */}
      <div className="p-3.5 bg-[#161922] border border-white/10 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <Boxes className="w-3.5 h-3.5 text-zinc-400" />
          <span>Filtro de Catálogo de Existencias</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Filtrar por Pasillo / Categoría:</label>
            <select
              id="report-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Todas las categorías ({products.length} productos)</option>
              {categories
                .filter((c) => c.id !== 'all')
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0e1017] border-white/20 text-emerald-500 focus:ring-0"
              />
              <span>Solo productos con stock bajo / crítico</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMovements}
                onChange={(e) => setIncludeMovements(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0e1017] border-white/20 text-emerald-500 focus:ring-0"
              />
              <span>Incluir tabla de movimientos auditados en el reporte</span>
            </label>
          </div>
        </div>
      </div>

      {/* Vista previa en pantalla de Movimientos Auditados Filtrados */}
      {includeMovements && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
              <span>Movimientos Auditados Filtrados ({auditedMovements.length})</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-normal">
              {startDate || endDate || selectedUser !== 'all' || movementTypeFilter !== 'all' ? 'Filtros activos' : 'Todos'}
            </span>
          </div>

          <div className="bg-[#161922] border border-white/5 rounded-2xl overflow-hidden">
            {auditedMovements.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                No hay movimientos que coincidan con los filtros de fecha, operario o tipo seleccionados.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#10121a] text-zinc-400 sticky top-0 border-b border-white/5 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Operario</th>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5 text-right">Cant.</th>
                      <th className="p-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300">
                    {auditedMovements.slice(0, 50).map((m) => (
                      <tr key={m.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-2.5 font-mono text-[10px] text-zinc-400 whitespace-nowrap">
                          {new Date(m.timestamp).toLocaleString('es-ES', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="p-2.5 text-zinc-200 font-medium truncate max-w-[100px]">
                          {m.userName || 'Sistema'}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              m.type === 'in'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {m.type === 'in' ? 'ENTRADA' : 'SALIDA'}
                          </span>
                        </td>
                        <td className="p-2.5 truncate max-w-[120px] text-white">
                          {m.productName}
                        </td>
                        <td
                          className={`p-2.5 text-right font-mono font-bold ${
                            m.type === 'in' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {m.type === 'in' ? '+' : '-'}{m.quantity}
                        </td>
                        <td className="p-2.5 text-right font-mono text-[11px] text-zinc-400">
                          {m.previousStock} → {m.newStock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vista previa de existencias de productos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Vista previa de existencias ({filteredProducts.length} productos)</span>
          <span className="text-[11px] text-zinc-500 font-normal">
            {totalUnits} unidades registradas
          </span>
        </div>

        <div className="bg-[#161922] border border-white/5 rounded-2xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#10121a] text-zinc-400 sticky top-0 border-b border-white/5 text-[10px] uppercase">
                <tr>
                  <th className="p-2.5">Producto</th>
                  <th className="p-2.5">Cód. Unidad</th>
                  <th className="p-2.5">Cód. Bulto</th>
                  <th className="p-2.5 text-right">Stock</th>
                  <th className="p-2.5 text-right">Bultos</th>
                  <th className="p-2.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {filteredProducts.map((p) => {
                  const factor = Math.max(1, p.unitsPerBulk || 12);
                  const bulks = Math.floor(p.stock / factor);
                  const minStock = p.minStockAlertUnit || p.minStockAlert || 5;
                  const isLow = p.stock <= minStock;
                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-2.5 truncate max-w-[140px] font-medium text-white">
                        {p.name}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-teal-300">
                        {p.barcodeUnit || p.barcode}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-amber-300/90">
                        {p.barcodeBulk || '-'}
                      </td>
                      <td className="p-2.5 text-right font-bold font-mono">
                        <span className={isLow ? 'text-rose-400' : 'text-zinc-200'}>
                          {p.stock} {p.unit || 'uds'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono text-amber-300/80">
                        {bulks} cj
                      </td>
                      <td className="p-2.5 text-center">
                        {isLow ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Bajo
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
