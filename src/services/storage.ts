import { Product, StockMovement, Category, StoreSettings, MovementType, MovementReason, UserRole } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_SETTINGS } from '../data/initialData';
import { AuthService } from './authService';

const STORAGE_KEYS = {
  PRODUCTS: 'stock_app_products_v1',
  MOVEMENTS: 'stock_app_movements_v1',
  CATEGORIES: 'stock_app_categories_v1',
  SETTINGS: 'stock_app_settings_v1',
};

export const StorageService = {
  getProducts(): Product[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
        return INITIAL_PRODUCTS;
      }
      const parsed: Product[] = JSON.parse(data);
      const oldCatMap: Record<string, string> = {
        bebidas: 'pasillo-1',
        snacks: 'pasillo-2',
        galletas: 'pasillo-3',
        cafe: 'pasillo-4',
        abarrotes: 'pasillo-5',
      };

      // Keep strictly ONLY the products requested by the user from the image:
      // 1. "Queso snack Dos hermanos"
      // 2. "Perita molto"
      const allowedBarcodes = new Set(['7790503000272', '7791579069323']);
      const allowedIds = new Set(['prod-1789964939522', 'prod-1789957711181']);
      const isTargetProduct = (p: Product) =>
        allowedIds.has(p.id) ||
        allowedBarcodes.has(p.barcodeUnit || p.barcode) ||
        p.name.toLowerCase().includes('queso snack') ||
        p.name.toLowerCase().includes('perita molto');

      let targetList = parsed.filter(isTargetProduct);
      if (targetList.length === 0) {
        targetList = INITIAL_PRODUCTS;
      } else {
        INITIAL_PRODUCTS.forEach((ip) => {
          if (!targetList.some((p) => p.id === ip.id || (p.barcodeUnit && p.barcodeUnit === ip.barcodeUnit))) {
            targetList.push(ip);
          }
        });
      }

      // Persist the clean list if legacy products were purged
      if (parsed.length !== targetList.length) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(targetList));
      }

      // Normalize to guarantee barcodeUnit, unitsPerBulk, and migrated category
      return targetList.map((p) => {
        const unitsPerBulk = Number(p.unitsPerBulk) > 0 ? Number(p.unitsPerBulk) : 12;
        const mappedCategory = oldCatMap[p.category] || p.category || 'pasillo-1';
        return {
          ...p,
          category: mappedCategory,
          barcodeUnit: p.barcodeUnit || p.barcode,
          barcode: p.barcodeUnit || p.barcode,
          barcodeBulk: p.barcodeBulk || undefined,
          unitsPerBulk,
          bulkUnitName: p.bulkUnitName || `Caja x${unitsPerBulk}`,
          costPriceBulk: p.costPriceBulk ?? Number((p.costPrice * unitsPerBulk).toFixed(2)),
          sellingPriceBulk: p.sellingPriceBulk ?? Number((p.sellingPrice * unitsPerBulk).toFixed(2)),
        };
      });
    } catch {
      return INITIAL_PRODUCTS;
    }
  },

  saveProducts(products: Product[]): void {
    const normalized = products.map((p) => {
      const unitsPerBulk = Number(p.unitsPerBulk) > 0 ? Number(p.unitsPerBulk) : 12;
      return {
        ...p,
        barcodeUnit: p.barcodeUnit || p.barcode,
        barcode: p.barcodeUnit || p.barcode,
        unitsPerBulk,
        bulkUnitName: p.bulkUnitName || `Caja x${unitsPerBulk}`,
      };
    });
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(normalized));
  },

  saveProduct(product: Product): Product[] {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === product.id);
    const unitsPerBulk = Number(product.unitsPerBulk) > 0 ? Number(product.unitsPerBulk) : 12;
    const normalizedProduct: Product = {
      ...product,
      barcode: product.barcodeUnit || product.barcode,
      barcodeUnit: product.barcodeUnit || product.barcode,
      unitsPerBulk,
      bulkUnitName: product.bulkUnitName || `Caja x${unitsPerBulk}`,
      lastUpdated: new Date().toISOString(),
    };

    let updated: Product[];
    if (index >= 0) {
      updated = [...products];
      updated[index] = normalizedProduct;
    } else {
      const currentUser = AuthService.getCurrentUser();
      const isClientOrUser = currentUser?.role !== 'admin';
      updated = [
        {
          ...normalizedProduct,
          id: product.id || `prod-${Date.now()}`,
          isNewFromUser: product.isNewFromUser !== undefined ? product.isNewFromUser : isClientOrUser,
          addedByUserName: product.addedByUserName || currentUser?.name || 'Usuario',
          addedAt: product.addedAt || new Date().toISOString(),
          reviewedByAdmin: product.reviewedByAdmin !== undefined ? product.reviewedByAdmin : !isClientOrUser,
        },
        ...products,
      ];
    }
    this.saveProducts(updated);
    return updated;
  },

  markProductReviewed(productId: string): Product[] {
    const products = this.getProducts().map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          isNewFromUser: false,
          reviewedByAdmin: true,
          lastUpdated: new Date().toISOString(),
        };
      }
      return p;
    });
    this.saveProducts(products);
    return products;
  },

  getNewUserProducts(): Product[] {
    return this.getProducts().filter((p) => p.isNewFromUser && !p.reviewedByAdmin);
  },

  deleteProduct(productId: string): Product[] {
    const products = this.getProducts().filter((p) => p.id !== productId);
    this.saveProducts(products);
    return products;
  },

  // Lookup product with detection whether barcode matched unit or bulk pack
  findProductByBarcode(barcode: string): { product: Product; matchType: 'unit' | 'bulk' } | undefined {
    const trimmed = barcode.trim();
    if (!trimmed) return undefined;
    const products = this.getProducts();

    // Check bulk barcode first
    const bulkMatch = products.find((p) => p.barcodeBulk && p.barcodeBulk.trim() === trimmed);
    if (bulkMatch) {
      return { product: bulkMatch, matchType: 'bulk' };
    }

    // Check unit barcode
    const unitMatch = products.find(
      (p) => (p.barcodeUnit && p.barcodeUnit.trim() === trimmed) || (p.barcode && p.barcode.trim() === trimmed)
    );
    if (unitMatch) {
      return { product: unitMatch, matchType: 'unit' };
    }

    return undefined;
  },

  getProductByBarcode(barcode: string): Product | undefined {
    const result = this.findProductByBarcode(barcode);
    return result ? result.product : undefined;
  },

  // Stock In / Stock Out operation supporting both individual unit and bulk packs
  recordStockMovement(params: {
    productId: string;
    type: MovementType;
    quantity: number; // total units affected
    reason: MovementReason;
    notes?: string;
    format?: 'unit' | 'bulk';
    unitType?: 'unit' | 'bulk';
    bulkQuantity?: number;
    barcodeScanned?: string;
    userId?: string;
    userName?: string;
    userRole?: UserRole;
  }): { product: Product; movement: StockMovement } {
    const products = this.getProducts();
    const productIndex = products.findIndex((p) => p.id === params.productId);
    if (productIndex === -1) {
      throw new Error('Producto no encontrado');
    }

    const movementFormat = params.format || params.unitType || 'unit';
    const currentProduct = products[productIndex];
    const previousStock = currentProduct.stock;
    const delta = params.type === 'in' ? params.quantity : -params.quantity;
    const newStock = Math.max(0, previousStock + delta);

    const updatedProduct: Product = {
      ...currentProduct,
      stock: newStock,
      lastUpdated: new Date().toISOString(),
    };
    products[productIndex] = updatedProduct;
    this.saveProducts(products);

    // Identify user performing this stock transaction
    const currentUser = AuthService.getCurrentUser();
    const activeUserId = params.userId || currentUser?.id;
    const activeUserName = params.userName || currentUser?.name || 'Usuario';
    const activeUserRole = params.userRole || currentUser?.role || 'user';

    const movement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: currentProduct.id,
      productName: currentProduct.name,
      barcode: currentProduct.barcodeUnit || currentProduct.barcode,
      barcodeScanned: params.barcodeScanned || (movementFormat === 'bulk' ? currentProduct.barcodeBulk : currentProduct.barcodeUnit),
      format: movementFormat,
      unitType: movementFormat,
      bulkQuantity: params.bulkQuantity,
      unitsPerBulk: currentProduct.unitsPerBulk,
      type: params.type,
      quantity: params.quantity,
      previousStock,
      newStock,
      reason: params.reason,
      notes: params.notes,
      timestamp: new Date().toISOString(),
      userId: activeUserId,
      userName: activeUserName,
      userRole: activeUserRole,
      deviceId: (() => {
        try {
          const cfg = JSON.parse(localStorage.getItem('stock_app_settings_v1') || '{}')?.syncConfig;
          return cfg?.deviceId || 'dev-local';
        } catch {
          return 'dev-local';
        }
      })(),
      synced: false,
    };

    const movements = this.getMovements();
    const updatedMovements = [movement, ...movements].slice(0, 500); // keep recent 500
    this.saveMovements(updatedMovements);

    return { product: updatedProduct, movement };
  },

  getMovements(): StockMovement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
      if (!data) return [];
      const parsed: StockMovement[] = JSON.parse(data);
      const allowedBarcodes = new Set(['7790503000272', '7791579069323']);
      const allowedIds = new Set(['prod-1789964939522', 'prod-1789957711181']);
      const filtered = parsed.filter((m) =>
        allowedIds.has(m.productId) ||
        (m.barcode && allowedBarcodes.has(m.barcode)) ||
        m.productName.toLowerCase().includes('queso snack') ||
        m.productName.toLowerCase().includes('perita molto')
      );
      if (filtered.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(filtered));
      }
      return filtered;
    } catch {
      return [];
    }
  },

  saveMovements(movements: StockMovement[]): void {
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movements));
  },

  getCategories(): Category[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
        return INITIAL_CATEGORIES;
      }
      let parsed: Category[] = JSON.parse(data);
      
      // Automatic migration: if old categories (bebidas, snacks, etc.) are present, migrate to Pasillo 1-5
      const oldMap: Record<string, { id: string; name: string; color: string }> = {
        bebidas: { id: 'pasillo-1', name: 'Pasillo 1', color: '#0ea5e9' },
        snacks: { id: 'pasillo-2', name: 'Pasillo 2', color: '#f59e0b' },
        galletas: { id: 'pasillo-3', name: 'Pasillo 3', color: '#ec4899' },
        cafe: { id: 'pasillo-4', name: 'Pasillo 4', color: '#8b5cf6' },
        abarrotes: { id: 'pasillo-5', name: 'Pasillo 5', color: '#10b981' },
      };

      const hasOldCategory = parsed.some((c) => oldMap[c.id]);
      if (hasOldCategory) {
        parsed = parsed.map((cat) => {
          if (oldMap[cat.id]) {
            return {
              id: oldMap[cat.id].id,
              name: oldMap[cat.id].name,
              color: oldMap[cat.id].color,
            };
          }
          return cat;
        });

        // Ensure Pasillo 1 to Pasillo 5 all exist
        INITIAL_CATEGORIES.forEach((initCat) => {
          if (!parsed.some((c) => c.id === initCat.id)) {
            parsed.push(initCat);
          }
        });

        // Remove duplicate IDs if any
        const seen = new Set<string>();
        parsed = parsed.filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });

        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(parsed));
      }

      // Ensure 'all' exists
      if (!parsed.some((c) => c.id === 'all')) {
        parsed = [{ id: 'all', name: 'Todos', color: '#6366f1' }, ...parsed];
      }

      return parsed;
    } catch {
      return INITIAL_CATEGORIES;
    }
  },

  saveCategories(categories: Category[]): void {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  },

  addCategory(name: string, color?: string): { category: Category; categories: Category[] } {
    const categories = this.getCategories();
    const cleanName = name.trim();
    const slug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `pasillo-${Date.now()}`;

    let id = slug;
    let counter = 1;
    while (categories.some((c) => c.id === id)) {
      id = `${slug}-${counter++}`;
    }

    const defaultColors = ['#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'];
    const chosenColor = color || defaultColors[categories.length % defaultColors.length];

    const newCategory: Category = {
      id,
      name: cleanName,
      color: chosenColor,
    };

    const updated = [...categories, newCategory];
    this.saveCategories(updated);
    return { category: newCategory, categories: updated };
  },

  updateCategory(updatedCategory: Category): Category[] {
    const categories = this.getCategories();
    const index = categories.findIndex((c) => c.id === updatedCategory.id);
    if (index >= 0) {
      categories[index] = { ...categories[index], ...updatedCategory, name: updatedCategory.name.trim() };
      this.saveCategories(categories);
    }
    return categories;
  },

  deleteCategory(categoryId: string): { categories: Category[]; products: Product[] } {
    let categories = this.getCategories().filter((c) => c.id !== categoryId);
    if (!categories.some((c) => c.id === 'all')) {
      categories = [{ id: 'all', name: 'Todos', color: '#6366f1' }, ...categories];
    }
    this.saveCategories(categories);

    // Reassign products with deleted category to fallback
    const fallbackCategory = categories.find((c) => c.id !== 'all')?.id || 'pasillo-1';
    const products = this.getProducts().map((p) => {
      if (p.category === categoryId) {
        return { ...p, category: fallbackCategory };
      }
      return p;
    });
    this.saveProducts(products);

    return { categories, products };
  },

  getSettings(): StoreSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
        return INITIAL_SETTINGS;
      }
      const parsed = JSON.parse(data);
      if (parsed.storeName === 'Mi Tiendita Express' || !parsed.storeName) {
        parsed.storeName = 'depos';
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...INITIAL_SETTINGS, ...parsed }));
      }
      return { ...INITIAL_SETTINGS, ...parsed };
    } catch {
      return INITIAL_SETTINGS;
    }
  },

  saveSettings(settings: StoreSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getLowStockProducts(): { product: Product; isCritical: boolean }[] {
    const products = this.getProducts();
    return products
      .filter((p) => p.stock <= p.minStockAlert)
      .map((p) => ({
        product: p,
        isCritical: p.stock <= Math.floor(p.minStockAlert / 2),
      }))
      .sort((a, b) => a.product.stock - b.product.stock);
  },

  // Export full store data to JSON file
  exportBackup(): string {
    const bundle = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      products: this.getProducts(),
      movements: this.getMovements(),
      categories: this.getCategories(),
      settings: this.getSettings(),
    };
    return JSON.stringify(bundle, null, 2);
  },

  importBackup(jsonString: string): boolean {
    try {
      const bundle = JSON.parse(jsonString);
      if (bundle.products && Array.isArray(bundle.products)) {
        this.saveProducts(bundle.products);
      }
      if (bundle.movements && Array.isArray(bundle.movements)) {
        this.saveMovements(bundle.movements);
      }
      if (bundle.categories && Array.isArray(bundle.categories)) {
        this.saveCategories(bundle.categories);
      }
      if (bundle.settings) {
        this.saveSettings(bundle.settings);
      }
      return true;
    } catch {
      return false;
    }
  },

  resetToInitial(): void {
    this.saveProducts(INITIAL_PRODUCTS);
    this.saveCategories(INITIAL_CATEGORIES);
    this.saveSettings(INITIAL_SETTINGS);
    this.saveMovements([]);
  },
};
