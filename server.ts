import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createServer as createViteServer } from 'vite';

// Multi-device synchronization state
interface StoreSyncData {
  version: number;
  storeCode: string;
  masterDevice: {
    deviceId: string;
    deviceName: string;
  };
  lastUpdated: string;
  products: any[];
  movements: any[];
  appliedMovementIds: string[]; // Set of movement IDs already applied to calculate product stock
  shoppingList: any[];
  replenishmentList: any[];
  newProductsAlerts: string[]; // IDs of products added by secondary/user devices
  categories: any[];
  settings: any;
  connectedDevices: {
    deviceId: string;
    deviceName: string;
    role: string;
    userName?: string;
    lastSeen: string;
  }[];
}

const syncStoreMap = new Map<string, StoreSyncData>();
const DATA_DIR = path.join(process.cwd(), '.sync_cache');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function loadPersistedSync(code: string): StoreSyncData | null {
  const filePath = path.join(DATA_DIR, `store_${code.toUpperCase()}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.appliedMovementIds) {
        parsed.appliedMovementIds = (parsed.movements || []).map((m: any) => m.id);
      }
      if (!parsed.newProductsAlerts) {
        parsed.newProductsAlerts = [];
      }
      if (!parsed.shoppingList) {
        parsed.shoppingList = [];
      }
      if (!parsed.replenishmentList) {
        parsed.replenishmentList = [];
      }
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

function savePersistedSync(code: string, data: StoreSyncData): void {
  const filePath = path.join(DATA_DIR, `store_${code.toUpperCase()}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving persisted sync:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS for mobile devices, webviews, Capacitor, local IPs
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Support high payload limit for product images / base64
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Safe JSON error handler so Express never returns raw HTML error pages on body errors
  app.use((err: any, req: any, res: any, next: any) => {
    if (err) {
      console.error('Express request error:', err.message);
      return res.status(err.status || 400).json({
        error: err.message || 'Error procesando la solicitud JSON',
        code: 'PAYLOAD_ERROR',
      });
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Local network interfaces info for P2P Hotspot pairing
  app.get('/api/network-info', (req, res) => {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
    res.json({
      addresses,
      defaultHotspotIp: '192.168.43.1',
      port: PORT,
    });
  });

  // Helper to get or initialize store data
  const getOrCreateStore = (code: string): StoreSyncData => {
    let existing = syncStoreMap.get(code);
    if (!existing) {
      existing = loadPersistedSync(code) || undefined;
      if (existing) {
        syncStoreMap.set(code, existing);
      }
    }
    if (!existing) {
      existing = {
        version: 1,
        storeCode: code,
        masterDevice: {
          deviceId: 'dev-master',
          deviceName: 'Dispositivo Principal',
        },
        lastUpdated: new Date().toISOString(),
        products: [],
        movements: [],
        appliedMovementIds: [],
        shoppingList: [],
        replenishmentList: [],
        newProductsAlerts: [],
        categories: [],
        settings: {},
        connectedDevices: [],
      };
      syncStoreMap.set(code, existing);
    }
    return existing;
  };

  // UNIFIED BIDIRECTIONAL SYNC ENGINE: Merges movements, cumulative stock, products, shopping, alerts
  const handleFullSync = (code: string, body: any) => {
    const store = getOrCreateStore(code);
    const now = new Date().toISOString();
    const deviceId = body.deviceId || 'dev-unknown';
    const deviceName = body.deviceName || 'Dispositivo';
    const role = body.role || 'client';
    const userName = body.userName || 'Usuario';
    const userRole = body.userRole || (role === 'master' ? 'admin' : 'user');

    // 1. Update connected device registry
    const connectedDevices = [...store.connectedDevices];
    const devIdx = connectedDevices.findIndex((d) => d.deviceId === deviceId);
    const devEntry = {
      deviceId,
      deviceName,
      role,
      userName,
      lastSeen: now,
    };
    if (devIdx >= 0) {
      connectedDevices[devIdx] = devEntry;
    } else {
      connectedDevices.push(devEntry);
    }
    store.connectedDevices = connectedDevices;

    if (role === 'master') {
      store.masterDevice = { deviceId, deviceName };
    }

    // 2. Handle Admin Approval of new user products if sent
    if (Array.isArray(body.reviewedProductIds) && body.reviewedProductIds.length > 0) {
      const reviewedSet = new Set(body.reviewedProductIds);
      store.products = store.products.map((p) => {
        if (reviewedSet.has(p.id)) {
          return {
            ...p,
            isNewFromUser: false,
            reviewedByAdmin: true,
            lastUpdated: now,
          };
        }
        return p;
      });
      store.newProductsAlerts = (store.newProductsAlerts || []).filter((id) => !reviewedSet.has(id));
    }

    // 3. Merge Products from client and localPendingProducts (Requirement 3)
    let newProductsAddedCount = 0;
    const currentProductsMap = new Map<string, any>();
    const barcodeMap = new Map<string, any>();

    for (const p of store.products) {
      currentProductsMap.set(p.id, p);
      if (p.barcodeUnit || p.barcode) {
        barcodeMap.set(p.barcodeUnit || p.barcode, p);
      }
    }

    const incomingProducts: any[] = [];
    if (Array.isArray(body.products)) {
      incomingProducts.push(...body.products);
    }
    if (Array.isArray(body.localPendingProducts)) {
      for (const lp of body.localPendingProducts) {
        if (!incomingProducts.some((p) => p.id === lp.id)) {
          incomingProducts.push(lp);
        }
      }
    }

    if (incomingProducts.length > 0) {
      for (const clientProd of incomingProducts) {
        const barcodeKey = clientProd.barcodeUnit || clientProd.barcode;
        let existingProd = currentProductsMap.get(clientProd.id) || (barcodeKey ? barcodeMap.get(barcodeKey) : undefined);

        if (existingProd) {
          // Update product catalog metadata without blindly overwriting calculated stock!
          existingProd.name = clientProd.name || existingProd.name;
          existingProd.category = clientProd.category || existingProd.category;
          existingProd.barcode = clientProd.barcode || existingProd.barcode;
          existingProd.barcodeUnit = clientProd.barcodeUnit || existingProd.barcodeUnit;
          existingProd.barcodeBulk = clientProd.barcodeBulk !== undefined ? clientProd.barcodeBulk : existingProd.barcodeBulk;
          existingProd.unitsPerBulk = clientProd.unitsPerBulk || existingProd.unitsPerBulk || 12;
          existingProd.bulkUnitName = clientProd.bulkUnitName || existingProd.bulkUnitName;
          existingProd.costPrice = clientProd.costPrice !== undefined ? clientProd.costPrice : existingProd.costPrice;
          existingProd.sellingPrice = clientProd.sellingPrice !== undefined ? clientProd.sellingPrice : existingProd.sellingPrice;
          existingProd.costPriceBulk = clientProd.costPriceBulk !== undefined ? clientProd.costPriceBulk : existingProd.costPriceBulk;
          existingProd.sellingPriceBulk = clientProd.sellingPriceBulk !== undefined ? clientProd.sellingPriceBulk : existingProd.sellingPriceBulk;
          existingProd.minStockAlert = clientProd.minStockAlert !== undefined ? clientProd.minStockAlert : existingProd.minStockAlert;
          existingProd.minStockAlertUnit = clientProd.minStockAlertUnit !== undefined ? clientProd.minStockAlertUnit : existingProd.minStockAlertUnit;
          existingProd.minStockAlertBulk = clientProd.minStockAlertBulk !== undefined ? clientProd.minStockAlertBulk : existingProd.minStockAlertBulk;
          existingProd.suggestedGondolaQuantity = clientProd.suggestedGondolaQuantity !== undefined ? clientProd.suggestedGondolaQuantity : existingProd.suggestedGondolaQuantity;
          existingProd.unit = clientProd.unit || existingProd.unit;
          existingProd.notes = clientProd.notes || existingProd.notes;

          // Preserve or update photo/image if client provided one
          if (clientProd.image && clientProd.image.trim()) {
            existingProd.image = clientProd.image;
          }

          // If master is publishing and store was completely empty, take the master's initial stock
          if (role === 'master' && store.movements.length === 0 && (store.products.length === 0 || store.version === 1)) {
            existingProd.stock = clientProd.stock;
          }
        } else {
          // This is a NEW PRODUCT created on this device!
          const isFromClientOrUser = role !== 'master' || userRole !== 'admin';
          const newProd = {
            ...clientProd,
            id: clientProd.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            stock: Number(clientProd.stock) >= 0 ? Number(clientProd.stock) : 0,
            isNewFromUser: isFromClientOrUser,
            addedByDeviceId: deviceId,
            addedByDeviceName: deviceName,
            addedByUserName: userName,
            addedAt: now,
            reviewedByAdmin: !isFromClientOrUser,
            lastUpdated: now,
          };

          currentProductsMap.set(newProd.id, newProd);
          if (barcodeKey) barcodeMap.set(barcodeKey, newProd);
          store.products.push(newProd);
          newProductsAddedCount++;

          if (isFromClientOrUser) {
            if (!store.newProductsAlerts) store.newProductsAlerts = [];
            if (!store.newProductsAlerts.includes(newProd.id)) {
              store.newProductsAlerts.push(newProd.id);
            }
          }
        }
      }
    }

    // 4. Merge Movements & Compute Cumulative Net Stock (NO OVERWRITING / NO SUPERPOSICIÓN)
    if (!store.appliedMovementIds) {
      store.appliedMovementIds = (store.movements || []).map((m: any) => m.id);
    }
    const appliedIdsSet = new Set(store.appliedMovementIds);
    let newMovementsApplied = 0;

    if (Array.isArray(body.movements) && body.movements.length > 0) {
      for (const mov of body.movements) {
        if (!mov.id) continue;

        if (!appliedIdsSet.has(mov.id)) {
          // This is a brand new movement transaction!
          // Apply to the product's cumulative stock
          const targetProd = currentProductsMap.get(mov.productId) || (mov.barcode ? barcodeMap.get(mov.barcode) : undefined);
          if (targetProd) {
            const qty = Math.max(0, Number(mov.quantity) || 0);
            if (mov.type === 'in') {
              targetProd.stock = (Number(targetProd.stock) || 0) + qty;
            } else if (mov.type === 'out') {
              targetProd.stock = Math.max(0, (Number(targetProd.stock) || 0) - qty);
            }
            targetProd.lastUpdated = now;
          }

          // Register into server history
          store.movements.unshift({
            ...mov,
            synced: true,
            deviceId: mov.deviceId || deviceId,
            userName: mov.userName || userName,
            userRole: mov.userRole || userRole,
          });

          appliedIdsSet.add(mov.id);
          store.appliedMovementIds.push(mov.id);
          newMovementsApplied++;
        }
      }
    }

    // Keep movements capped at recent 1000
    if (store.movements.length > 1000) {
      store.movements = store.movements.slice(0, 1000);
    }

    // 5. Merge Shopping List
    if (Array.isArray(body.shoppingList) && body.shoppingList.length > 0) {
      const shoppingMap = new Map<string, any>((store.shoppingList || []).map((item: any) => [item.productId || item.id, item]));
      for (const item of body.shoppingList) {
        const key = item.productId || item.id;
        if (!shoppingMap.has(key)) {
          shoppingMap.set(key, item);
        } else {
          // Merge notes or quantity if present
          const existing = shoppingMap.get(key);
          shoppingMap.set(key, {
            ...existing,
            ...item,
            addedAt: item.addedAt || existing.addedAt,
          });
        }
      }
      store.shoppingList = Array.from(shoppingMap.values());
    }

    // 6. Merge Replenishment List
    if (Array.isArray(body.replenishmentList) && body.replenishmentList.length > 0) {
      const repMap = new Map<string, any>((store.replenishmentList || []).map((item: any) => [item.productId || item.id, item]));
      for (const item of body.replenishmentList) {
        const key = item.productId || item.id;
        if (!repMap.has(key)) {
          repMap.set(key, item);
        } else {
          const existing = repMap.get(key);
          repMap.set(key, {
            ...existing,
            ...item,
            status: item.status || existing.status,
            quantityToAdd: item.quantityToAdd ?? existing.quantityToAdd,
            unitMode: item.unitMode || existing.unitMode,
          });
        }
      }
      store.replenishmentList = Array.from(repMap.values());
    }

    // 7. Categories & Settings
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      const catMap = new Map<string, any>((store.categories || []).map((c: any) => [c.id, c]));
      for (const cat of body.categories) {
        catMap.set(cat.id, cat);
      }
      store.categories = Array.from(catMap.values());
    }
    if (body.settings && typeof body.settings === 'object') {
      store.settings = { ...store.settings, ...body.settings };
    }

    store.version = (store.version || 1) + 1;
    store.lastUpdated = now;

    // Persist
    syncStoreMap.set(code, store);
    savePersistedSync(code, store);

    return {
      success: true,
      message: 'Sincronización multidispositivo completada exitosamente.',
      version: store.version,
      timestamp: now,
      storeCode: code,
      products: store.products,
      movements: store.movements.slice(0, 500),
      shoppingList: store.shoppingList || [],
      replenishmentList: store.replenishmentList || [],
      categories: store.categories || [],
      newProductsAlerts: store.newProductsAlerts || [],
      connectedDevices: store.connectedDevices,
      appliedMovementsCount: newMovementsApplied,
      newProductsAddedCount,
    };
  };

  // POST full synchronization (Unified for both Master and Client)
  app.post('/api/sync/store/:storeCode/full-sync', (req, res) => {
    try {
      const code = req.params.storeCode.toUpperCase();
      const result = handleFullSync(code, req.body || {});
      res.json(result);
    } catch (err: any) {
      console.error('Error in /full-sync:', err);
      res.status(500).json({ error: err.message || 'Error durante la sincronización' });
    }
  });

  // POST store master snapshot (backward compatibility for existing endpoints)
  app.post('/api/sync/store/:storeCode', (req, res) => {
    try {
      const code = req.params.storeCode.toUpperCase();
      const result = handleFullSync(code, req.body || {});
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/sync/store/:storeCode:', err);
      res.status(500).json({ error: err.message || 'Error durante la sincronización' });
    }
  });

  // GET store master snapshot for synchronization
  app.get('/api/sync/store/:storeCode', (req, res) => {
    const code = req.params.storeCode.toUpperCase();
    let data = syncStoreMap.get(code);
    if (!data) {
      data = loadPersistedSync(code) || undefined;
      if (data) {
        syncStoreMap.set(code, data);
      }
    }

    if (!data) {
      return res.status(404).json({
        error: `No se encontró sincronización para la tienda ${code}. El Dispositivo Principal debe sincronizar primero.`,
      });
    }

    res.json({
      ...data,
      products: data.products || [],
      movements: (data.movements || []).slice(0, 500),
      shoppingList: data.shoppingList || [],
      replenishmentList: data.replenishmentList || [],
      newProductsAlerts: data.newProductsAlerts || [],
    });
  });

  // POST approve product (Admin approval)
  app.post('/api/sync/store/:storeCode/approve-product/:productId', (req, res) => {
    const code = req.params.storeCode.toUpperCase();
    const productId = req.params.productId;
    const store = getOrCreateStore(code);
    const now = new Date().toISOString();

    let found = false;
    store.products = store.products.map((p) => {
      if (p.id === productId) {
        found = true;
        return {
          ...p,
          isNewFromUser: false,
          reviewedByAdmin: true,
          lastUpdated: now,
        };
      }
      return p;
    });

    store.newProductsAlerts = (store.newProductsAlerts || []).filter((id) => id !== productId);
    store.version = (store.version || 1) + 1;
    store.lastUpdated = now;

    syncStoreMap.set(code, store);
    savePersistedSync(code, store);

    res.json({
      success: true,
      productId,
      found,
      message: 'Producto marcado como revisado y aprobado.',
      newProductsAlerts: store.newProductsAlerts,
    });
  });

  // POST movements from Dispositivo Secundario (backward compatibility)
  app.post('/api/sync/store/:storeCode/movements', (req, res) => {
    const code = req.params.storeCode.toUpperCase();
    const { deviceId, deviceName, movements, userName, userRole } = req.body;

    if (!movements || !Array.isArray(movements)) {
      return res.status(400).json({ error: 'Lista de movimientos requerida' });
    }

    const result = handleFullSync(code, {
      deviceId,
      deviceName,
      role: 'client',
      userName,
      userRole,
      movements,
    });

    res.json({
      success: true,
      received: movements.length,
      applied: result.appliedMovementsCount,
      timestamp: result.timestamp,
    });
  });

  // GET store sync status
  app.get('/api/sync/store/:storeCode/status', (req, res) => {
    const code = req.params.storeCode.toUpperCase();
    const existing = syncStoreMap.get(code) || loadPersistedSync(code);
    if (!existing) {
      return res.status(404).json({ registered: false });
    }
    res.json({
      registered: true,
      storeCode: existing.storeCode,
      masterDevice: existing.masterDevice,
      lastUpdated: existing.lastUpdated,
      productCount: existing.products.length,
      movementCount: existing.movements.length,
      devicesCount: existing.connectedDevices.length,
      newProductsAlertsCount: (existing.newProductsAlerts || []).length,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Inventory Sync Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
