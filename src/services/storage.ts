import { Product, StockMovement, Category, StoreSettings, MovementType, MovementReason, UserRole } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_SETTINGS } from '../data/initialData';
import { AuthService } from './authService';
import { ShoppingService } from './shoppingService';
import { CloudBackupService } from './cloudBackupService';
import { AntiTheftService } from './antiTheftService';

const STORAGE_KEYS = {
  PRODUCTS: 'stock_app_products_v1',
  LOCAL_PENDING_PRODUCTS: 'stock_app_local_pending_products_v1',
  MOVEMENTS: 'stock_app_movements_v1',
  CATEGORIES: 'stock_app_categories_v1',
  SETTINGS: 'stock_app_settings_v1',
};

export const StorageService = {
  // Requirement 1: Manage local pending products for Secondary Device (Dispositivo Secundario)
  getLocalPendingProducts(): Product[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOCAL_PENDING_PRODUCTS);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveLocalPendingProducts(products: Product[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_PENDING_PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.error('Error guardando productos locales pendientes:', e);
    }
  },

  addLocalPendingProduct(product: Product): void {
    const list = this.getLocalPendingProducts();
    const idx = list.findIndex((p) => p.id === product.id || (p.barcodeUnit && p.barcodeUnit === product.barcodeUnit));
    if (idx >= 0) {
      list[idx] = product;
    } else {
      list.unshift(product);
    }
    this.saveLocalPendingProducts(list);
  },

  removeLocalPendingProduct(productId: string): void {
    const list = this.getLocalPendingProducts().filter(
      (p) => p.id !== productId && p.barcodeUnit !== productId && p.barcode !== productId
    );
    this.saveLocalPendingProducts(list);
  },

  clearLocalPendingProducts(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_PENDING_PRODUCTS);
    } catch {}
  },

  getProducts(): Product[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      let parsed: Product[] = [];
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
        parsed = [...INITIAL_PRODUCTS];
      } else {
        parsed = JSON.parse(data);
      }

      // Guarantee initial products exist if database was freshly initialized
      INITIAL_PRODUCTS.forEach((ip) => {
        if (!parsed.some((p) => p.id === ip.id || (p.barcodeUnit && p.barcodeUnit === ip.barcodeUnit))) {
          parsed.push(ip);
        }
      });

      // Requirement 1: Merge with localPendingProducts so newly created products are ALWAYS visible
      const localPending = this.getLocalPendingProducts();
      if (localPending.length > 0) {
        const existingIds = new Set(parsed.map((p) => p.id));
        let addedCount = 0;
        for (const lp of localPending) {
          if (!existingIds.has(lp.id)) {
            parsed.unshift(lp);
            existingIds.add(lp.id);
            addedCount++;
          }
        }
        if (addedCount > 0) {
          this.saveProducts(parsed);
        }
      }

      const oldCatMap: Record<string, string> = {
        bebidas: 'pasillo-1',
        snacks: 'pasillo-2',
        galletas: 'pasillo-3',
        cafe: 'pasillo-4',
        abarrotes: 'pasillo-5',
      };

      // Normalize to guarantee barcodeUnit, unitsPerBulk, and migrated category
      return parsed.map((p) => {
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
          costPriceBulk: p.costPriceBulk ?? Number(((p.costPrice || 0) * unitsPerBulk).toFixed(2)),
          sellingPriceBulk: p.sellingPriceBulk ?? Number(((p.sellingPrice || 0) * unitsPerBulk).toFixed(2)),
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
    CloudBackupService.triggerAutoBackup();
  },

  saveProduct(product: Product): Product[] {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === product.id);
    const unitsPerBulk = Number(product.unitsPerBulk) > 0 ? Number(product.unitsPerBulk) : 12;

    const settings = this.getSettings();
    const isClientRole = settings.syncConfig?.role === 'client';
    const currentUser = AuthService.getCurrentUser();
    const isClientOrUser = isClientRole || currentUser?.role !== 'admin';
    const deviceId = settings.syncConfig?.deviceId || (isClientRole ? 'dev-client-1' : 'dev-master-principal');
    const deviceName = settings.syncConfig?.deviceName || (isClientRole ? 'Terminal Móvil (Vendedor)' : 'Caja Principal (Mostrador)');

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
      if (isClientOrUser) {
        this.addLocalPendingProduct(normalizedProduct);
      }
    } else {
      const newProductRecord: Product = {
        ...normalizedProduct,
        id: product.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        isNewFromUser: product.isNewFromUser !== undefined ? product.isNewFromUser : isClientOrUser,
        addedByDeviceId: product.addedByDeviceId || deviceId,
        addedByDeviceName: product.addedByDeviceName || deviceName,
        addedByUserName: product.addedByUserName || currentUser?.name || 'Vendedor Móvil',
        addedAt: product.addedAt || new Date().toISOString(),
        reviewedByAdmin: product.reviewedByAdmin !== undefined ? product.reviewedByAdmin : !isClientOrUser,
      };

      updated = [newProductRecord, ...products];

      // Requirement 1: Dispositivo secundario guarda sus productos agregados en localPendingProducts
      if (isClientOrUser) {
        this.addLocalPendingProduct(newProductRecord);
      }
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

  rejectPendingProduct(productId: string): Product[] {
    this.removeLocalPendingProduct(productId);
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (raw) {
        const parsed: Product[] = JSON.parse(raw);
        const filtered = parsed.filter((p) => p.id !== productId && p.barcodeUnit !== productId && p.barcode !== productId);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(filtered));
      }
    } catch {}
    const products = this.getProducts().filter((p) => p.id !== productId && p.barcodeUnit !== productId && p.barcode !== productId);
    this.saveProducts(products);
    try {
      ShoppingService.removeFromReplenishmentList(productId);
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('reposition_updated', {
          detail: { productId, isPending: false },
        })
      );
    }
    return products;
  },

  deleteProduct(productId: string): Product[] {
    this.removeLocalPendingProduct(productId);
    const products = this.getProducts().filter((p) => p.id !== productId);
    this.saveProducts(products);
    return products;
  },

  // Cumulative restock addition for Ráfaga Dummies: increments Bultos or Unidades independently
  accumulateProductReposition(
    productId: string,
    mode: 'bulk' | 'unit',
    amount: number = 1,
    notes?: string
  ): { product: Product; bulksPending: number; unitsPending: number; totalUnits: number } | null {
    const products = this.getProducts();
    let product = products.find((p) => p.id === productId);

    const localPending = this.getLocalPendingProducts();
    const lpIndex = localPending.findIndex((p) => p.id === productId);

    if (!product && lpIndex >= 0) {
      product = { ...localPending[lpIndex] };
      products.unshift(product);
    }

    if (!product) return null;

    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);

    // Read existing independent counters
    let currentBulks = 0;
    let currentUnits = 0;

    if (product.repositionBulks !== undefined || product.repositionUnits !== undefined) {
      currentBulks = product.repositionBulks ?? 0;
      currentUnits = product.repositionUnits ?? 0;
    } else {
      const repList = ShoppingService.getReplenishmentList();
      const existingRep = repList.find((it) => it.productId === productId);
      if (existingRep && (existingRep.bulksPending !== undefined || existingRep.unitsPending !== undefined)) {
        currentBulks = existingRep.bulksPending ?? 0;
        currentUnits = existingRep.unitsPending ?? 0;
      } else if (product.isPendingReposition && product.repositionQuantity) {
        currentUnits = product.repositionQuantity;
      }
    }

    // REQUIREMENT 2 & 4: STRICT SEPARATION OF BULK VS UNIT IMPACT
    // If employee scans in "Modo: 1 Bulto", increment ONLY bulks
    // If employee scans in "Modo: 1 Unidad", increment ONLY units
    if (mode === 'bulk') {
      currentBulks = Math.max(0, currentBulks + amount);
    } else {
      currentUnits = Math.max(0, currentUnits + amount);
    }

    // Calculate total net units mathematically
    const totalUnits = (currentBulks * unitsPerBulk) + currentUnits;

    product.isPendingReposition = true;
    product.repositionBulks = currentBulks;
    product.repositionUnits = currentUnits;
    product.repositionQuantity = totalUnits;
    product.repositionNotes =
      notes ||
      product.repositionNotes ||
      `Pendiente: ${currentBulks} bultos y ${currentUnits} unidades (= ${totalUnits} uds)`;
    product.repositionAddedAt = new Date().toISOString();

    this.saveProducts(products);

    // Synchronize with ShoppingService
    ShoppingService.setReplenishmentBreakdown(productId, currentBulks, currentUnits, unitsPerBulk, product.repositionNotes);

    if (lpIndex >= 0) {
      localPending[lpIndex].isPendingReposition = true;
      localPending[lpIndex].repositionBulks = currentBulks;
      localPending[lpIndex].repositionUnits = currentUnits;
      localPending[lpIndex].repositionQuantity = totalUnits;
      localPending[lpIndex].repositionNotes = product.repositionNotes;
      localPending[lpIndex].repositionAddedAt = product.repositionAddedAt;
      this.saveLocalPendingProducts(localPending);
    }

    // Notify listeners so views and badge counters update in real time
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('reposition_updated', {
          detail: {
            productId,
            isPending: true,
            product: { ...product },
            bulksPending: currentBulks,
            unitsPending: currentUnits,
            totalUnits,
          },
        })
      );
    }

    CloudBackupService.triggerAutoBackup();

    return { product: { ...product }, bulksPending: currentBulks, unitsPending: currentUnits, totalUnits };
  },

  updateProductRepositionBreakdown(
    productId: string,
    bulksPending: number,
    unitsPending: number
  ): Product | null {
    const products = this.getProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return null;

    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
    const safeBulks = Math.max(0, Math.floor(bulksPending));
    const safeUnits = Math.max(0, Math.floor(unitsPending));
    const totalUnits = (safeBulks * unitsPerBulk) + safeUnits;

    product.repositionBulks = safeBulks;
    product.repositionUnits = safeUnits;
    product.repositionQuantity = totalUnits;
    product.isPendingReposition = totalUnits > 0;
    product.repositionNotes = `Pendiente: ${safeBulks} bultos y ${safeUnits} unidades (= ${totalUnits} uds)`;

    this.saveProducts(products);

    ShoppingService.setReplenishmentBreakdown(productId, safeBulks, safeUnits, unitsPerBulk);

    const localPending = this.getLocalPendingProducts();
    const lpIndex = localPending.findIndex((p) => p.id === productId);
    if (lpIndex >= 0) {
      localPending[lpIndex].isPendingReposition = product.isPendingReposition;
      localPending[lpIndex].repositionBulks = safeBulks;
      localPending[lpIndex].repositionUnits = safeUnits;
      localPending[lpIndex].repositionQuantity = totalUnits;
      localPending[lpIndex].repositionNotes = product.repositionNotes;
      this.saveLocalPendingProducts(localPending);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('reposition_updated', {
          detail: {
            productId,
            isPending: product.isPendingReposition,
            product: { ...product },
            bulksPending: safeBulks,
            unitsPending: safeUnits,
            totalUnits,
          },
        })
      );
    }

    return { ...product };
  },

  updateProductRepositionQuantity(productId: string, quantity: number): Product | null {
    const products = this.getProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return null;

    product.repositionQuantity = Math.max(0, quantity);
    if (quantity > 0) {
      product.isPendingReposition = true;
    }
    this.saveProducts(products);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('reposition_updated', {
          detail: { productId, isPending: product.isPendingReposition, product },
        })
      );
    }
    return product;
  },

  // Requirement 1 & 2: Toggle or set product reposition state and persist directly in database
  toggleProductReposition(
    productId: string,
    isPending?: boolean,
    notes?: string,
    quantity?: number,
    bulks?: number,
    units?: number
  ): Product | null {
    const products = this.getProducts();
    let product = products.find((p) => p.id === productId);

    const localPending = this.getLocalPendingProducts();
    const lpIndex = localPending.findIndex((p) => p.id === productId);

    if (!product && lpIndex >= 0) {
      product = { ...localPending[lpIndex] };
      products.unshift(product);
    }

    if (!product) return null;

    const newStatus = isPending !== undefined ? Boolean(isPending) : !product.isPendingReposition;
    product.isPendingReposition = newStatus;
    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);

    if (newStatus) {
      product.repositionNotes = notes || product.notes || 'Reponer en góndola';
      if (bulks !== undefined || units !== undefined) {
        product.repositionBulks = Math.max(0, Math.floor(bulks ?? 0));
        product.repositionUnits = Math.max(0, Math.floor(units ?? 0));
        product.repositionQuantity = (product.repositionBulks * unitsPerBulk) + product.repositionUnits;
      } else if (quantity && quantity > 0) {
        product.repositionQuantity = quantity;
        product.repositionBulks = unitsPerBulk > 1 ? Math.floor(quantity / unitsPerBulk) : 0;
        product.repositionUnits = unitsPerBulk > 1 ? quantity % unitsPerBulk : quantity;
      } else {
        product.repositionBulks = product.repositionBulks ?? 0;
        product.repositionUnits = product.repositionUnits ?? 0;
        product.repositionQuantity = (product.repositionBulks * unitsPerBulk) + product.repositionUnits;
      }
      product.repositionAddedAt = new Date().toISOString();
      ShoppingService.setReplenishmentBreakdown(
        productId,
        product.repositionBulks,
        product.repositionUnits,
        unitsPerBulk,
        product.repositionNotes
      );
    } else {
      product.repositionAddedAt = undefined;
      product.repositionBulks = 0;
      product.repositionUnits = 0;
      product.repositionQuantity = 0;
      ShoppingService.removeFromReplenishmentList(productId);
    }

    this.saveProducts(products);

    if (lpIndex >= 0) {
      localPending[lpIndex].isPendingReposition = newStatus;
      if (newStatus) {
        localPending[lpIndex].repositionNotes = product.repositionNotes;
        localPending[lpIndex].repositionQuantity = product.repositionQuantity;
        localPending[lpIndex].repositionBulks = product.repositionBulks;
        localPending[lpIndex].repositionUnits = product.repositionUnits;
        localPending[lpIndex].repositionAddedAt = product.repositionAddedAt;
      } else {
        localPending[lpIndex].repositionAddedAt = undefined;
        localPending[lpIndex].repositionBulks = 0;
        localPending[lpIndex].repositionUnits = 0;
        localPending[lpIndex].repositionQuantity = 0;
      }
      this.saveLocalPendingProducts(localPending);
    }

    // Notify listeners so views and badge counters update immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('reposition_updated', {
          detail: {
            productId,
            isPending: newStatus,
            product: { ...product },
            bulksPending: product.repositionBulks ?? 0,
            unitsPending: product.repositionUnits ?? 0,
            totalUnits: product.repositionQuantity ?? 0,
          },
        })
      );
    }

    CloudBackupService.triggerAutoBackup();

    return { ...product };
  },

  getRepositionProducts(): Product[] {
    const products = this.getProducts();
    const repList = ShoppingService.getReplenishmentList();
    const repPendingIds = new Set(repList.filter((item) => item.status === 'pending').map((item) => item.productId));

    return products.filter((p) => p.isPendingReposition === true || repPendingIds.has(p.id));
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

    // Escudo Antivuelco: Respaldo automático invisible en segundo plano
    CloudBackupService.triggerAutoBackup();

    return { product: updatedProduct, movement };
  },

  verifyProductGondola(productId: string, notes?: string): { product: Product; movement: StockMovement } {
    const products = this.getProducts();
    const productIndex = products.findIndex((p) => p.id === productId);
    if (productIndex === -1) {
      throw new Error('Producto no encontrado');
    }

    const currentProduct = products[productIndex];
    const nowIso = new Date().toISOString();

    const updatedProduct: Product = {
      ...currentProduct,
      lastVerifiedAt: nowIso,
      lastUpdated: nowIso,
    };
    products[productIndex] = updatedProduct;
    this.saveProducts(products);

    const currentUser = AuthService.getCurrentUser();
    const activeUserId = currentUser?.id;
    const activeUserName = currentUser?.name || 'Empleado';
    const activeUserRole = currentUser?.role || 'user';

    const movement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: currentProduct.id,
      productName: currentProduct.name,
      barcode: currentProduct.barcodeUnit || currentProduct.barcode,
      barcodeScanned: currentProduct.barcodeUnit,
      format: 'unit',
      unitType: 'unit',
      type: 'in',
      quantity: 0,
      previousStock: currentProduct.stock,
      newStock: currentProduct.stock,
      reason: 'verificacion',
      notes: notes || 'Verificado: Góndola OK (Control de inactividad)',
      timestamp: nowIso,
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
    const updatedMovements = [movement, ...movements].slice(0, 500);
    this.saveMovements(updatedMovements);

    CloudBackupService.triggerAutoBackup();

    return { product: updatedProduct, movement };
  },

  getMovements(): StockMovement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
      if (!data) return [];
      const parsed: StockMovement[] = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
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
      expirations: (() => {
        try {
          return JSON.parse(localStorage.getItem('depos_expiration_agenda') || '[]');
        } catch {
          return [];
        }
      })(),
      replenishmentList: ShoppingService.getReplenishmentList(),
      shoppingList: ShoppingService.getShoppingList(),
    };
    return JSON.stringify(bundle, null, 2);
  },

  /**
   * Recálculo Matemático Obligatorio de Existencias (Fix Talco):
   * Recalcula el stock neto real sumando todas las entradas y restando todas las salidas
   * que figuren en la lista de movimientos unificada de cada producto.
   * Esto actualiza los casilleros superiores de Total Unidades y Bultos Cerrados.
   */
  recalculateStockFromMovements(
    customProducts?: Product[],
    customMovements?: StockMovement[]
  ): { products: Product[]; updatedCount: number } {
    const products = customProducts ? [...customProducts] : this.getProducts();
    const movements = customMovements ? [...customMovements] : this.getMovements();

    let updatedCount = 0;

    // Index movements by productId and by barcodes
    const movementsByProduct = new Map<string, StockMovement[]>();
    for (const m of movements) {
      if (!m.productId) continue;
      const list = movementsByProduct.get(m.productId) || [];
      list.push(m);
      movementsByProduct.set(m.productId, list);
    }

    const updatedProducts = products.map((p) => {
      // Find all movements matching this product either by ID or barcode
      const directMovements = movementsByProduct.get(p.id) || [];
      const cleanBarUnit = (p.barcodeUnit || '').trim().toLowerCase();
      const cleanBar = (p.barcode || '').trim().toLowerCase();
      const cleanBarBulk = (p.barcodeBulk || '').trim().toLowerCase();

      const barcodeMovements = movements.filter((m) => {
        if (m.productId === p.id) return false;
        const mBar = (m.barcode || '').trim().toLowerCase();
        const mScan = (m.barcodeScanned || '').trim().toLowerCase();
        return (
          (cleanBarUnit && (mBar === cleanBarUnit || mScan === cleanBarUnit)) ||
          (cleanBar && (mBar === cleanBar || mScan === cleanBar)) ||
          (cleanBarBulk && (mBar === cleanBarBulk || mScan === cleanBarBulk))
        );
      });

      const allProdMovements = [...directMovements, ...barcodeMovements];
      const unitsPerBulk = Math.max(1, Number(p.unitsPerBulk) || 12);
      const baseStock = Number(p.baselineStock) || 0;

      if (allProdMovements.length > 0 || p.baselineStock !== undefined) {
        let inSum = 0;
        let outSum = 0;
        for (const m of allProdMovements) {
          const qty = Number(m.quantity) || 0;
          if (m.type === 'in') {
            inSum += qty;
          } else if (m.type === 'out') {
            outSum += qty;
          }
        }
        // Consolidación Matemática: Stock Inicial de Resguardo + Entradas - Salidas
        const netStock = Math.max(0, baseStock + inSum - outSum);
        if (p.stock !== netStock) {
          updatedCount++;
        }
        return {
          ...p,
          stock: netStock,
          unitsPerBulk,
          bulkUnitName: p.bulkUnitName || `Caja x${unitsPerBulk}`,
          lastUpdated: new Date().toISOString(),
        };
      }

      return {
        ...p,
        stock: Math.max(0, Number(p.stock) || 0),
        unitsPerBulk,
        bulkUnitName: p.bulkUnitName || `Caja x${unitsPerBulk}`,
      };
    });

    if (!customProducts) {
      this.saveProducts(updatedProducts);
    }

    return { products: updatedProducts, updatedCount };
  },

  /**
   * Función de "Purga Histórica Segura" (Mantenimiento de Base de Datos):
   * Permite al Administrador borrar movimientos históricos por rango de fecha.
   * Lógica de Consolidación Matemática (No alterar el Stock):
   * 1. Calcula el balance neto de los productos dentro del rango purgado.
   * 2. Almacena ese valor acumulado de forma fija como "Stock Inicial de Resguardo" (baselineStock).
   * 3. Elimina de forma segura los renglones físicos del historial antiguo de la BD local para liberar almacenamiento.
   * 4. Recalcula las existencias sumando el "Stock Inicial de Resguardo" + movimientos sobrevivientes,
   *    manteniendo los totales superiores (como las 141 unidades de talco) 100% exactos e intactos.
   */
  purgeHistoricalMovements(options: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
  }): {
    success: boolean;
    message: string;
    purgedCount: number;
    affectedProductsCount: number;
    remainingCount: number;
  } {
    try {
      const allMovements = this.getMovements();
      if (allMovements.length === 0) {
        return {
          success: false,
          message: 'No hay movimientos registrados en el historial para purgar.',
          purgedCount: 0,
          affectedProductsCount: 0,
          remainingCount: 0,
        };
      }

      const startMs = options.startDate
        ? new Date(`${options.startDate}T00:00:00`).getTime()
        : 0;
      const endMs = options.endDate
        ? new Date(`${options.endDate}T23:59:59.999`).getTime()
        : Date.now();

      const movementsToPurge = allMovements.filter((m) => {
        const mTime = new Date(m.timestamp).getTime();
        return mTime >= startMs && mTime <= endMs;
      });

      if (movementsToPurge.length === 0) {
        return {
          success: false,
          message: 'No se encontraron movimientos dentro del rango de fecha seleccionado.',
          purgedCount: 0,
          affectedProductsCount: 0,
          remainingCount: allMovements.length,
        };
      }

      const purgeIds = new Set(movementsToPurge.map((m) => m.id));
      const remainingMovements = allMovements.filter((m) => !purgeIds.has(m.id));

      const products = this.getProducts();
      let affectedProductsCount = 0;

      // Calcular el impacto neto de los movimientos purgados para cada producto
      const updatedProducts = products.map((p) => {
        const cleanBarUnit = (p.barcodeUnit || '').trim().toLowerCase();
        const cleanBar = (p.barcode || '').trim().toLowerCase();
        const cleanBarBulk = (p.barcodeBulk || '').trim().toLowerCase();

        const prodPurgedMovements = movementsToPurge.filter((m) => {
          if (m.productId === p.id) return true;
          const mBar = (m.barcode || '').trim().toLowerCase();
          const mScan = (m.barcodeScanned || '').trim().toLowerCase();
          return (
            (cleanBarUnit && (mBar === cleanBarUnit || mScan === cleanBarUnit)) ||
            (cleanBar && (mBar === cleanBar || mScan === cleanBar)) ||
            (cleanBarBulk && (mBar === cleanBarBulk || mScan === cleanBarBulk))
          );
        });

        if (prodPurgedMovements.length > 0) {
          let purgedIn = 0;
          let purgedOut = 0;
          for (const m of prodPurgedMovements) {
            const qty = Number(m.quantity) || 0;
            if (m.type === 'in') purgedIn += qty;
            else if (m.type === 'out') purgedOut += qty;
          }
          const netPurged = purgedIn - purgedOut;
          affectedProductsCount++;

          // Calcular balance de movimientos sobrevivientes para este producto
          const prodSurvivingMovements = remainingMovements.filter((m) => {
            if (m.productId === p.id) return true;
            const mBar = (m.barcode || '').trim().toLowerCase();
            const mScan = (m.barcodeScanned || '').trim().toLowerCase();
            return (
              (cleanBarUnit && (mBar === cleanBarUnit || mScan === cleanBarUnit)) ||
              (cleanBar && (mBar === cleanBar || mScan === cleanBar)) ||
              (cleanBarBulk && (mBar === cleanBarBulk || mScan === cleanBarBulk))
            );
          });
          let survivingIn = 0;
          let survivingOut = 0;
          for (const sm of prodSurvivingMovements) {
            const qty = Number(sm.quantity) || 0;
            if (sm.type === 'in') survivingIn += qty;
            else if (sm.type === 'out') survivingOut += qty;
          }
          const netSurviving = survivingIn - survivingOut;

          // Consolidación Matemática Fija:
          // Stock Inicial de Resguardo = balance acumulado hasta la fecha de corte
          let newBaseline: number;
          if (p.baselineStock !== undefined) {
            newBaseline = Math.max(0, Number(p.baselineStock) + netPurged);
          } else {
            newBaseline = Math.max(0, Number(p.stock) - netSurviving);
          }

          return {
            ...p,
            baselineStock: newBaseline,
            baselineStockDate: new Date().toISOString(),
          };
        }

        return p;
      });

      // Guardar productos y movimientos tras purga
      this.saveProducts(updatedProducts);
      this.saveMovements(remainingMovements);

      // Recalcular stock matemático final unificado
      this.recalculateStockFromMovements(updatedProducts, remainingMovements);

      // Respaldo silencioso en la nube
      CloudBackupService.triggerAutoBackup();

      return {
        success: true,
        message: `Purga histórica completada con éxito. Se eliminaron ${movementsToPurge.length} movimientos antiguos de la base de datos local y se consolidó el Stock Inicial de Resguardo de ${affectedProductsCount} producto(s). Los totales de unidades y bultos permanecen 100% exactos e intactos.`,
        purgedCount: movementsToPurge.length,
        affectedProductsCount,
        remainingCount: remainingMovements.length,
      };
    } catch (e: any) {
      console.error('Error in purgeHistoricalMovements:', e);
      return {
        success: false,
        message: 'Error al purgar movimientos: ' + (e?.message || e),
        purgedCount: 0,
        affectedProductsCount: 0,
        remainingCount: 0,
      };
    }
  },

  /**
   * Importación JSON con Fusión Inteligente de Historiales y Recálculo de Existencias (Fix Talco):
   * - No sobreescribe ciegamente la base de datos local.
   * - Compara productos por código de barras (barcodeUnit, barcode, barcodeBulk).
   * - Fusiona historiales de Movimientos Recientes cruzando fechas y horas (timestamps) sin duplicados.
   * - Ejecuta el recálculo matemático de entradas y salidas unificadas para actualizar Total Unidades y Bultos Cerrados.
   */
  importBackup(jsonString: string): {
    success: boolean;
    message: string;
    mergedProductsCount: number;
    mergedMovementsCount: number;
    recalculatedCount: number;
  } {
    try {
      const trimmed = (jsonString || '').trim();
      if (!trimmed) {
        return {
          success: false,
          message: 'El texto JSON está vacío. Pega o carga un contenido válido.',
          mergedProductsCount: 0,
          mergedMovementsCount: 0,
          recalculatedCount: 0,
        };
      }

      const rawParsed = JSON.parse(trimmed);
      const bundle = rawParsed.data ? rawParsed.data : rawParsed;

      let incomingProducts: Product[] = [];
      if (Array.isArray(bundle.products)) {
        incomingProducts = [...bundle.products];
      } else if (Array.isArray(bundle)) {
        incomingProducts = [...bundle];
      }

      if (Array.isArray(bundle.localPendingProducts)) {
        for (const lp of bundle.localPendingProducts) {
          if (!incomingProducts.some((p) => p.id === lp.id)) {
            incomingProducts.push(lp);
          }
        }
      }

      const incomingMovements: StockMovement[] = Array.isArray(bundle.movements)
        ? bundle.movements
        : [];

      if (incomingProducts.length === 0 && incomingMovements.length === 0) {
        return {
          success: false,
          message: 'No se encontraron productos ni movimientos en el archivo o texto pegado.',
          mergedProductsCount: 0,
          mergedMovementsCount: 0,
          recalculatedCount: 0,
        };
      }

      const localProducts = this.getProducts();
      const localMovements = this.getMovements();

      const cleanCode = (c?: string) => (c || '').trim().toLowerCase();

      // Index existing local products by barcodes and ID
      const barcodeToLocalProduct = new Map<string, Product>();
      const idToLocalProduct = new Map<string, Product>();

      for (const lp of localProducts) {
        idToLocalProduct.set(lp.id, lp);
        if (cleanCode(lp.barcodeUnit)) barcodeToLocalProduct.set(cleanCode(lp.barcodeUnit), lp);
        if (cleanCode(lp.barcode)) barcodeToLocalProduct.set(cleanCode(lp.barcode), lp);
        if (cleanCode(lp.barcodeBulk)) barcodeToLocalProduct.set(cleanCode(lp.barcodeBulk), lp);
      }

      const idMapping = new Map<string, string>(); // incoming.id -> target unified ID
      const unifiedProductsMap = new Map<string, Product>();
      localProducts.forEach((lp) => unifiedProductsMap.set(lp.id, { ...lp }));

      // Step 1: Intelligent Product Merging (Fusión inteligente de productos por código de barras)
      for (const inc of incomingProducts) {
        const incUnit = cleanCode(inc.barcodeUnit);
        const incBar = cleanCode(inc.barcode);
        const incBulk = cleanCode(inc.barcodeBulk);

        let matched =
          (incUnit && barcodeToLocalProduct.get(incUnit)) ||
          (incBar && barcodeToLocalProduct.get(incBar)) ||
          (incBulk && barcodeToLocalProduct.get(incBulk)) ||
          idToLocalProduct.get(inc.id);

        if (!matched && !incUnit && !incBar && inc.name) {
          const incName = inc.name.trim().toLowerCase();
          matched = localProducts.find((p) => p.name.trim().toLowerCase() === incName);
        }

        if (matched) {
          const targetId = matched.id;
          idMapping.set(inc.id, targetId);

          const existingInMap = unifiedProductsMap.get(targetId) || matched;
          const unitsPerBulk = Math.max(1, Number(existingInMap.unitsPerBulk || inc.unitsPerBulk || 12));

          const merged: Product = {
            ...existingInMap,
            name: existingInMap.name || inc.name,
            barcode: existingInMap.barcode || inc.barcode || inc.barcodeUnit,
            barcodeUnit: existingInMap.barcodeUnit || inc.barcodeUnit || inc.barcode,
            barcodeBulk: existingInMap.barcodeBulk || inc.barcodeBulk,
            unitsPerBulk,
            bulkUnitName: existingInMap.bulkUnitName || inc.bulkUnitName || `Caja x${unitsPerBulk}`,
            category: existingInMap.category || inc.category || 'General',
            costPrice: Number(existingInMap.costPrice || inc.costPrice || 0),
            sellingPrice: Number(existingInMap.sellingPrice || inc.sellingPrice || 0),
            costPriceBulk: Number(existingInMap.costPriceBulk || inc.costPriceBulk || 0),
            sellingPriceBulk: Number(existingInMap.sellingPriceBulk || inc.sellingPriceBulk || 0),
            // Preservar fotos locales si existen, o tomar la entrante
            image: existingInMap.image || inc.image,
            suggestedGondolaQuantity: existingInMap.suggestedGondolaQuantity || inc.suggestedGondolaQuantity,
            minStockAlert: existingInMap.minStockAlert || inc.minStockAlert || 5,
            minStockAlertUnit: existingInMap.minStockAlertUnit || inc.minStockAlertUnit,
            minStockAlertBulk: existingInMap.minStockAlertBulk || inc.minStockAlertBulk,
            unit: existingInMap.unit || inc.unit || 'uds',
            notes: existingInMap.notes || inc.notes,
            lastVerifiedAt: existingInMap.lastVerifiedAt || inc.lastVerifiedAt,
            baselineStock: existingInMap.baselineStock !== undefined ? existingInMap.baselineStock : inc.baselineStock,
            baselineStockDate: existingInMap.baselineStockDate || inc.baselineStockDate,
            lastUpdated: new Date().toISOString(),
          };

          unifiedProductsMap.set(targetId, merged);
        } else {
          // Producto nuevo proveniente del otro teléfono
          const newId = inc.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          idMapping.set(inc.id, newId);

          const unitsPerBulk = Math.max(1, Number(inc.unitsPerBulk) || 12);
          const newProd: Product = {
            ...inc,
            id: newId,
            unitsPerBulk,
            bulkUnitName: inc.bulkUnitName || `Caja x${unitsPerBulk}`,
            barcode: inc.barcodeUnit || inc.barcode,
            barcodeUnit: inc.barcodeUnit || inc.barcode,
            baselineStock: inc.baselineStock,
            baselineStockDate: inc.baselineStockDate,
            lastUpdated: new Date().toISOString(),
          };

          unifiedProductsMap.set(newId, newProd);
          if (cleanCode(newProd.barcodeUnit)) barcodeToLocalProduct.set(cleanCode(newProd.barcodeUnit), newProd);
          if (cleanCode(newProd.barcode)) barcodeToLocalProduct.set(cleanCode(newProd.barcode), newProd);
          if (cleanCode(newProd.barcodeBulk)) barcodeToLocalProduct.set(cleanCode(newProd.barcodeBulk), newProd);
          idToLocalProduct.set(newId, newProd);
        }
      }

      // Step 2: Intelligent Movement Merging (fusión cruzando fechas y horas timestamps para no duplicar)
      const mergedMovements: StockMovement[] = [...localMovements];

      for (const rawM of incomingMovements) {
        const targetProdId = idMapping.get(rawM.productId) || rawM.productId;
        const normalizedM: StockMovement = {
          ...rawM,
          productId: targetProdId,
        };

        const mTime = new Date(normalizedM.timestamp).getTime();

        const isDuplicate = mergedMovements.some((existingM) => {
          if (existingM.id && normalizedM.id && existingM.id === normalizedM.id) {
            return true;
          }
          if (
            existingM.productId === normalizedM.productId &&
            existingM.type === normalizedM.type &&
            Number(existingM.quantity) === Number(normalizedM.quantity)
          ) {
            const eTime = new Date(existingM.timestamp).getTime();
            if (existingM.timestamp === normalizedM.timestamp || Math.abs(eTime - mTime) < 3000) {
              return true;
            }
          }
          return false;
        });

        if (!isDuplicate) {
          mergedMovements.push(normalizedM);
        }
      }

      // Ordenar por fecha descendente
      mergedMovements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Step 3: Recálculo Matemático Obligatorio de Existencias (Fix Talco)
      const unifiedProductsList = Array.from(unifiedProductsMap.values());
      const { products: finalProducts, updatedCount } = this.recalculateStockFromMovements(
        unifiedProductsList,
        mergedMovements
      );

      // Persistir catálogo y movimientos actualizados
      this.saveProducts(finalProducts);
      this.saveMovements(mergedMovements.slice(0, 1000));

      // Fusión opcional de categorías
      if (Array.isArray(bundle.categories)) {
        const currentCats = this.getCategories();
        for (const cat of bundle.categories) {
          if (!currentCats.some((c) => c.id === cat.id || c.name.toLowerCase() === cat.name.toLowerCase())) {
            currentCats.push(cat);
          }
        }
        this.saveCategories(currentCats);
      }

      // Fusión opcional de expiraciones
      if (Array.isArray(bundle.expirations)) {
        try {
          const rawExp = localStorage.getItem('depos_expiration_agenda');
          const currentExp: any[] = rawExp ? JSON.parse(rawExp) : [];
          for (const exp of bundle.expirations) {
            const targetExpProdId = idMapping.get(exp.productId) || exp.productId;
            if (
              !currentExp.some(
                (e) =>
                  e.id === exp.id ||
                  (e.productId === targetExpProdId && e.expirationDate === exp.expirationDate)
              )
            ) {
              currentExp.push({ ...exp, productId: targetExpProdId });
            }
          }
          localStorage.setItem('depos_expiration_agenda', JSON.stringify(currentExp));
          window.dispatchEvent(new CustomEvent('expirations_updated', { detail: currentExp }));
        } catch {}
      }

      // Fusión opcional de reposición y compras
      if (Array.isArray(bundle.replenishmentList)) {
        try {
          ShoppingService.mergeReplenishmentList(bundle.replenishmentList);
        } catch {}
      }
      if (Array.isArray(bundle.shoppingList)) {
        try {
          ShoppingService.mergeShoppingList(bundle.shoppingList);
        } catch {}
      }

      // Respaldo silencioso en la nube
      CloudBackupService.triggerAutoBackup();

      // Reiniciar reloj antirrobo de 48 horas al sincronizar datos
      AntiTheftService.recordSuccessfulSync();

      return {
        success: true,
        message: `¡Fusión inteligente completada! Se unificaron ${finalProducts.length} productos y ${mergedMovements.length} movimientos. Se recalcularon las existencias de ${updatedCount} artículo(s) de acuerdo al historial unificado.`,
        mergedProductsCount: finalProducts.length,
        mergedMovementsCount: mergedMovements.length,
        recalculatedCount: updatedCount,
      };
    } catch (e: any) {
      console.error('Error in importBackup:', e);
      return {
        success: false,
        message: 'Error al procesar el archivo o texto JSON: ' + (e?.message || e),
        mergedProductsCount: 0,
        mergedMovementsCount: 0,
        recalculatedCount: 0,
      };
    }
  },

  resetToInitial(): void {
    this.saveProducts(INITIAL_PRODUCTS);
    this.saveCategories(INITIAL_CATEGORIES);
    this.saveSettings(INITIAL_SETTINGS);
    this.saveMovements([]);
  },
};
