import QRCode from 'qrcode';
import { Product, StockMovement, Category, StoreSettings, DeviceSyncConfig, SyncRole, SyncPayload, SyncStatus } from '../types';
import { StorageService } from './storage';
import { ShoppingService } from './shoppingService';
import { AuthService } from './authService';
import { compressDataUrl } from '../utils/imageCompressor';

export interface OptimizedExportResult {
  json: string;
  totalChars: number;
  sizeKB: number;
  imagesStripped: boolean;
  imagesCompressed: boolean;
  isSafeForClipboard: boolean;
  reason?: string;
  productCount: number;
}

const DEFAULT_HOTSPOT_IP = '192.168.43.1';
const DEFAULT_PORT = 3000;
const MAX_SAFE_CLIPBOARD_CHARS = 19500; // Limit below Android 20,000 chars clipboard truncation

export const SyncService = {
  // Determine local server URL reliably across Android Hotspot / Capacitor / Localhost
  getServerBaseUrl(): string {
    const config = this.getDeviceConfig();
    if (config.serverUrl && config.serverUrl.trim().length > 0 && !config.serverUrl.includes('.run.app')) {
      return config.serverUrl.trim().replace(/\/+$/, '');
    }

    if (config.hostIp && config.hostIp.trim().length > 0) {
      const port = config.port || DEFAULT_PORT;
      return `http://${config.hostIp.trim()}:${port}`;
    }

    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const isCapacitorOrLocalMobile =
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'content:' ||
        (origin.includes('localhost') && !origin.includes(':3000'));

      if (isCapacitorOrLocalMobile) {
        // Android default hotspot gateway
        return `http://${DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`;
      }

      return origin.replace(/\/+$/, '');
    }

    return `http://${DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`;
  },

  getDeviceConfig(): DeviceSyncConfig {
    const settings = StorageService.getSettings();
    if (settings.syncConfig) {
      const cfg = { ...settings.syncConfig };
      // Purge any stale external cloud run url
      if (cfg.serverUrl && cfg.serverUrl.includes('.run.app')) {
        cfg.hostIp = DEFAULT_HOTSPOT_IP;
        cfg.port = DEFAULT_PORT;
        cfg.serverUrl = `http://${DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`;
        this.saveDeviceConfig(cfg);
      }
      // If role is client but deviceId is still the default master ID, give it a unique client ID
      if (cfg.role === 'client' && (cfg.deviceId === 'dev-master-principal' || cfg.deviceId.startsWith('dev-master'))) {
        cfg.deviceId = `dev-client-${Math.random().toString(36).substring(2, 8)}`;
        if (cfg.deviceName === 'Caja Principal (Mostrador)') {
          cfg.deviceName = 'Terminal Móvil (Vendedor)';
        }
        this.saveDeviceConfig(cfg);
      }
      return cfg;
    }

    // Default configuration for a new device (100% offline local hotspot / P2P)
    const defaultConfig: DeviceSyncConfig = {
      deviceId: `dev-${Math.random().toString(36).substring(2, 8)}`,
      deviceName: 'Caja Principal (Mostrador)',
      role: 'master',
      syncCode: 'TIENDA-7894',
      hostIp: DEFAULT_HOTSPOT_IP,
      port: DEFAULT_PORT,
      serverUrl: `http://${DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`,
      autoSync: true,
      lastSyncTimestamp: undefined,
      connectedDevices: [],
    };

    StorageService.saveSettings({
      ...settings,
      syncConfig: defaultConfig,
    });

    return defaultConfig;
  },

  saveDeviceConfig(config: DeviceSyncConfig): void {
    const settings = StorageService.getSettings();
    StorageService.saveSettings({
      ...settings,
      syncConfig: config,
    });
  },

  // Generates complete snapshot payload for synchronization
  createSyncPayload(options?: { stripImages?: boolean }): SyncPayload {
    const config = this.getDeviceConfig();
    const currentUser = AuthService.getCurrentUser();
    const localPending = StorageService.getLocalPendingProducts();

    // Requirement 2: Combine current products with localPendingProducts ensuring no newly created product is lost
    const productsMap = new Map<string, Product>();
    for (const p of StorageService.getProducts()) {
      productsMap.set(p.id, { ...p });
    }
    for (const lp of localPending) {
      productsMap.set(lp.id, { ...lp });
    }
    let combinedProducts = Array.from(productsMap.values());
    let pendingProductsCopy = localPending.map((p) => ({ ...p }));

    // Strip images if requested or needed for size optimization
    if (options?.stripImages) {
      combinedProducts = combinedProducts.map((p) => {
        const copy = { ...p };
        delete copy.image;
        return copy;
      });
      pendingProductsCopy = pendingProductsCopy.map((p) => {
        const copy = { ...p };
        delete copy.image;
        return copy;
      });
    }

    return {
      version: 3,
      storeCode: config.syncCode.trim().toUpperCase(),
      role: config.role, // 'client' or 'master'
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      userName: currentUser?.name || (config.role === 'client' ? 'Vendedor Móvil' : 'Administrador'),
      userRole: currentUser?.role || (config.role === 'master' ? 'admin' : 'user'),
      timestamp: new Date().toISOString(),
      products: combinedProducts,
      localPendingProducts: pendingProductsCopy, // Requirement 1 & 2: Packaged cleanly
      movements: StorageService.getMovements(),
      shoppingList: ShoppingService.getShoppingList(),
      replenishmentList: ShoppingService.getReplenishmentList(),
      categories: StorageService.getCategories(),
      settings: StorageService.getSettings(),
    };
  },

  // Safe helper to parse JSON and never crash with "Unexpected token '<', <!doctype..."
  async parseSafeResponse(response: Response): Promise<{ ok: boolean; status: number; data: any; errorMessage?: string }> {
    const text = await response.text();
    let data: any = null;

    try {
      data = JSON.parse(text);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data,
          errorMessage: data?.error || `Error ${response.status} del servidor`,
        };
      }
      return { ok: true, status: response.status, data };
    } catch {
      // Body was HTML or non-JSON!
      let friendlyMsg = `El servidor respondió con código ${response.status}.`;
      if (response.status === 404) {
        friendlyMsg = 'No se encontró la ruta en el servidor de sincronización. Verifica la URL configurada.';
      } else if (response.status === 413 || text.includes('PayloadTooLarge')) {
        friendlyMsg = 'El volumen de datos o fotos de productos excede el límite del servidor.';
      } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        friendlyMsg = `No se pudo conectar con el servicio de sincronización (código ${response.status}). Verifica que el servidor esté activo o revisa la URL en Ajustes de Sincronización.`;
      }
      return {
        ok: false,
        status: response.status,
        data: null,
        errorMessage: friendlyMsg,
      };
    }
  },

  // Test server connectivity / ping
  async testServerConnection(testUrl?: string): Promise<{ success: boolean; message: string; latency?: number }> {
    const baseUrl = (testUrl || this.getServerBaseUrl()).replace(/\/+$/, '');
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      const parsed = await this.parseSafeResponse(response);

      if (parsed.ok) {
        return {
          success: true,
          message: `Conexión exitosa con el servidor (${latency} ms).`,
          latency,
        };
      } else {
        return {
          success: false,
          message: parsed.errorMessage || `Error ${response.status} al contactar servidor.`,
        };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Tiempo de espera agotado al conectar con el servidor (timeout 6s).' };
      }
      return { success: false, message: `Error de red: ${err.message || 'No se puede alcanzar el servidor'}` };
    }
  },

  // UNIFIED BIDIRECTIONAL SYNC: works seamlessly for both Master and Client!
  async syncDatabase(customCode?: string): Promise<{
    success: boolean;
    message: string;
    productsCount?: number;
    movementsCount?: number;
    appliedMovements?: number;
    newProductsAdded?: number;
    newUserAlertsCount?: number;
    timestamp?: string;
  }> {
    const config = this.getDeviceConfig();
    const code = (customCode || config.syncCode).trim().toUpperCase();

    if (!code) {
      return { success: false, message: 'Ingresa el Código de Tienda para sincronizar' };
    }

    const payload = this.createSyncPayload();
    payload.storeCode = code;
    const baseUrl = this.getServerBaseUrl();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const response = await fetch(`${baseUrl}/api/sync/store/${encodeURIComponent(code)}/full-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const parsed = await this.parseSafeResponse(response);
      if (!parsed.ok) {
        throw new Error(parsed.errorMessage || `Error ${parsed.status} en la sincronización`);
      }

      const resData = parsed.data;
      const now = new Date().toISOString();

      // 1. Update Products locally
      if (Array.isArray(resData.products) && resData.products.length > 0) {
        StorageService.saveProducts(resData.products);
        // Requirement 1 & 3: Clear local pending queue once server has successfully processed them
        if (config.role === 'client') {
          StorageService.clearLocalPendingProducts();
        }
      }

      // 2. Update Movements locally (all movements marked synced)
      if (Array.isArray(resData.movements)) {
        const markedSynced = resData.movements.map((m: any) => ({ ...m, synced: true }));
        StorageService.saveMovements(markedSynced);
      }

      // 3. Merge Shopping and Replenishment lists
      if (Array.isArray(resData.shoppingList)) {
        ShoppingService.mergeShoppingList(resData.shoppingList);
      }
      if (Array.isArray(resData.replenishmentList)) {
        ShoppingService.mergeReplenishmentList(resData.replenishmentList);
      }

      // 4. Update Categories
      if (Array.isArray(resData.categories) && resData.categories.length > 0) {
        StorageService.saveCategories(resData.categories);
      }

      // 5. Update Device Config
      this.saveDeviceConfig({
        ...config,
        syncCode: code,
        lastSyncTimestamp: now,
        connectedDevices: resData.connectedDevices || config.connectedDevices,
      });

      const newUserAlertsCount = (resData.newProductsAlerts || []).length;
      let summaryMsg = `Sincronización exitosa (${resData.products?.length || 0} productos actualizados).`;
      if (resData.appliedMovementsCount > 0) {
        summaryMsg += ` Se calcularon ${resData.appliedMovementsCount} nuevos movimientos de stock.`;
      }
      if (newUserAlertsCount > 0) {
        summaryMsg += ` ⚠️ Hay ${newUserAlertsCount} producto(s) nuevo(s) agregado(s) por usuarios.`;
      }

      return {
        success: true,
        message: summaryMsg,
        productsCount: resData.products?.length || 0,
        movementsCount: resData.movements?.length || 0,
        appliedMovements: resData.appliedMovementsCount || 0,
        newProductsAdded: resData.newProductsAddedCount || 0,
        newUserAlertsCount,
        timestamp: now,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'La sincronización excedió el tiempo límite (timeout 20s). Verifica tu conexión.' };
      }
      return {
        success: false,
        message: err.message || 'Error de conexión con el servidor de sincronización.',
      };
    }
  },

  // Dispositivo Principal publishes database
  async publishMasterDatabase(): Promise<{ success: boolean; message: string; timestamp: string }> {
    const res = await this.syncDatabase();
    return {
      success: res.success,
      message: res.message,
      timestamp: res.timestamp || new Date().toISOString(),
    };
  },

  // Dispositivo Secundario pulls and synchronizes with Master
  async pullMasterDatabase(customCode?: string): Promise<{
    success: boolean;
    message: string;
    productsCount?: number;
    movementsCount?: number;
    timestamp?: string;
  }> {
    const res = await this.syncDatabase(customCode);
    return {
      success: res.success,
      message: res.message,
      productsCount: res.productsCount,
      movementsCount: res.movementsCount,
      timestamp: res.timestamp,
    };
  },

  // Dispositivo Secundario pushes registered movements to Master
  async pushMovementsToMaster(): Promise<{ success: boolean; message: string; count: number }> {
    const res = await this.syncDatabase();
    return {
      success: res.success,
      message: res.message,
      count: res.appliedMovements || 0,
    };
  },

  // Admin approves / marks reviewed a new user-added product
  async approveProduct(productId: string): Promise<{ success: boolean; message: string }> {
    const config = this.getDeviceConfig();
    const code = config.syncCode.trim().toUpperCase();
    const baseUrl = this.getServerBaseUrl();

    // Mark locally
    StorageService.markProductReviewed(productId);

    try {
      const response = await fetch(`${baseUrl}/api/sync/store/${encodeURIComponent(code)}/approve-product/${encodeURIComponent(productId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const parsed = await this.parseSafeResponse(response);
      return {
        success: parsed.ok,
        message: parsed.data?.message || 'Producto aprobado con éxito.',
      };
    } catch {
      return { success: true, message: 'Producto aprobado localmente.' };
    }
  },

  // Admin rejects a user-added product from review (deletes it without incorporating into catalog)
  async rejectProduct(productId: string): Promise<{ success: boolean; message: string }> {
    const config = this.getDeviceConfig();
    const code = config.syncCode.trim().toUpperCase();
    const baseUrl = this.getServerBaseUrl();

    // Delete locally from pending review and catalog
    StorageService.rejectPendingProduct(productId);

    try {
      const response = await fetch(`${baseUrl}/api/sync/store/${encodeURIComponent(code)}/reject-product/${encodeURIComponent(productId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const parsed = await this.parseSafeResponse(response);
      return {
        success: parsed.ok,
        message: parsed.data?.message || 'Producto rechazado y eliminado.',
      };
    } catch {
      return { success: true, message: 'Producto rechazado y eliminado localmente.' };
    }
  },

  // Offline QR code generator for direct local network pairing
  async generatePairingQR(storeCode: string, deviceName: string, customHostIp?: string): Promise<string> {
    const config = this.getDeviceConfig();
    const hostIp = (customHostIp || config.hostIp || DEFAULT_HOTSPOT_IP).trim();
    const port = config.port || DEFAULT_PORT;
    const serverUrl = `http://${hostIp}:${port}`;
    const payload = JSON.stringify({
      type: 'TIENDA_SYNC_PAIR',
      code: storeCode.trim().toUpperCase(),
      name: deviceName,
      hostIp,
      port,
      serverUrl,
      time: Date.now(),
    });

    try {
      return await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#10b981', // Emerald green QR
          light: '#0f172a',
        },
      });
    } catch {
      return '';
    }
  },

  // Generates JSON text for clipboard export, automatically falling back to lightweight mode if oversized
  getSyncJsonText(options?: { stripImages?: boolean; compact?: boolean }): string {
    const shouldStrip = options?.stripImages;
    if (shouldStrip) {
      const payload = this.createSyncPayload({ stripImages: true });
      return options?.compact ? JSON.stringify(payload) : JSON.stringify(payload, null, 2);
    }

    const payload = this.createSyncPayload();
    const formatted = JSON.stringify(payload, null, 2);
    if (formatted.length > MAX_SAFE_CLIPBOARD_CHARS) {
      // Exceeds safe limit for Android clipboard (20,000 chars), prioritize product metadata
      const safePayload = this.createSyncPayload({ stripImages: true });
      return JSON.stringify(safePayload, null, 2);
    }
    return formatted;
  },

  // Asynchronously generates an optimized JSON package: compresses images strongly to fit under 20,000 chars,
  // or completely strips images if it still exceeds the limit, prioritizing product data (name, barcode, stock).
  async generateOptimizedSyncJson(options?: {
    forceStripImages?: boolean;
    maxChars?: number;
  }): Promise<OptimizedExportResult> {
    const budget = options?.maxChars || MAX_SAFE_CLIPBOARD_CHARS;
    const config = this.getDeviceConfig();
    const currentUser = AuthService.getCurrentUser();
    const localPending = StorageService.getLocalPendingProducts();
    const allProducts = StorageService.getProducts();

    // Combine current products with localPendingProducts
    const productsMap = new Map<string, Product>();
    for (const p of allProducts) {
      productsMap.set(p.id, { ...p });
    }
    for (const lp of localPending) {
      productsMap.set(lp.id, { ...lp });
    }
    const combinedProducts = Array.from(productsMap.values());
    const totalProductCount = combinedProducts.length;

    // Check if any product has an image
    const hasAnyImages = combinedProducts.some((p) => Boolean(p.image && p.image.trim().length > 0));

    // Case 1: If forced to strip images, or there are no images at all
    if (options?.forceStripImages || !hasAnyImages) {
      const payload = this.createSyncPayload({ stripImages: true });
      let json = JSON.stringify(payload, null, 2);
      if (json.length > budget) {
        // Try compact JSON without whitespace to save ~30%
        const compact = JSON.stringify(payload);
        if (compact.length <= budget) {
          json = compact;
        }
      }

      return {
        json,
        totalChars: json.length,
        sizeKB: Math.round((json.length / 1024) * 10) / 10,
        imagesStripped: hasAnyImages,
        imagesCompressed: false,
        isSafeForClipboard: json.length <= 20000,
        reason: hasAnyImages ? 'Modo sin fotos seleccionado para máxima compatibilidad con el portapapeles de Android.' : undefined,
        productCount: totalProductCount,
      };
    }

    // Case 2: Products have images. Attempt strong compression to tiny thumbnails (50x50, JPEG 0.35)
    try {
      const compressedProducts = await Promise.all(
        combinedProducts.map(async (p) => {
          if (p.image && p.image.startsWith('data:image')) {
            const tiny = await compressDataUrl(p.image, 50, 0.35);
            return { ...p, image: tiny || undefined };
          }
          return { ...p };
        })
      );

      const compressedPending = await Promise.all(
        localPending.map(async (lp) => {
          if (lp.image && lp.image.startsWith('data:image')) {
            const tiny = await compressDataUrl(lp.image, 50, 0.35);
            return { ...lp, image: tiny || undefined };
          }
          return { ...lp };
        })
      );

      const testPayload: SyncPayload = {
        version: 3,
        storeCode: config.syncCode.trim().toUpperCase(),
        role: config.role,
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        userName: currentUser?.name || (config.role === 'client' ? 'Vendedor Móvil' : 'Administrador'),
        userRole: currentUser?.role || (config.role === 'master' ? 'admin' : 'user'),
        timestamp: new Date().toISOString(),
        products: compressedProducts,
        localPendingProducts: compressedPending,
        movements: StorageService.getMovements(),
        shoppingList: ShoppingService.getShoppingList(),
        replenishmentList: ShoppingService.getReplenishmentList(),
        categories: StorageService.getCategories(),
        settings: StorageService.getSettings(),
      };

      const formattedJson = JSON.stringify(testPayload, null, 2);

      // Check if it fits within the safe 20,000 Android clipboard limit
      if (formattedJson.length <= budget) {
        return {
          json: formattedJson,
          totalChars: formattedJson.length,
          sizeKB: Math.round((formattedJson.length / 1024) * 10) / 10,
          imagesStripped: false,
          imagesCompressed: true,
          isSafeForClipboard: true,
          productCount: totalProductCount,
        };
      }

      // Check if compact JSON fits
      const compactJson = JSON.stringify(testPayload);
      if (compactJson.length <= budget) {
        return {
          json: compactJson,
          totalChars: compactJson.length,
          sizeKB: Math.round((compactJson.length / 1024) * 10) / 10,
          imagesStripped: false,
          imagesCompressed: true,
          isSafeForClipboard: true,
          productCount: totalProductCount,
        };
      }
    } catch (compressErr) {
      console.warn('Image compression warning during export:', compressErr);
    }

    // Case 3: Even with compression, payload exceeds budget!
    // As explicitly requested: prioritize product metadata (name, barcode, stock) by completely stripping images
    const safePayload = this.createSyncPayload({ stripImages: true });
    let safeJson = JSON.stringify(safePayload, null, 2);
    if (safeJson.length > budget) {
      safeJson = JSON.stringify(safePayload); // Compact
    }

    return {
      json: safeJson,
      totalChars: safeJson.length,
      sizeKB: Math.round((safeJson.length / 1024) * 10) / 10,
      imagesStripped: true,
      imagesCompressed: false,
      isSafeForClipboard: safeJson.length <= 20000,
      reason: 'El catálogo con fotos superaba los 20,000 caracteres de Android. Las fotos se omitieron automáticamente para no cortarse, priorizando nombre, código y stock.',
      productCount: totalProductCount,
    };
  },

  // Export full sync package file (.sync.json)
  exportSyncFile(): void {
    const payload = this.createSyncPayload();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `inventario_${payload.storeCode}_${new Date().toISOString().slice(0, 10)}.sync.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  // Import sync package file or raw JSON text
  importSyncFile(fileContent: string): { success: boolean; message: string; count?: number; newProductsCount?: number } {
    try {
      const trimmed = (fileContent || '').trim();
      if (!trimmed) {
        return { success: false, message: 'El texto JSON está vacío. Pega o carga un archivo válido.' };
      }

      // Detect if text was truncated at exactly ~20,000 characters (typical Android Clipboard/ROM cutoff)
      if (trimmed.length === 20000 || (trimmed.length >= 19900 && trimmed.length <= 20100 && !trimmed.endsWith('}'))) {
        return {
          success: false,
          message: 'Error: El texto fue cortado a los 20,000 caracteres por el portapapeles de Android (Unterminated string at 20000). En el dispositivo emisor, exporta activando la opción "Exportar sin fotos" o transfiérelo cargando el archivo .json directamente.',
        };
      }

      const payload: SyncPayload = JSON.parse(trimmed);
      if (!payload.products || !Array.isArray(payload.products)) {
        return { success: false, message: 'El archivo o texto no contiene una lista de inventario válida.' };
      }

      // Requirement 1 & 2: Safely combine existing local catalog with incoming products and localPendingProducts
      const currentProducts = StorageService.getProducts();
      const currentMap = new Map<string, Product>();
      currentProducts.forEach((p) => currentMap.set(p.id, p));

      const incomingList = [...payload.products];
      if (Array.isArray(payload.localPendingProducts)) {
        for (const lp of payload.localPendingProducts) {
          if (!incomingList.some((p) => p.id === lp.id)) {
            incomingList.push(lp);
          }
        }
      }

      let newItemsCount = 0;
      for (const item of incomingList) {
        const existing = currentMap.get(item.id);
        if (existing) {
          currentMap.set(item.id, {
            ...existing,
            ...item,
            // Preserve existing product photo if incoming payload has no image (due to size optimization)
            image: item.image || existing.image,
            stock: payload.role === 'master' ? item.stock : existing.stock,
          });
        } else {
          const isFromClient = payload.role === 'client' || item.isNewFromUser;
          currentMap.set(item.id, {
            ...item,
            isNewFromUser: isFromClient,
            reviewedByAdmin: !isFromClient,
            addedByDeviceId: item.addedByDeviceId || payload.deviceId,
            addedByDeviceName: item.addedByDeviceName || payload.deviceName,
            addedByUserName: item.addedByUserName || payload.userName || 'Usuario',
          });
          newItemsCount++;
        }
      }

      const mergedProducts = Array.from(currentMap.values());
      StorageService.saveProducts(mergedProducts);
      if (payload.categories) StorageService.saveCategories(payload.categories);
      if (payload.movements) StorageService.saveMovements(payload.movements);
      if (payload.shoppingList) ShoppingService.mergeShoppingList(payload.shoppingList);
      if (payload.replenishmentList) ShoppingService.mergeReplenishmentList(payload.replenishmentList);

      const config = this.getDeviceConfig();
      this.saveDeviceConfig({
        ...config,
        syncCode: payload.storeCode || config.syncCode,
        lastSyncTimestamp: new Date().toISOString(),
      });

      let summary = `Se procesaron ${mergedProducts.length} productos con éxito.`;
      if (newItemsCount > 0) {
        summary += ` Se incorporaron ${newItemsCount} producto(s) nuevo(s) del dispositivo emisor.`;
      }

      return {
        success: true,
        message: summary,
        count: mergedProducts.length,
        newProductsCount: newItemsCount,
      };
    } catch (e: any) {
      const errStr = e?.message || '';
      if (errStr.includes('position 20000') || (fileContent && fileContent.length >= 19900 && fileContent.length <= 20100)) {
        return {
          success: false,
          message: 'Error: El texto fue cortado a los 20,000 caracteres por el portapapeles de Android (Unterminated string at position 20000). En el teléfono emisor, exporta activando "Modo sin fotos" o carga el archivo .json directamente.',
        };
      }
      return { success: false, message: 'Error al procesar el archivo o texto JSON: ' + errStr };
    }
  },
};
