import React from 'react';
import { List, LayoutGrid, Grid3X3 } from 'lucide-react';
import { ViewMode } from '../types';

interface ViewToggleHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewToggleHeader: React.FC<ViewToggleHeaderProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div id="view-toggle-header" className="px-4 pt-1.5 pb-1 flex items-center justify-center select-none">
      {/* Barra compacta de control directo de 1-clic (Toggle Button Group) */}
      <div
        className="inline-flex items-center bg-[#131620] p-1 rounded-xl border border-white/10 shadow-md gap-1"
        role="group"
        aria-label="Selector de vista de inventario"
      >
        {/* 1. Ícono de Lista / Líneas: Listado detallado */}
        <button
          id="btn-view-list"
          type="button"
          onClick={() => onViewModeChange('list')}
          title="Listado detallado"
          aria-label="Listado detallado"
          className={`p-2.5 rounded-lg transition-all flex items-center justify-center min-w-[44px] min-h-[40px] ${
            viewMode === 'list'
              ? 'bg-amber-500 text-zinc-950 shadow-md scale-[1.02]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <List className="w-5 h-5" />
        </button>

        {/* 2. Ícono de 4 Cuadrados Grandes: Cuadros (grandes) */}
        <button
          id="btn-view-grid-large"
          type="button"
          onClick={() => onViewModeChange('grid-large')}
          title="Cuadros (grandes)"
          aria-label="Cuadros (grandes)"
          className={`p-2.5 rounded-lg transition-all flex items-center justify-center min-w-[44px] min-h-[40px] ${
            viewMode === 'grid-large'
              ? 'bg-amber-500 text-zinc-950 shadow-md scale-[1.02]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
        </button>

        {/* 3. Ícono de Múltiples Cuadrados Pequeños: Cuadros (pequeños) */}
        <button
          id="btn-view-grid-small"
          type="button"
          onClick={() => onViewModeChange('grid-small')}
          title="Cuadros (pequeños)"
          aria-label="Cuadros (pequeños)"
          className={`p-2.5 rounded-lg transition-all flex items-center justify-center min-w-[44px] min-h-[40px] ${
            viewMode === 'grid-small'
              ? 'bg-amber-500 text-zinc-950 shadow-md scale-[1.02]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Grid3X3 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
