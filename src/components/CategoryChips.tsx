import React from 'react';
import { Plus } from 'lucide-react';
import { Category, Product } from '../types';

interface CategoryChipsProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  products: Product[];
  onManageCategories?: () => void;
}

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  products,
  onManageCategories,
}) => {
  const getCount = (catId: string) => {
    if (catId === 'all') return products.length;
    return products.filter((p) => p.category === catId).length;
  };

  return (
    <div id="category-chips-bar" className="px-4 py-2 overflow-x-auto no-scrollbar select-none">
      <div className="flex items-center gap-1.5 min-w-max">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = getCount(cat.id);
          return (
            <button
              key={cat.id}
              id={`cat-chip-${cat.id}`}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                isSelected
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                  : 'bg-[#161922] text-zinc-300 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-black/20 text-black' : 'bg-white/5 text-zinc-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        {onManageCategories && (
          <button
            id="manage-categories-chip-btn"
            onClick={onManageCategories}
            className="px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 border border-amber-400/30 transition-all active:scale-95 shrink-0"
            title="Agregar o editar pasillos y categorías"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Pasillo</span>
          </button>
        )}
      </div>
    </div>
  );
};

