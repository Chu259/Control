import React, { useState } from 'react';
import {
  X,
  Plus,
  Tag,
  Edit2,
  Trash2,
  Check,
  Package,
  AlertCircle,
} from 'lucide-react';
import { Category, Product } from '../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  products: Product[];
  onAddCategory: (name: string, color?: string) => Category;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  onSelectCategory?: (categoryId: string) => void;
}

const PRESET_COLORS = [
  '#0ea5e9', // Sky
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ef4444', // Red
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSelectCategory,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setErrorMsg('Ingresa un nombre para el pasillo o categoría.');
      return;
    }

    // Check duplicate name
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Ya existe una categoría o pasillo con este nombre.');
      return;
    }

    const created = onAddCategory(trimmed, selectedColor);
    setNewCatName('');
    setErrorMsg(null);
    if (onSelectCategory) {
      onSelectCategory(created.id);
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
    setEditingColor(cat.color || PRESET_COLORS[0]);
    setErrorMsg(null);
  };

  const handleSaveEdit = (catId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }

    const cat = categories.find((c) => c.id === catId);
    if (cat) {
      onUpdateCategory({
        ...cat,
        name: trimmed,
        color: editingColor || cat.color,
      });
    }
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleDelete = (cat: Category) => {
    const prodsInCat = products.filter((p) => p.category === cat.id).length;
    const confirmMessage =
      prodsInCat > 0
        ? `¿Eliminar "${cat.name}"? Los ${prodsInCat} producto(s) asignados se reubicarán en Pasillo 1.`
        : `¿Eliminar "${cat.name}"?`;

    if (window.confirm(confirmMessage)) {
      onDeleteCategory(cat.id);
      if (editingId === cat.id) {
        setEditingId(null);
      }
    }
  };

  const activeCategories = categories.filter((c) => c.id !== 'all');

  return (
    <div
      id="category-manager-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl my-auto animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#12141c] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Gestionar Pasillos y Categorías</h2>
              <p className="text-[11px] text-zinc-400">Agrega, renombra o edita las secciones del local</p>
            </div>
          </div>
          <button
            id="close-cat-manager-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Add Category Form */}
          <form onSubmit={handleAdd} className="p-3 bg-[#0d1017] rounded-xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Agregar Nuevo Pasillo o Categoría</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="new-category-name-input"
                type="text"
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Ej: Pasillo 6, Lácteos, Panadería..."
                className="flex-1 bg-[#161922] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                id="submit-add-category-btn"
                className="px-3 py-2 bg-amber-400 hover:bg-amber-300 active:scale-95 text-black font-bold text-xs rounded-xl flex items-center gap-1 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </div>

            {/* Color selector for new category */}
            <div>
              <span className="text-[10px] text-zinc-400 block mb-1.5">Color identificador:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full transition-transform flex items-center justify-center ${
                      selectedColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d1017] scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {selectedColor === c && <Check className="w-3 h-3 text-black stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/20 p-2 rounded-lg border border-rose-500/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>

          {/* List of Existing Categories */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-zinc-300">
                Pasillos y Categorías Activas ({activeCategories.length})
              </span>
              <span className="text-[10px] text-zinc-500">Toca el lápiz para renombrar</span>
            </div>

            <div className="space-y-1.5">
              {activeCategories.map((cat) => {
                const prodsCount = products.filter((p) => p.category === cat.id).length;
                const isEditing = editingId === cat.id;

                if (isEditing) {
                  return (
                    <div
                      key={cat.id}
                      className="p-2.5 bg-[#12141c] border border-amber-400/40 rounded-xl flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 bg-[#161922] border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat.id)}
                          className="p-1.5 bg-emerald-500 text-black font-bold rounded-lg hover:bg-emerald-400 active:scale-95"
                          title="Guardar nombre"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 bg-white/10 text-zinc-400 rounded-lg hover:text-white"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Edit Color palette */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditingColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-4 h-4 rounded-full transition-transform flex items-center justify-center ${
                              editingColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2.5 bg-[#0e1017] border border-white/5 hover:border-white/10 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: cat.color || '#0ea5e9' }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white block truncate">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                          <Package className="w-3 h-3 text-zinc-600" />
                          {prodsCount} {prodsCount === 1 ? 'producto' : 'productos'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onSelectCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCategory(cat.id);
                            onClose();
                          }}
                          className="px-2 py-1 text-[10px] font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg mr-1"
                        >
                          Seleccionar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-white/5 transition-colors"
                        title="Renombrar categoría"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        disabled={activeCategories.length <= 1}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:hover:text-zinc-400"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#12141c] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition-colors"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
