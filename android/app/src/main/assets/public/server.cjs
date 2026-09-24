var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_os = __toESM(require("os"), 1);
var import_vite = require("vite");
var syncStoreMap = /* @__PURE__ */ new Map();
var DATA_DIR = import_path.default.join(process.cwd(), ".sync_cache");
if (!import_fs.default.existsSync(DATA_DIR)) {
  try {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
  }
}
function loadPersistedSync(code) {
  const filePath = import_path.default.join(DATA_DIR, `store_${code.toUpperCase()}.json`);
  if (import_fs.default.existsSync(filePath)) {
    try {
      const content = import_fs.default.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (!parsed.appliedMovementIds) {
        parsed.appliedMovementIds = (parsed.movements || []).map((m) => m.id);
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
function savePersistedSync(code, data) {
  const filePath = import_path.default.join(DATA_DIR, `store_${code.toUpperCase()}.json`);
  try {
    import_fs.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving persisted sync:", err);
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(import_express.default.json({ limit: "100mb" }));
  app.use(import_express.default.urlencoded({ limit: "100mb", extended: true }));
  app.use((err, req, res, next) => {
    if (err) {
      console.error("Express request error:", err.message);
      return res.status(err.status || 400).json({
        error: err.message || "Error procesando la solicitud JSON",
        code: "PAYLOAD_ERROR"
      });
    }
    next();
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/network-info", (req, res) => {
    const interfaces = import_os.default.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
    res.json({
      addresses,
      defaultHotspotIp: "192.168.43.1",
      port: PORT
    });
  });
  const getOrCreateStore = (code) => {
    let existing = syncStoreMap.get(code);
    if (!existing) {
      existing = loadPersistedSync(code) || void 0;
      if (existing) {
        syncStoreMap.set(code, existing);
      }
    }
    if (!existing) {
      existing = {
        version: 1,
        storeCode: code,
        masterDevice: {
          deviceId: "dev-master",
          deviceName: "Dispositivo Principal"
        },
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        products: [],
        movements: [],
        appliedMovementIds: [],
        shoppingList: [],
        replenishmentList: [],
        newProductsAlerts: [],
        categories: [],
        settings: {},
        connectedDevices: []
      };
      syncStoreMap.set(code, existing);
    }
    return existing;
  };
  const handleFullSync = (code, body) => {
    const store = getOrCreateStore(code);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const deviceId = body.deviceId || "dev-unknown";
    const deviceName = body.deviceName || "Dispositivo";
    const role = body.role || "client";
    const userName = body.userName || "Usuario";
    const userRole = body.userRole || (role === "master" ? "admin" : "user");
    const connectedDevices = [...store.connectedDevices];
    const devIdx = connectedDevices.findIndex((d) => d.deviceId === deviceId);
    const devEntry = {
      deviceId,
      deviceName,
      role,
      userName,
      lastSeen: now
    };
    if (devIdx >= 0) {
      connectedDevices[devIdx] = devEntry;
    } else {
      connectedDevices.push(devEntry);
    }
    store.connectedDevices = connectedDevices;
    if (role === "master") {
      store.masterDevice = { deviceId, deviceName };
    }
    if (Array.isArray(body.reviewedProductIds) && body.reviewedProductIds.length > 0) {
      const reviewedSet = new Set(body.reviewedProductIds);
      store.products = store.products.map((p) => {
        if (reviewedSet.has(p.id)) {
          return {
            ...p,
            isNewFromUser: false,
            reviewedByAdmin: true,
            lastUpdated: now
          };
        }
        return p;
      });
      store.newProductsAlerts = (store.newProductsAlerts || []).filter((id) => !reviewedSet.has(id));
    }
    let newProductsAddedCount = 0;
    const currentProductsMap = /* @__PURE__ */ new Map();
    const barcodeMap = /* @__PURE__ */ new Map();
    for (const p of store.products) {
      currentProductsMap.set(p.id, p);
      if (p.barcodeUnit || p.barcode) {
        barcodeMap.set(p.barcodeUnit || p.barcode, p);
      }
    }
    const incomingProducts = [];
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
        let existingProd = currentProductsMap.get(clientProd.id) || (barcodeKey ? barcodeMap.get(barcodeKey) : void 0);
        if (existingProd) {
          existingProd.name = clientProd.name || existingProd.name;
          existingProd.category = clientProd.category || existingProd.category;
          existingProd.barcode = clientProd.barcode || existingProd.barcode;
          existingProd.barcodeUnit = clientProd.barcodeUnit || existingProd.barcodeUnit;
          existingProd.barcodeBulk = clientProd.barcodeBulk !== void 0 ? clientProd.barcodeBulk : existingProd.barcodeBulk;
          existingProd.unitsPerBulk = clientProd.unitsPerBulk || existingProd.unitsPerBulk || 12;
          existingProd.bulkUnitName = clientProd.bulkUnitName || existingProd.bulkUnitName;
          existingProd.costPrice = clientProd.costPrice !== void 0 ? clientProd.costPrice : existingProd.costPrice;
          existingProd.sellingPrice = clientProd.sellingPrice !== void 0 ? clientProd.sellingPrice : existingProd.sellingPrice;
          existingProd.costPriceBulk = clientProd.costPriceBulk !== void 0 ? clientProd.costPriceBulk : existingProd.costPriceBulk;
          existingProd.sellingPriceBulk = clientProd.sellingPriceBulk !== void 0 ? clientProd.sellingPriceBulk : existingProd.sellingPriceBulk;
          existingProd.minStockAlert = clientProd.minStockAlert !== void 0 ? clientProd.minStockAlert : existingProd.minStockAlert;
          existingProd.minStockAlertUnit = clientProd.minStockAlertUnit !== void 0 ? clientProd.minStockAlertUnit : existingProd.minStockAlertUnit;
          existingProd.minStockAlertBulk = clientProd.minStockAlertBulk !== void 0 ? clientProd.minStockAlertBulk : existingProd.minStockAlertBulk;
          existingProd.suggestedGondolaQuantity = clientProd.suggestedGondolaQuantity !== void 0 ? clientProd.suggestedGondolaQuantity : existingProd.suggestedGondolaQuantity;
          existingProd.unit = clientProd.unit || existingProd.unit;
          existingProd.notes = clientProd.notes || existingProd.notes;
          if (clientProd.image && clientProd.image.trim()) {
            existingProd.image = clientProd.image;
          }
          if (role === "master" && store.movements.length === 0 && (store.products.length === 0 || store.version === 1)) {
            existingProd.stock = clientProd.stock;
          }
        } else {
          const isFromClientOrUser = role !== "master" || userRole !== "admin";
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
            lastUpdated: now
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
    if (!store.appliedMovementIds) {
      store.appliedMovementIds = (store.movements || []).map((m) => m.id);
    }
    const appliedIdsSet = new Set(store.appliedMovementIds);
    let newMovementsApplied = 0;
    if (Array.isArray(body.movements) && body.movements.length > 0) {
      for (const mov of body.movements) {
        if (!mov.id) continue;
        if (!appliedIdsSet.has(mov.id)) {
          const targetProd = currentProductsMap.get(mov.productId) || (mov.barcode ? barcodeMap.get(mov.barcode) : void 0);
          if (targetProd) {
            const qty = Math.max(0, Number(mov.quantity) || 0);
            if (mov.type === "in") {
              targetProd.stock = (Number(targetProd.stock) || 0) + qty;
            } else if (mov.type === "out") {
              targetProd.stock = Math.max(0, (Number(targetProd.stock) || 0) - qty);
            }
            targetProd.lastUpdated = now;
          }
          store.movements.unshift({
            ...mov,
            synced: true,
            deviceId: mov.deviceId || deviceId,
            userName: mov.userName || userName,
            userRole: mov.userRole || userRole
          });
          appliedIdsSet.add(mov.id);
          store.appliedMovementIds.push(mov.id);
          newMovementsApplied++;
        }
      }
    }
    if (store.movements.length > 1e3) {
      store.movements = store.movements.slice(0, 1e3);
    }
    if (Array.isArray(body.shoppingList) && body.shoppingList.length > 0) {
      const shoppingMap = new Map((store.shoppingList || []).map((item) => [item.productId || item.id, item]));
      for (const item of body.shoppingList) {
        const key = item.productId || item.id;
        if (!shoppingMap.has(key)) {
          shoppingMap.set(key, item);
        } else {
          const existing = shoppingMap.get(key);
          shoppingMap.set(key, {
            ...existing,
            ...item,
            addedAt: item.addedAt || existing.addedAt
          });
        }
      }
      store.shoppingList = Array.from(shoppingMap.values());
    }
    if (Array.isArray(body.replenishmentList) && body.replenishmentList.length > 0) {
      const repMap = new Map((store.replenishmentList || []).map((item) => [item.productId || item.id, item]));
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
            unitMode: item.unitMode || existing.unitMode
          });
        }
      }
      store.replenishmentList = Array.from(repMap.values());
    }
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      const catMap = new Map((store.categories || []).map((c) => [c.id, c]));
      for (const cat of body.categories) {
        catMap.set(cat.id, cat);
      }
      store.categories = Array.from(catMap.values());
    }
    if (body.settings && typeof body.settings === "object") {
      store.settings = { ...store.settings, ...body.settings };
    }
    store.version = (store.version || 1) + 1;
    store.lastUpdated = now;
    syncStoreMap.set(code, store);
    savePersistedSync(code, store);
    return {
      success: true,
      message: "Sincronizaci\xF3n multidispositivo completada exitosamente.",
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
      newProductsAddedCount
    };
  };
  app.post("/api/sync/store/:storeCode/full-sync", (req, res) => {
    try {
      const code = req.params.storeCode.toUpperCase();
      const result = handleFullSync(code, req.body || {});
      res.json(result);
    } catch (err) {
      console.error("Error in /full-sync:", err);
      res.status(500).json({ error: err.message || "Error durante la sincronizaci\xF3n" });
    }
  });
  app.post("/api/sync/store/:storeCode", (req, res) => {
    try {
      const code = req.params.storeCode.toUpperCase();
      const result = handleFullSync(code, req.body || {});
      res.json(result);
    } catch (err) {
      console.error("Error in /api/sync/store/:storeCode:", err);
      res.status(500).json({ error: err.message || "Error durante la sincronizaci\xF3n" });
    }
  });
  app.get("/api/sync/store/:storeCode", (req, res) => {
    const code = req.params.storeCode.toUpperCase();
    let data = syncStoreMap.get(code);
    if (!data) {
      data = loadPersistedSync(code) || void 0;
      if (data) {
        syncStoreMap.set(code, data);
      }
    }
    if (!data) {
      return res.status(404).json({
        error: `No se encontr\xF3 sincronizaci\xF3n para la tienda ${code}. El Dispositivo Principal debe sincronizar primero.`
      });
    }
    res.json({
      ...data,
      products: data.products || [],
      movements: (data.movements || []).slice(0, 500),
      shoppingList: data.shoppingList || [],
      replenishmentList: data.replenishmentList || [],
      newProductsAlerts: data.newProductsAlerts || []
    });
  });
  app.post("/api/sync/store/:storeCode/approve-product/:productId", (req, res) => {
    const code = req.params.storeCode.toUpperCase();
    const productId = req.params.productId;
    const store = getOrCreateStore(code);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let found = false;
    store.products = store.products.map((p) => {
      if (p.id === productId) {
        found = true;
        return {
          ...p,
          isNewFromUser: false,
          reviewedByAdmin: true,
          lastUpdated: now
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
      message: "Producto marcado como revisado y aprobado.",
      newProductsAlerts: store.newProductsAlerts
    });
  });
  app.post("/api/sync/store/:storeCode/movements", (req, res) => {
    const code = req.params.storeCode.toUpperCase();
    const { deviceId, deviceName, movements, userName, userRole } = req.body;
    if (!movements || !Array.isArray(movements)) {
      return res.status(400).json({ error: "Lista de movimientos requerida" });
    }
    const result = handleFullSync(code, {
      deviceId,
      deviceName,
      role: "client",
      userName,
      userRole,
      movements
    });
    res.json({
      success: true,
      received: movements.length,
      applied: result.appliedMovementsCount,
      timestamp: result.timestamp
    });
  });
  app.get("/api/sync/store/:storeCode/status", (req, res) => {
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
      newProductsAlertsCount: (existing.newProductsAlerts || []).length
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Inventory Sync Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
