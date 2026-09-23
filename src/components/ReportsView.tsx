import React, { useState } from 'react';
import {
  FileText,
  Download,
  Package,
  AlertCircle,
  Filter,
  CheckCircle2,
  Boxes,
  Image as ImageIcon,
  Share2,
  ExternalLink,
  X,
  Eye,
  Sparkles,
} from 'lucide-react';
import { Product, StockMovement, StoreSettings, Category } from '../types';
import { generateInventoryPDF, ReportOptions } from '../services/pdfReport';
import {
  generateInventoryJPG,
  downloadImageFile,
  shareImageFile,
  GeneratedReportImage,
} from '../services/imageReport';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);
  const [includeMovements, setIncludeMovements] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Preview Modal state for generated JPG
  const [previewReport, setPreviewReport] = useState<GeneratedReportImage | null>(null);
  const [shareSupported, setShareSupported] = useState<boolean>(
    typeof navigator !== 'undefined' && !!navigator.share
  );

  // Calculations strictly focused on inventory physical quantities
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (onlyLowStock && p.stock > (p.minStockAlertUnit || p.minStockAlert || 5)) return false;
    return true;
  });

  const totalUnits = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalBulks = filteredProducts.reduce((sum, p) => {
    const factor = Math.max(1, p.unitsPerBulk || 12);
    return sum + Math.floor(p.stock / factor);
  }, 0);
  const lowStockCount = filteredProducts.filter((p) => {
    const min = p.minStockAlertUnit || p.minStockAlert || 5;
    return p.stock <= min;
  }).length;

  const handleExportJPG = async () => {
    setIsGenerating(true);
    setDownloadSuccess(null);

    try {
      const options: ReportOptions = {
        categoryFilter: selectedCategory,
        includeLowStockOnly: onlyLowStock,
        includeMovements,
      };

      const result = await generateInventoryJPG(products, movements, settings, options);
      setIsGenerating(false);

      // Trigger direct download
      downloadImageFile(result.blob, result.filename);

      // Open interactive preview modal so user can also save to gallery, share or inspect
      setPreviewReport(result);

      setDownloadSuccess('¡Reporte JPG generado y descargado! Puedes guardarlo también en tu Galería.');
      setTimeout(() => setDownloadSuccess(null), 5000);
    } catch (err: any) {
      setIsGenerating(false);
      alert('Error al generar la imagen JPG: ' + (err?.message || 'Error desconocido'));
    }
  };

  const handleShareReport = async () => {
    if (!previewReport) return;
    const shared = await shareImageFile(
      previewReport.file,
      settings.storeName || 'Reporte de Inventario'
    );
    if (!shared) {
      downloadImageFile(previewReport.blob, previewReport.filename);
    }
  };

  const handleExportPDF = () => {
    const options: ReportOptions = {
      categoryFilter: selectedCategory,
      includeLowStockOnly: onlyLowStock,
      includeMovements,
    };
    generateInventoryPDF(products, movements, settings, options);
    setDownloadSuccess('¡Documento PDF generado!');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  return (
    <div id="reports-view" className="p-4 space-y-5 pb-24 max-w-2xl mx-auto">
      {/* Title & Export CTA Banner */}
      <div className="bg-gradient-to-r from-emerald-950/50 via-[#161f26] to-[#12141c] border border-emerald-500/20 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/30 text-emerald-400 flex items-center justify-center font-bold shadow-inner">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Reportes y Balance de Existencias
              </h2>
              <p className="text-xs text-zinc-400">
                Control físico de unidades, bultos y códigos en formato JPG de alta definición
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Primary CTA: Generate JPG Report */}
            <button
              id="download-jpg-btn"
              onClick={handleExportJPG}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4" />
              <span>{isGenerating ? 'Generando JPG...' : 'Generar Reporte JPG'}</span>
            </button>

            {/* Secondary Option: PDF */}
            <button
              id="download-pdf-btn"
              onClick={handleExportPDF}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all"
              title="Descargar también en formato PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}
      </div>

      {/* Physical Inventory KPIs */}
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

      {/* Filters for report generation */}
      <div className="p-3.5 bg-[#161922] border border-white/10 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <span>Personalizar contenido del reporte</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Filtrar por Categoría:</label>
            <select
              id="report-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
              <span>Incluir historial reciente de entradas/salidas en el reporte</span>
            </label>
          </div>
        </div>
      </div>

      {/* Preview table of inventory */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Vista previa de existencias ({filteredProducts.length} productos)</span>
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Formato gráfico JPG
          </span>
        </div>

        <div className="bg-[#161922] border border-white/5 rounded-2xl overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
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

      {/* Interactive Modal: Generated JPG Preview & Gallery Save */}
      {previewReport && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-[#12151e] border border-white/15 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#171b26]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reporte JPG Generado</h3>
                  <p className="text-[10px] text-zinc-400 truncate max-w-[220px]">
                    {previewReport.filename}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Image Preview */}
            <div className="flex-1 overflow-y-auto p-3 bg-zinc-950/80 flex flex-col items-center">
              <div className="relative border border-white/10 rounded-lg overflow-hidden shadow-2xl bg-white max-w-full">
                <img
                  src={previewReport.dataUrl}
                  alt="Reporte de Inventario"
                  className="w-full h-auto object-contain select-none"
                />
              </div>

              <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs text-amber-300 w-full max-w-md">
                <p className="font-semibold">💡 ¿No aparece en tu carpeta de descargas?</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Mantén presionada la imagen superior y presiona <strong className="text-white">"Guardar imagen"</strong> o <strong className="text-white">"Descargar imagen"</strong> para enviarla directamente a tu galería.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3.5 border-t border-white/10 bg-[#171b26] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  id="btn-re-download-jpg"
                  onClick={() => downloadImageFile(previewReport.blob, previewReport.filename)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Volver a Descargar</span>
                </button>

                {shareSupported && (
                  <button
                    type="button"
                    id="btn-share-jpg"
                    onClick={handleShareReport}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartir / Guardar</span>
                  </button>
                )}
              </div>

              <a
                href={previewReport.dataUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir en Pestaña</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

