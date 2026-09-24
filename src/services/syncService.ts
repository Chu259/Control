import QRCode from 'qrcode';
import { Product, StockMovement, Category, StoreSettings, DeviceSyncConfig, SyncRole, SyncPayload, SyncStatus } from '../types';
import { StorageService } from './storage';
import { ShoppingService } from './shoppingService';
import { AuthService } from './authService';

const DEFAULT_HOTSPOT_IP = '192.168.43.1';
const DEFAULT_PORT = 3000;

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
  createSyncPayload(): SyncPayload {
    const config = this.getDeviceConfig();
    const currentUser = AuthService.getCurrentUser();
    const localPending = StorageService.getLocalPendingProducts();

    // Requirement 2: Combine current products with localPendingProducts ensuring no newly created product is lost
    const productsMap = new Map<string, Product>();
    for (const p of StorageService.getProducts()) {
      productsMap.set(p.id, p);
    }
    for (const lp of localPending) {
      productsMap.set(lp.id, lp);
    }
    const combinedProducts = Array.from(productsMap.values());

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
      localPendingProducts: localPending, // Requirement 1 & 2: Packaged cleanly
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

  // Generates JSON text for clipboard export
  getSyncJsonText(): string {
    const payload = this.createSyncPayload();
    return JSON.stringify(payload, null, 2);
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
      const payload: SyncPayload = JSON.parse(fileContent);
      if (!payload.products || !Array.isArray(payload.products)) {
        return { success: false, message: 'El archivo o texto no contiene una lista de inventario válida' };
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
      return { success: false, message: 'Error al procesar el archivo o texto JSON: ' + e.message };
    }
  },
};
