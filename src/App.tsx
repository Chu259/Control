import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import {
  Product,
  StockMovement,
  Category,
  StoreSettings,
  ViewMode,
  AppTab,
  MovementType,
  MovementReason,
  AppUser,
} from './types';
import { AuthService } from './services/authService';
import { AndroidHeader } from './components/AndroidHeader';
import { ViewToggleHeader } from './components/ViewToggleHeader';
import { CategoryChips } from './components/CategoryChips';
import { ProductCard } from './components/ProductCard';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { StockMovementModal } from './components/StockMovementModal';
import { ProductFormModal } from './components/ProductFormModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AlertsView } from './components/AlertsView';
import { ReportsView } from './components/ReportsView';
import { MovementsView } from './components/MovementsView';
import { SyncView } from './components/SyncView';
import { SettingsView } from './components/SettingsView';
import { ShoppingListView } from './components/ShoppingListView';
import { ReplenishmentView } from './components/ReplenishmentView';
import { UserManagementView } from './components/UserManagementView';
import { UserLoginModal } from './components/UserLoginModal';
import { WelcomeLoginScreen } from './components/WelcomeLoginScreen';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { NavigationMenu } from './components/NavigationMenu';
import { AlertTriangle, PackageX, Plus, RefreshCw, Smartphone, Sparkles } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { Sound } from './services/sound';
import { checkStockAlert } from './utils/stockAlert';
import { matchProductTokens } from './utils/searchMatcher';
import { NotificationService } from './services/pushNotifications';
import { InAppPushBanner } from './components/InAppPushBanner';
import { NetworkPermissionService } from './services/networkPermissions';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(StorageService.getSettings());

  // Navigation & View Mode
  const [currentTab, setCurrentTab] = useState<AppTab>('inventory');
  const [viewMode, setViewMode] = useState<ViewMode>('grid-small');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [highlightProductId, setHighlightProductId] = useState<string | undefined>(undefined);

  // User Management, Authentication & Security
  const [currentUser, setCurrentUser] = useState<AppUser>(() => AuthService.getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => AuthService.isAuthenticated());
  const [userLoginModalOpen, setUserLoginModalOpen] = useState(false);

  // Search Barcode Scanner Callback
  const [searchScannerCallback, setSearchScannerCallback] = useState<((text: string) => void) | null>(null);

  const handleOpenSearchScannerFor = (callback: (text: string) => void) => {
    setSearchScannerCallback(() => callback);
    setScannerMode('lookup');
    setScanTarget(null);
    setScannerOpen(true);
  };

  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
  };

  // Modals state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'lookup' | 'in' | 'out'>('lookup');
  const [scanTarget, setScanTarget] = useState<'unit' | 'bulk' | null>(null);
  const [scannedCodeForForm, setScannedCodeForForm] = useState<{ code: string; target: 'unit' | 'bulk' } | null>(null);

  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<MovementType>('in');
  const [movementUnitType, setMovementUnitType] = useState<'unit' | 'bulk'>('unit');
  const [movementInitialQuantity, setMovementInitialQuantity] = useState<number>(1);

  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Category Manager Modal state
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const handleAddCategory = (name: string, color?: string) => {
    const res = StorageService.addCategory(name, color);
    setCategories(res.categories);
    return res.category;
  };

  const handleUpdateCategory = (cat: Category) => {
    const updated = StorageService.updateCategory(cat);
    setCategories(updated);
  };

  const handleDeleteCategory = (catId: string) => {
    const res = StorageService.deleteCategory(catId);
    setCategories(res.categories);
    setProducts(res.products);
    if (selectedCategory === catId) {
      setSelectedCategory('all');
    }
  };

  // Load local data on mount
  useEffect(() => {
    reloadAllData();
    // Request location / nearby devices permission on startup for local Wi-Fi Hotspot transmission
    NetworkPermissionService.requestOnStartup();
  }, []);

  const reloadAllData = () => {
    const loadedProducts = StorageService.getProducts();
    const loadedMovements = StorageService.getMovements();
    const loadedCategories = StorageService.getCategories();
    const loadedSettings = StorageService.getSettings();

    setProducts(loadedProducts);
    setMovements(loadedMovements);
    setCategories(loadedCategories);
    setSettings(loadedSettings);
    if (loadedSettings.defaultViewMode) {
      setViewMode(loadedSettings.defaultViewMode);
    }
  };

  // Low stock counter (Dual alert: unidad o bulto por debajo del mínimo)
  const lowStockCount = products.filter((p) => checkStockAlert(p, settings.defaultMinStock).isLow).length;

  // Requirement 1, 2 & 3: Real-time reposition pending count reflecting isPendingReposition = true
  const repositionPendingCount = products.filter((p) => p.isPendingReposition === true).length;

  // New products added by other users (pending admin review)
  const newProductsFromUsers = products.filter((p) => p.isNewFromUser && !p.reviewedByAdmin);

  // Sync state immediately when any component changes reposition status
  useEffect(() => {
    const handleRepositionUpdate = (e: any) => {
      const updatedProd = e.detail?.product as Product | undefined;
      if (updatedProd) {
        setProducts((prev) =>
          prev.map((p) => (p.id === updatedProd.id ? { ...p, ...updatedProd } : p))
        );
        if (detailProduct && detailProduct.id === updatedProd.id) {
          setDetailProduct((prev) => (prev ? { ...prev, ...updatedProd } : null));
        }
      } else {
        setProducts(StorageService.getProducts());
      }
    };
    window.addEventListener('reposition_updated', handleRepositionUpdate);
    return () => {
      window.removeEventListener('reposition_updated', handleRepositionUpdate);
    };
  }, [detailProduct]);

  // Handler to update a single product state across all open views
  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    if (detailProduct && detailProduct.id === updatedProduct.id) {
      setDetailProduct(updatedProduct);
    }
  };

  // REQUIREMENT 4: Direct flow redirection from ProductDetailModal to Shopping or Replenishment tab
  const handleNavigateToTabFromDetail = (tab: 'shopping' | 'replenishment', productId?: string) => {
    setDetailModalOpen(false);
    setDetailProduct(null);
    setCurrentTab(tab);
    setHighlightProductId(productId);
    if (productId) {
      setTimeout(() => setHighlightProductId(undefined), 6000);
    }
  };

  // REQUIREMENT 6: Native Android Back Button Listener via Capacitor App Plugin
  useEffect(() => {
    let sub: any;
    try {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        // Priority 1: Barcode scanner modal
        if (scannerOpen) {
          setScannerOpen(false);
          setScanTarget(null);
          setSearchScannerCallback(null);
          return;
        }

        // Priority 2: Product Detail Modal
        if (detailModalOpen) {
          setDetailModalOpen(false);
          setDetailProduct(null);
          return;
        }

        // Priority 3: Product Form Modal
        if (productFormOpen) {
          setProductFormOpen(false);
          setEditingProduct(null);
          setScannedCodeForForm(null);
          return;
        }

        // Priority 4: Stock Movement Modal
        if (movementModalOpen) {
          setMovementModalOpen(false);
          setMovementProduct(null);
          return;
        }

        // Priority 5: Category Manager Modal
        if (categoryManagerOpen) {
          setCategoryManagerOpen(false);
          return;
        }

        // Priority 6: User Login Modal
        if (userLoginModalOpen) {
          setUserLoginModalOpen(false);
          return;
        }

        // Priority 7: Check if child floating modal handled back button
        const event = new CustomEvent('android_back_pressed', { cancelable: true });
        const handledByChild = !window.dispatchEvent(event);
        if (handledByChild) {
          return;
        }

        // Priority 8: Return to main inventory tab instead of closing app
        if (currentTab !== 'inventory') {
          setCurrentTab('inventory');
          return;
        }

        if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      }).then((handle) => {
        sub = handle;
      });
    } catch (e) {
      console.warn('Capacitor App backButton listener notice:', e);
    }

    return () => {
      if (sub && sub.remove) {
        sub.remove();
      }
    };
  }, [
    scannerOpen,
    detailModalOpen,
    productFormOpen,
    movementModalOpen,
    categoryManagerOpen,
    userLoginModalOpen,
    currentTab,
  ]);

  // REQUIREMENT 1: Tokenized flexible search insensitive to word order ("Perita Molto" <-> "Molto Perita")
  const filteredProducts = products.filter((p) => {
    // Category filter
    if (selectedCategory !== 'all' && p.category !== selectedCategory) {
      return false;
    }
    // Search query with word-order independent tokens
    if (searchQuery.trim()) {
      return matchProductTokens(p, searchQuery);
    }
    return true;
  });

  // Handle barcode scanned from camera or manual code
  const handleBarcodeDetected = (barcode: string, matchedProduct?: Product, matchType?: 'unit' | 'bulk') => {
    setScannerOpen(false);

    // If we were scanning specifically for a search box
    if (searchScannerCallback) {
      const fillVal = matchedProduct ? matchedProduct.name : barcode;
      searchScannerCallback(fillVal);
      setSearchScannerCallback(null);
      return;
    }

    // If we were scanning directly for a field inside the Product Form (unit vs bulk barcode)
    if (scanTarget) {
      setScannedCodeForForm({ code: barcode, target: scanTarget });
      setScanTarget(null);
      setProductFormOpen(true);
      return;
    }

    if (matchedProduct) {
      if (scannerMode === 'in' || scannerMode === 'out') {
        // Open movement modal with preselected unit/bulk mode!
        setMovementProduct(matchedProduct);
        setMovementType(scannerMode);
        setMovementUnitType(matchType || 'unit');
        setMovementModalOpen(true);
      } else {
        // Open detail inspection and set search query
        setSearchQuery(matchedProduct.name);
        setDetailProduct(matchedProduct);
        setDetailModalOpen(true);
      }
    } else {
      // New barcode detected! Offer to register new product with this barcode
      setSearchQuery(barcode);
      setEditingProduct({
        id: `prod-${Date.now()}`,
        barcode,
        barcodeUnit: barcode,
        barcodeBulk: '',
        unitsPerBulk: 12,
        bulkUnitName: 'Caja x12',
        name: '',
        category: 'abarrotes',
        costPrice: 0,
        sellingPrice: 0,
        stock: 12,
        minStockAlert: settings.defaultMinStock || 5,
        minStockAlertUnit: settings.defaultMinStock || 5,
        minStockAlertBulk: 1,
        suggestedGondolaQuantity: (settings.defaultMinStock || 5) * 2,
        unit: 'uds',
        lastUpdated: new Date().toISOString(),
      });
      setProductFormOpen(true);
    }
  };

  const handleOpenSearchScanner = () => {
    setScannerMode('lookup');
    setScanTarget(null);
    setScannerOpen(true);
  };

  // Handle stock movement execution
  const handleRecordMovement = (params: {
    productId: string;
    type: MovementType;
    quantity: number;
    reason: MovementReason;
    notes?: string;
    unitType?: 'unit' | 'bulk';
    bulkQuantity?: number;
    unitsPerBulk?: number;
  }) => {
    try {
      const result = StorageService.recordStockMovement({
        ...params,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
      });
      setProducts(StorageService.getProducts());
      setMovements(StorageService.getMovements());
      if (detailProduct && detailProduct.id === params.productId) {
        setDetailProduct(result.product);
      }

      // Trigger push alert if stock dropped to low or critical level
      if (params.type === 'out') {
        const alertStatus = checkStockAlert(result.product, settings.defaultMinStock);
        if (alertStatus.isLow) {
          NotificationService.notifyStockDepleted(
            result.product,
            alertStatus.isCritical,
            settings.pushConfig
          );
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error registrando movimiento de stock');
    }
  };

  // Handle saving product (create or edit)
  const handleSaveProduct = (prod: Product) => {
    const updated = StorageService.saveProduct(prod);
    setProducts(updated);
    Sound.playSuccessChime();
    setScannedCodeForForm(null);
  };

  // Handle deleting product
  const handleDeleteProduct = (productId: string) => {
    const updated = StorageService.deleteProduct(productId);
    setProducts(updated);
    if (detailProduct?.id === productId) {
      setDetailModalOpen(false);
      setDetailProduct(null);
    }
  };

  // Quick movement trigger
  const handleQuickMovement = (product: Product, type: MovementType, unitType: 'unit' | 'bulk' = 'unit') => {
    setMovementProduct(product);
    setMovementType(type);
    setMovementUnitType(unitType);
    setMovementModalOpen(true);
  };

  // Open product detail
  const handleCardClick = (product: Product) => {
    setDetailProduct(product);
    setDetailModalOpen(true);
  };

  // If user is not logged in, display the Welcome Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0c12] text-zinc-100 font-sans flex justify-center selection:bg-amber-400 selection:text-black">
        <div className="w-full max-w-lg min-h-screen bg-[#0f1118] border-x border-white/5 flex flex-col relative shadow-2xl overflow-x-hidden">
          <WelcomeLoginScreen
            settings={settings}
            onLoginSuccess={(user: AppUser) => {
              setCurrentUser(user);
              setIsAuthenticated(true);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] text-zinc-100 font-sans flex justify-center selection:bg-teal-500 selection:text-black">
      {/* Centered Android device container */}
      <div className="w-full max-w-lg min-h-screen bg-[#0f1118] border-x border-white/5 flex flex-col relative shadow-2xl overflow-x-hidden">
        {/* Android Header (Status bar removed per user instructions) */}
        <AndroidHeader
          settings={settings}
          lowStockCount={lowStockCount}
          onOpenAlerts={() => setCurrentTab('alerts')}
          onOpenSync={() => setCurrentTab('sync')}
          onScanBarcode={handleOpenSearchScanner}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUser={currentUser}
          onOpenUserAuth={() => setUserLoginModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Real-time In-App Push Notification Banner */}
        <InAppPushBanner
          onNavigateToAlerts={() => setCurrentTab('alerts')}
          onNavigateToProduct={(pId) => {
            const found = products.find((p) => p.id === pId);
            if (found) {
              setDetailProduct(found);
              setDetailModalOpen(true);
            } else {
              setCurrentTab('alerts');
            }
          }}
        />

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'inventory' && (
            <div className="space-y-2 pb-24 animate-fade-in">
              {/* Header Toggle matching user screenshot */}
              <ViewToggleHeader
                viewMode={viewMode}
                onViewModeChange={(mode) => {
                  setViewMode(mode);
                  StorageService.saveSettings({ ...settings, defaultViewMode: mode });
                }}
              />

              {/* Category Chips */}
              <CategoryChips
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                products={products}
                onManageCategories={() => setCategoryManagerOpen(true)}
              />

              {/* Alert: New products added by users (for admins) */}
              {currentUser?.role === 'admin' && newProductsFromUsers.length > 0 && selectedCategory === 'all' && !searchQuery && (
                <div className="px-4 py-1">
                  <div
                    id="new-products-admin-alert"
                    onClick={() => setCurrentTab('sync')}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-purple-950/40 to-amber-950/40 border border-amber-500/40 flex items-center justify-between cursor-pointer hover:border-amber-500 transition-colors shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span className="text-xs text-amber-200 font-bold">
                        {newProductsFromUsers.length} producto(s) nuevo(s) agregado(s) por usuarios
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-300 font-semibold underline flex items-center gap-1">
                      Revisar y Aprobar →
                    </span>
                  </div>
                </div>
              )}

              {/* Low Stock Quick Banner if alerts active */}
              {lowStockCount > 0 && selectedCategory === 'all' && !searchQuery && (
                <div className="px-4 py-1">
                  <div
                    onClick={() => setCurrentTab('alerts')}
                    className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/20 flex items-center justify-between cursor-pointer hover:bg-rose-950/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                      <span className="text-xs text-rose-300 font-medium">
                        {lowStockCount} producto(s) en stock crítico o bajo
                      </span>
                    </div>
                    <span className="text-[11px] text-rose-400 font-semibold underline">
                      Ver alertas →
                    </span>
                  </div>
                </div>
              )}

              {/* Product Cards Container matching screenshot */}
              <div className="px-4 pt-1">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-[#161922] border border-white/5 rounded-2xl">
                    <PackageX className="w-12 h-12 text-zinc-500 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-white">No se encontraron productos</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {searchQuery
                        ? `No hay coincidencias para "${searchQuery}".`
                        : 'No hay productos en esta categoría.'}
                    </p>
                    <button
                      id="empty-add-product-btn"
                      onClick={() => {
                        setEditingProduct(null);
                        setProductFormOpen(true);
                      }}
                      className="mt-4 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md"
                    >
                      <Plus className="w-4 h-4" /> Agregar Producto
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Grid (Small) - 3 Columns matching screenshot */}
                    {viewMode === 'grid-small' && (
                      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                        {filteredProducts.map((p) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            currency={settings.currencySymbol || '$'}
                            viewMode="grid-small"
                            onQuickMovement={(prod, type) => handleQuickMovement(prod, type, 'unit')}
                            onEdit={(prod) => {
                              setEditingProduct(prod);
                              setProductFormOpen(true);
                            }}
                            onClick={handleCardClick}
                          />
                        ))}
                      </div>
                    )}

                    {/* Grid (Large) - 2 Columns */}
                    {viewMode === 'grid-large' && (
                      <div className="grid grid-cols-2 gap-3">
                        {filteredProducts.map((p) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            currency={settings.currencySymbol || '$'}
                            viewMode="grid-large"
                            onQuickMovement={(prod, type) => handleQuickMovement(prod, type, 'unit')}
                            onEdit={(prod) => {
                              setEditingProduct(prod);
                              setProductFormOpen(true);
                            }}
                            onClick={handleCardClick}
                          />
                        ))}
                      </div>
                    )}

                    {/* Detailed List */}
                    {viewMode === 'list' && (
                      <div className="space-y-2">
                        {filteredProducts.map((p) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            currency={settings.currencySymbol || '$'}
                            viewMode="list"
                            onQuickMovement={(prod, type) => handleQuickMovement(prod, type, 'unit')}
                            onEdit={(prod) => {
                              setEditingProduct(prod);
                              setProductFormOpen(true);
                            }}
                            onClick={handleCardClick}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {currentTab === 'movements' && (
            <MovementsView
              movements={movements}
              currency={settings.currencySymbol || '$'}
              onScanSearch={handleOpenSearchScannerFor}
            />
          )}

          {currentTab === 'shopping' && (
            <ShoppingListView
              products={products}
              settings={settings}
              onNavigateToStock={() => setCurrentTab('inventory')}
              onScanSearch={handleOpenSearchScannerFor}
              highlightProductId={highlightProductId}
            />
          )}

          {currentTab === 'replenishment' && (
            <ReplenishmentView
              products={products}
              settings={settings}
              currentUser={currentUser}
              onRecordMovement={handleRecordMovement}
              onNavigateToStock={() => setCurrentTab('inventory')}
              onScanSearch={handleOpenSearchScannerFor}
              onUpdateProduct={handleUpdateProduct}
              onRefreshData={reloadAllData}
              highlightProductId={highlightProductId}
            />
          )}

          {currentTab === 'sync' && (
            <SyncView
              products={products}
              movements={movements}
              onRefreshData={reloadAllData}
              currency={settings.currencySymbol || '$'}
              onOpenScanner={handleOpenSearchScannerFor}
            />
          )}

          {currentTab === 'alerts' && (
            <AlertsView
              products={products}
              settings={settings}
              currency={settings.currencySymbol || '$'}
              onUpdateSettings={(newSettings) => {
                setSettings(newSettings);
                StorageService.saveSettings(newSettings);
              }}
              onQuickRestock={(prod) => {
                setMovementProduct(prod);
                setMovementType('in');
                setMovementUnitType('unit');
                setMovementModalOpen(true);
              }}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              products={products}
              movements={movements}
              settings={settings}
              categories={categories}
              currency={settings.currencySymbol || '$'}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={(newSettings) => {
                setSettings(newSettings);
                StorageService.saveSettings(newSettings);
              }}
              onDataReload={reloadAllData}
              categories={categories}
              products={products}
              onManageCategories={() => setCategoryManagerOpen(true)}
            />
          )}

          {currentTab === 'users' && (
            <UserManagementView
              currentUser={currentUser}
              onUserChanged={(u) => setCurrentUser(u)}
              onOpenLoginModal={() => setUserLoginModalOpen(true)}
              onScanSearch={handleOpenSearchScannerFor}
            />
          )}
        </main>

        {/* Intuitive Bottom Navigation & Yellow FAB Button matching screenshot */}
        <NavigationMenu
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          lowStockCount={lowStockCount}
          repositionCount={repositionPendingCount}
          onLogout={handleLogout}
          onOpenScanner={() => {
            setScanTarget(null);
            setScannerMode('lookup');
            setScannerOpen(true);
          }}
          onOpenNewProduct={() => {
            setEditingProduct(null);
            setScannedCodeForForm(null);
            setProductFormOpen(true);
          }}
          onQuickMovementOpen={(type) => {
            setScanTarget(null);
            setScannerMode(type);
            setScannerOpen(true);
          }}
        />

        {/* Stock Movement Modal (Entradas y Salidas con soporte Unidad / Bulto) */}
        <StockMovementModal
          isOpen={movementModalOpen}
          onClose={() => setMovementModalOpen(false)}
          product={movementProduct}
          initialType={movementType}
          initialUnitType={movementUnitType}
          initialQuantity={movementInitialQuantity}
          currency={settings.currencySymbol || '$'}
          onSubmit={handleRecordMovement}
        />

        {/* Product Add/Edit Modal (con Códigos de Barra Unidad + Bulto) */}
        <ProductFormModal
          isOpen={productFormOpen}
          onClose={() => {
            setProductFormOpen(false);
            setScannedCodeForForm(null);
          }}
          product={editingProduct}
          categories={categories}
          currency={settings.currencySymbol || '$'}
          defaultMinStock={settings.defaultMinStock || 5}
          onSave={handleSaveProduct}
          onDelete={handleDeleteProduct}
          scannedCode={scannedCodeForForm}
          onScanBarcode={(target) => {
            setScanTarget(target);
            setScannerMode('lookup');
            setScannerOpen(true);
          }}
          onAddCategory={handleAddCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
        />

        {/* Product Details Modal */}
        <ProductDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          product={detailProduct}
          currency={settings.currencySymbol || '$'}
          movements={movements}
          onOpenMovement={(prod, type, unitType = 'unit') => {
            setMovementProduct(prod);
            setMovementType(type);
            setMovementUnitType(unitType);
            setMovementModalOpen(true);
          }}
          onEdit={(prod) => {
            setEditingProduct(prod);
            setProductFormOpen(true);
          }}
          onUpdateProduct={handleUpdateProduct}
          onNavigateToTab={handleNavigateToTabFromDetail}
        />

        {/* User Login & Authentication Modal */}
        <UserLoginModal
          isOpen={userLoginModalOpen}
          onClose={() => setUserLoginModalOpen(false)}
          currentUser={currentUser}
          onUserAuthenticated={(u) => {
            setCurrentUser(u);
            setUserLoginModalOpen(false);
          }}
        />

        {/* Category Manager Modal */}
        <CategoryManagerModal
          isOpen={categoryManagerOpen}
          onClose={() => setCategoryManagerOpen(false)}
          categories={categories}
          products={products}
          onAddCategory={handleAddCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          onSelectCategory={(catId) => {
            setSelectedCategory(catId);
            setCategoryManagerOpen(false);
          }}
        />

        {/* Barcode Scanner Modal with MLKit / BarcodeDetector API (rendered on top of all modals) */}
        <BarcodeScannerModal
          isOpen={scannerOpen}
          onClose={() => {
            setScannerOpen(false);
            setScanTarget(null);
            setSearchScannerCallback(null);
          }}
          onBarcodeDetected={handleBarcodeDetected}
          products={products}
          mode={scannerMode}
          scanTarget={scanTarget}
        />
      </div>
    </div>
  );
}
