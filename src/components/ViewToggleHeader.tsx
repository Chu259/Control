import React, { useState } from 'react';
import { ChevronDown, Check, LayoutGrid, Grid3X3, List } from 'lucide-react';
import { ViewMode } from '../types';

interface ViewToggleHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewToggleHeader: React.FC<ViewToggleHeaderProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isList = viewMode === 'list';
  const isGrid = viewMode === 'grid-small' || viewMode === 'grid-large';

  const getSubLabel = () => {
    switch (viewMode) {
      case 'grid-small':
        return 'Cuadros (pequeños)';
      case 'grid-large':
        return 'Cuadros (grandes)';
      case 'list':
        return 'Listado detallado';
    }
  };

  return (
    <div id="view-toggle-header" className="px-4 pt-3 pb-2 text-center select-none">
      {/* Title from screenshot */}
      <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mb-3">
        Seleccionar la vista predeterminada:
      </h2>

      {/* Main Pill Switch [ Listado | Cuadros ] matching screenshot */}
      <div className="max-w-xs mx-auto bg-black/60 p-1 rounded-full border border-white/15 flex items-center shadow-inner mb-3">
        <button
          id="toggle-view-listado"
          onClick={() => onViewModeChange('list')}
          className={`flex-1 py-1.5 px-4 rounded-full text-xs sm:text-sm font-medium transition-all ${
            isList
              ? 'bg-white text-zinc-950 font-semibold shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Listado
        </button>
        <button
          id="toggle-view-cuadros"
          onClick={() => onViewModeChange(viewMode === 'list' ? 'grid-small' : viewMode)}
          className={`flex-1 py-1.5 px-4 rounded-full text-xs sm:text-sm font-medium transition-all ${
            isGrid
              ? 'bg-white text-zinc-950 font-semibold shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Cuadros
        </button>
      </div>

      {/* Sub-selector with Dropdown Arrow matching screenshot: "Cuadros (pequeños) ⌄" */}
      <div className="relative inline-block text-center">
        <button
          id="view-mode-dropdown-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="inline-flex items-center gap-1.5 text-sm sm:text-base font-semibold text-white/90 hover:text-white border-b-2 border-white/20 pb-0.5 transition-colors"
        >
          <span>{getSubLabel()}</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div
            id="view-mode-dropdown-menu"
            className="absolute left-1/2 -translate-x-1/2 mt-2 w-52 bg-[#1b1f2b] border border-white/15 rounded-xl shadow-2xl p-1.5 z-40 text-left backdrop-blur-md"
          >
            <button
              onClick={() => {
                onViewModeChange('grid-small');
                setDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-zinc-200 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-teal-400" />
                <span>Cuadros (pequeños)</span>
              </div>
              {viewMode === 'grid-small' && <Check className="w-3.5 h-3.5 text-teal-400" />}
            </button>

            <button
              onClick={() => {
                onViewModeChange('grid-large');
                setDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-zinc-200 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-emerald-400" />
                <span>Cuadros (grandes)</span>
              </div>
              {viewMode === 'grid-large' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              onClick={() => {
                onViewModeChange('list');
                setDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-zinc-200 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-amber-400" />
                <span>Listado detallado</span>
              </div>
              {viewMode === 'list' && <Check className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
