import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Barcode,
  Camera,
  Save,
  Trash2,
  Package,
  Sparkles,
  Layers,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Store,
  Plus,
  Tag,
} from 'lucide-react';
import { Product, Category } from '../types';
import { compressImageToIcon } from '../utils/imageCompressor';
import { CategoryManagerModal } from './CategoryManagerModal';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  categories: Category[];
  currency?: string;
  defaultMinStock: number;
  onSave: (product: Product) => void;
  onDelete?: (productId: string) => void;
  onScanBarcode: (target: 'unit' | 'bulk') => void;
  scannedCode?: { code: string; target: 'unit' | 'bulk' } | null;
  onAddCategory?: (name: string, color?: string) => Category;
  onUpdateCategory?: (category: Category) => void;
  onDeleteCategory?: (categoryId: string) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  product,
  categories,
  defaultMinStock,
  onSave,
  onDelete,
  onScanBarcode,
  scannedCode,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageStats, setImageStats] = useState<{ origKB?: number; iconKB?: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    barcode: '',
    barcodeUnit: '',
    barcodeBulk: '',
    unitsPerBulk: 12,
    bulkUnitName: 'Caja x12',
    category: 'pasillo-1',
    costPrice: 0,
    sellingPrice: 0,
    stock: 0,
    minStockAlert: defaultMinStock,
    minStockAlertUnit: defaultMinStock,
    minStockAlertBulk: 1,
    suggestedGondolaQuantity: 12,
    unit: 'uds',
    image: '',
    notes: '',
  });

  useEffect(() => {
    if (product) {
      const unitsPerBulk = Number(product.unitsPerBulk) > 0 ? Number(product.unitsPerBulk) : 12;
      const minStockAlertUnit =
        product.minStockAlertUnit !== undefined
          ? Number(product.minStockAlertUnit)
          : Number(product.minStockAlert) >= 0
          ? Number(product.minStockAlert)
          : defaultMinStock;
      const minStockAlertBulk =
        product.minStockAlertBulk !== undefined ? Number(product.minStockAlertBulk) : 1;
      const suggestedGondolaQuantity =
        product.suggestedGondolaQuantity !== undefined
          ? Number(product.suggestedGondolaQuantity)
          : Math.max(minStockAlertUnit * 2, unitsPerBulk);

      setFormData({
        ...product,
        barcodeUnit: product.barcodeUnit || product.barcode,
        barcodeBulk: product.barcodeBulk || '',
        unitsPerBulk,
        bulkUnitName: product.bulkUnitName || `Caja x${unitsPerBulk}`,
        minStockAlert: minStockAlertUnit,
        minStockAlertUnit,
        minStockAlertBulk,
        suggestedGondolaQuantity,
        costPrice: 0,
        sellingPrice: 0,
      });
      setImageStats(null);
      setImageError(null);
    } else {
      const randomUnitCode = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      const randomBulkCode = `${Math.floor(700000000000 + Math.random() * 900000000000)}`;
      setFormData({
        name: '',
        barcode: randomUnitCode,
        barcodeUnit: randomUnitCode,
        barcodeBulk: randomBulkCode,
        unitsPerBulk: 12,
        bulkUnitName: 'Caja x12',
        category: categories.find((c) => c.id !== 'all')?.id || 'pasillo-1',
        costPrice: 0,
        sellingPrice: 0,
        stock: 12,
        minStockAlert: defaultMinStock,
        minStockAlertUnit: defaultMinStock,
        minStockAlertBulk: 1,
        suggestedGondolaQuantity: Math.max(defaultMinStock * 2, 12),
        unit: 'uds',
        image: '',
        notes: '',
      });
      setImageStats(null);
      setImageError(null);
    }
  }, [product, defaultMinStock, isOpen, categories]);

  // Handle barcode scanned from camera
  useEffect(() => {
    if (scannedCode) {
      if (scannedCode.target === 'unit') {
        setFormData((prev) => ({
          ...prev,
          barcodeUnit: scannedCode.code,
          barcode: scannedCode.code,
        }));
      } else if (scannedCode.target === 'bulk') {
        setFormData((prev) => ({
          ...prev,
          barcodeBulk: scannedCode.code,
        }));
      }
    }
  }, [scannedCode]);

  if (!isOpen) return null;

  const unitsPerBulk = Number(formData.unitsPerBulk) > 0 ? Number(formData.unitsPerBulk) : 12;

  const handleUnitsPerBulkChange = (count: number) => {
    const validCount = Math.max(0, count);
    setFormData((prev) => ({
      ...prev,
      unitsPerBulk: validCount,
      bulkUnitName:
        prev.bulkUnitName?.startsWith('Caja x') || !prev.bulkUnitName
          ? `Caja x${validCount}`
          : prev.bulkUnitName,
    }));
  };

  // Image Upload & Conversion to Icon in Local APK DB
  const handleProcessImageFile = async (file: File) => {
    setImageError(null);
    setIsCompressingImage(true);
    try {
      const result = await compressImageToIcon(file, 160, 0.82);
      setFormData((prev) => ({ ...prev, image: result.dataUrl }));
      setImageStats({
        origKB: Math.round(result.originalSize / 1024),
        iconKB: Math.round(result.compressedSize / 1024),
      });
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Error al procesar la imagen.');
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleProcessImageFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcodeUnit = (formData.barcodeUnit || formData.barcode || '').trim();
    if (!formData.name?.trim() || !barcodeUnit) {
      alert('Por favor completa el nombre del producto y el código de barra por unidad');
      return;
    }

    const minUnit =
      formData.minStockAlertUnit !== undefined && Number(formData.minStockAlertUnit) >= 0
        ? Number(formData.minStockAlertUnit)
        : defaultMinStock;
    const minBulk =
      formData.minStockAlertBulk !== undefined && Number(formData.minStockAlertBulk) >= 0
        ? Number(formData.minStockAlertBulk)
        : 1;

    const savedProduct: Product = {
      id: formData.id || `prod-${Date.now()}`,
      barcode: barcodeUnit,
      barcodeUnit: barcodeUnit,
      barcodeBulk: formData.barcodeBulk?.trim() || undefined,
      unitsPerBulk: Number(formData.unitsPerBulk) >= 0 ? Number(formData.unitsPerBulk) : 12,
      bulkUnitName: formData.bulkUnitName?.trim() || `Caja x${formData.unitsPerBulk ?? 12}`,
      name: formData.name.trim(),
      category: formData.category || 'abarrotes',
      costPrice: 0,
      sellingPrice: 0,
      stock: Number(formData.stock) >= 0 ? Number(formData.stock) : 0,
      minStockAlert: minUnit,
      minStockAlertUnit: minUnit,
      minStockAlertBulk: minBulk,
      suggestedGondolaQuantity:
        formData.suggestedGondolaQuantity !== undefined && Number(formData.suggestedGondolaQuantity) >= 0
          ? Number(formData.suggestedGondolaQuantity)
          : Math.max(minUnit * 2, Number(formData.unitsPerBulk) || 0),
      unit: formData.unit || 'uds',
      image: formData.image?.trim() || undefined,
      notes: formData.notes?.trim() || undefined,
      lastUpdated: new Date().toISOString(),
    };

    onSave(savedProduct);
    onClose();
  };

  const generateRandomCode = (field: 'unit' | 'bulk') => {
    const prefix = field === 'unit' ? '779' : '1779';
    const random = Math.floor(10000000 + Math.random() * 90000000);
    const fullCode = `${prefix}${random}`;
    if (field === 'unit') {
      setFormData((prev) => ({
        ...prev,
        barcodeUnit: fullCode,
        barcode: fullCode,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        barcodeBulk: fullCode,
      }));
    }
  };

  return (
    <div
      id="product-form-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl my-auto animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#12141c] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {formData.id && !formData.id.startsWith('prod-') ? 'Editar Producto' : 'Cargar Producto'}
              </h2>
              <p className="text-[11px] text-zinc-400">Stock, códigos por unidad/bulto y alertas mínimas</p>
            </div>
          </div>
          <button
            id="close-form-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Nombre del Producto <span className="text-teal-400">*</span>
            </label>
            <input
              id="product-name-input"
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Aceite de Girasol 1.5L"
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-400"
            />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Categoría / Pasillo <span className="text-teal-400">*</span></span>
              </label>
              {onAddCategory && (
                <button
                  type="button"
                  id="open-manage-categories-from-form"
                  onClick={() => setCategoryManagerOpen(true)}
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 active:scale-95 transition-transform"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Editar / Agregar Pasillo</span>
                </button>
              )}
            </div>

            <select
              id="product-category-select"
              value={formData.category || categories.find((c) => c.id !== 'all')?.id || 'pasillo-1'}
              onChange={(e) => {
                if (e.target.value === '__add_new__') {
                  setCategoryManagerOpen(true);
                } else {
                  setFormData({ ...formData, category: e.target.value });
                }
              }}
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-teal-400"
            >
              {categories
                .filter((c) => c.id !== 'all')
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              {onAddCategory && (
                <option value="__add_new__" className="text-amber-400 font-bold bg-[#12141c]">
                  ➕ Agregar nuevo pasillo o categoría...
                </option>
              )}
            </select>
          </div>

          {/* DUAL BARCODE SECTION */}
          <div className="p-3 bg-[#0d1017] rounded-xl border border-teal-500/20 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <Barcode className="w-4 h-4" />
                <span>Códigos de Barra (Unidad y Bulto)</span>
              </span>
              <span className="text-[10px] text-zinc-400">Escaneo MLKit</span>
            </div>

            {/* Barcode Unit */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-300">
                  Código de Barra por UNIDAD <span className="text-teal-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => generateRandomCode('unit')}
                    className="text-[10px] text-zinc-400 hover:text-teal-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Generar
                  </button>
                  <button
                    type="button"
                    onClick={() => onScanBarcode('unit')}
                    className="px-2 py-0.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[11px] font-semibold flex items-center gap-1 border border-teal-500/30"
                  >
                    <Camera className="w-3 h-3" /> Escanear
                  </button>
                </div>
              </div>
              <input
                id="barcode-unit-input"
                type="text"
                required
                value={formData.barcodeUnit || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    barcodeUnit: e.target.value,
                    barcode: e.target.value,
                  })
                }
                placeholder="Escanea el código de la unidad suelta"
                className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-400"
              />
            </div>

            {/* Barcode Bulk */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-300">
                  Código de Barra por BULTO / CAJA
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => generateRandomCode('bulk')}
                    className="text-[10px] text-zinc-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Generar
                  </button>
                  <button
                    type="button"
                    onClick={() => onScanBarcode('bulk')}
                    className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1 border border-amber-500/30"
                  >
                    <Camera className="w-3 h-3" /> Escanear
                  </button>
                </div>
              </div>
              <input
                id="barcode-bulk-input"
                type="text"
                value={formData.barcodeBulk || ''}
                onChange={(e) => setFormData({ ...formData, barcodeBulk: e.target.value })}
                placeholder="Escanea el código impreso en la caja o fardo"
                className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Units per Bulk & Name */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Unidades por Bulto / Caja:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="units-per-bulk-input"
                    type="number"
                    min="0"
                    value={formData.unitsPerBulk ?? 12}
                    onChange={(e) => handleUnitsPerBulkChange(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-center font-bold text-white focus:outline-none focus:border-teal-400"
                  />
                  <span className="text-[11px] text-zinc-400 font-mono">uds</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Nombre del Empaque:
                </label>
                <input
                  id="bulk-unit-name-input"
                  type="text"
                  value={formData.bulkUnitName || `Caja x${unitsPerBulk}`}
                  onChange={(e) => setFormData({ ...formData, bulkUnitName: e.target.value })}
                  placeholder="Ej: Caja, Fardo, Pack"
                  className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                />
              </div>
            </div>
          </div>

          {/* STOCK AND DUAL ALERT THRESHOLDS */}
          <div className="p-3 bg-[#0d1017] rounded-xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Existencias y Alertas de Stock Mínimo</span>
              </span>
              <span className="text-[10px] text-zinc-400">Por Unidad y Bulto</span>
            </div>

            {/* Current Stock */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Stock Total Físico (en Unidades)
              </label>
              <input
                id="product-stock-input"
                type="number"
                min="0"
                value={formData.stock ?? 0}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                ≈ {(formData.stock || 0) / unitsPerBulk >= 1
                  ? `${Math.floor((formData.stock || 0) / unitsPerBulk)} bultos completos + ${(formData.stock || 0) % unitsPerBulk} uds sueltas`
                  : `${formData.stock || 0} unidades`}
              </span>
            </div>

            {/* Dual Minimum Stock Alerts (Unit & Bulk) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Alerta Mínimo por <strong className="text-teal-300">Unidad</strong>:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="min-stock-alert-unit-input"
                    type="number"
                    min="0"
                    value={formData.minStockAlertUnit ?? defaultMinStock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minStockAlertUnit: parseInt(e.target.value) || 0,
                        minStockAlert: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-teal-400 text-center"
                  />
                  <span className="text-[11px] text-zinc-400 font-mono">uds</span>
                </div>
                <span className="text-[9.5px] text-zinc-500 mt-0.5 block">
                  Avisa si stock ≤ {formData.minStockAlertUnit ?? defaultMinStock} uds
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Alerta Mínimo por <strong className="text-amber-300">Bulto / Caja</strong>:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="min-stock-alert-bulk-input"
                    type="number"
                    min="0"
                    value={formData.minStockAlertBulk ?? 1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minStockAlertBulk: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400 text-center"
                  />
                  <span className="text-[11px] text-zinc-400 font-mono">cj</span>
                </div>
                <span className="text-[9.5px] text-zinc-500 mt-0.5 block">
                  Avisa si bultos ≤ {formData.minStockAlertBulk ?? 1} cj
                </span>
              </div>
            </div>

            {/* Cantidad Sugerida en Góndola (Exhibición para Reposición) */}
            <div className="pt-2.5 border-t border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cantidad Sugerida en Góndola:</span>
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">Para Reposición</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="suggested-gondola-input"
                  type="number"
                  min="0"
                  value={formData.suggestedGondolaQuantity ?? 12}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      suggestedGondolaQuantity: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-32 bg-[#161922] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 text-center font-mono"
                />
                <span className="text-xs text-zinc-300 font-medium">unidades en góndola / estante</span>
              </div>
              <span className="text-[9.5px] text-zinc-500 mt-1 block">
                Capacidad óptima de exhibición. Se usará como sugerido para reponer estanterías.
              </span>
            </div>
          </div>

          {/* DEVICE IMAGE UPLOAD & ICON STORAGE IN APK DATABASE */}
          <div className="p-3 bg-[#0d1017] rounded-xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>Foto / Icono del Producto</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Guarda en APK Offline
              </span>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Image Preview / Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-sky-400 bg-sky-950/30'
                  : formData.image
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
              }`}
            >
              {isCompressingImage ? (
                <div className="py-4 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-sky-300 font-medium">Optimizando y guardando icono...</p>
                </div>
              ) : formData.image ? (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-16 h-16 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center p-1">
                    <img
                      src={formData.image}
                      alt="Icono del producto"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Icono Guardado en Base de Datos
                      </span>
                    </div>
                    <p className="text-xs text-white font-medium truncate mt-1">
                      {formData.name || 'Foto del producto'}
                    </p>
                    {imageStats && (
                      <p className="text-[10px] text-zinc-400">
                        Original: {imageStats.origKB} KB → Icono optimizado: {imageStats.iconKB} KB
                      </p>
                    )}
                    <p className="text-[10px] text-sky-400 hover:underline mt-0.5">
                      Toca para cambiar o cargar otra imagen
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData({ ...formData, image: '' });
                      setImageStats(null);
                    }}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                    title="Quitar foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="py-3 text-center space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-white/5 text-zinc-400 flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5 text-sky-400" />
                  </div>
                  <p className="text-xs font-semibold text-white">
                    Cargar foto desde el dispositivo
                  </p>
                  <p className="text-[10px] text-zinc-400 max-w-xs">
                    Cualquier formato (JPG, PNG, WebP, cámara). Se convierte y guarda como icono ligero en la base de datos de la APK.
                  </p>
                </div>
              )}
            </div>

            {imageError && (
              <p className="text-xs text-rose-400 flex items-center gap-1 animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{imageError}</span>
              </p>
            )}
          </div>

          {/* Notes / Location */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Notas / Ubicación en Depósito (opcional)
            </label>
            <textarea
              id="product-notes-input"
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ej: Pasillo 3, estante B..."
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl p-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-400"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
            {product && onDelete && (
              <button
                type="button"
                id="delete-product-btn"
                onClick={() => {
                  if (
                    confirm(
                      `¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`
                    )
                  ) {
                    onDelete(product.id);
                    onClose();
                  }
                }}
                className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                title="Eliminar producto"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>

            <button
              id="save-product-btn"
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Producto</span>
            </button>
          </div>
        </form>
      </div>

      {/* Category Manager Modal if opened from form */}
      {categoryManagerOpen && onAddCategory && (
        <CategoryManagerModal
          isOpen={categoryManagerOpen}
          onClose={() => setCategoryManagerOpen(false)}
          categories={categories}
          products={[]}
          onAddCategory={(name, color) => {
            const created = onAddCategory(name, color);
            setFormData((prev) => ({ ...prev, category: created.id }));
            return created;
          }}
          onUpdateCategory={(cat) => onUpdateCategory && onUpdateCategory(cat)}
          onDeleteCategory={(catId) => onDeleteCategory && onDeleteCategory(catId)}
          onSelectCategory={(catId) => {
            setFormData((prev) => ({ ...prev, category: catId }));
            setCategoryManagerOpen(false);
          }}
        />
      )}
    </div>
  );
};
