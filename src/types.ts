export interface Product {
  id: string;
  barcode: string; // fallback / primary unit barcode
  barcodeUnit: string; // Barcode for individual unit (lata, botella, unidad)
  barcodeBulk?: string; // Barcode for bulk / box / pack (caja, fardo, bulto)
  unitsPerBulk: number; // Conversion factor (e.g. 6, 12, 24 units per box)
  bulkUnitName?: string; // e.g. 'Caja', 'Bulto', 'Pack', 'Fardo'
  name: string;
  category: string;
  costPrice: number; // Cost per unit
  sellingPrice: number; // Selling price per unit
  costPriceBulk?: number; // Cost per bulk pack
  sellingPriceBulk?: number; // Selling price per bulk pack
  stock: number; // Total units in stock
  minStockAlert: number; // Minimum unit stock alert (backward compatibility)
  minStockAlertUnit?: number; // Minimum stock alert by individual units
  minStockAlertBulk?: number; // Minimum stock alert by full bulks/boxes
  suggestedGondolaQuantity?: number; // Cantidad sugerida en góndola (capacidad ideal de exhibición)
  unit?: string;
  image?: string; // Data URL icon stored in local APK DB
  notes?: string;
  lastUpdated: string;
  // Reposition status
  isPendingReposition?: boolean;
  repositionQuantity?: number;
  repositionNotes?: string;
  repositionAddedAt?: string;
  // Multi-device sync tracking
  isNewFromUser?: boolean;
  addedByDeviceId?: string;
  addedByDeviceName?: string;
  addedByUserName?: string;
  addedAt?: string;
  reviewedByAdmin?: boolean;
}

export interface ShoppingListItem {
  id: string;
  productId: string;
  customNotes?: string;
  targetQuantity?: string;
  addedAt: string;
}

export interface ReplenishmentItem {
  id: string;
  productId: string;
  status: 'pending' | 'completed';
  suggestedUnits?: number;
  quantityToAdd?: number;
  unitMode?: 'unit' | 'bulk'; // Discriminar si se repone por unidades o bultos
  locationNotes?: string;
  addedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export type MovementType = 'in' | 'out';
export type MovementReason = 'compra' | 'venta' | 'devolucion' | 'ajuste' | 'merma';
export type MovementFormat = 'unit' | 'bulk';
export type UserRole = 'admin' | 'user';
export type AccessMethod = 'password' | 'device_lock' | 'biometric';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  pin: string; // Password or 4-6 digit numeric PIN
  role: UserRole; // 'admin' = Administrador, 'user' = Usuario / Operador
  phoneLockEnabled: boolean; // Bloqueo principal / biometría del celular
  avatarColor?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface AccessLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  method: AccessMethod;
  success: boolean;
  deviceInfo?: string;
  ipOrAgent?: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  barcodeScanned?: string;
  format?: MovementFormat; // 'unit' or 'bulk'
  unitType?: MovementFormat; // alias for format
  bulkQuantity?: number; // e.g. 2 boxes
  unitsPerBulk?: number; // e.g. 24 units/box
  type: MovementType;
  quantity: number; // total units affected in stock
  previousStock: number;
  newStock: number;
  reason: MovementReason;
  notes?: string;
  timestamp: string;
  deviceId?: string;
  userId?: string; // ID del usuario que realizó el movimiento
  userName?: string; // Nombre del usuario
  userRole?: UserRole; // Rol del usuario (admin / user)
  synced?: boolean;
}

export interface PushNotificationConfig {
  enabled: boolean;
  frequency: 'immediate' | 'daily' | 'twice-daily';
  notifyOnCritical: boolean;
  soundEnabled: boolean;
  customTitle: string;
  customMessage: string;
  lastNotified?: string;
}

export type SyncRole = 'master' | 'client'; // 'master' = Dispositivo Principal, 'client' = Dispositivo Secundario
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface DeviceSyncConfig {
  deviceId: string;
  deviceName: string;
  role: SyncRole;
  syncCode: string; // Store pairing code e.g. "TIENDA-7894"
  serverUrl?: string; // e.g. "http://192.168.43.1:3000"
  hostIp?: string; // Host internal IP e.g. "192.168.43.1"
  port?: number; // Port e.g. 3000
  lastSyncTimestamp?: string;
  autoSync: boolean;
  connectedDevices?: {
    deviceId: string;
    deviceName: string;
    role: SyncRole;
    userName?: string;
    lastSeen: string;
  }[];
}

export interface SyncPayload {
  version: number;
  storeCode: string;
  role: SyncRole;
  deviceId: string;
  deviceName: string;
  userName?: string;
  userRole?: UserRole;
  timestamp: string;
  products: Product[];
  localPendingProducts?: Product[];
  movements: StockMovement[];
  shoppingList?: ShoppingListItem[];
  replenishmentList?: ReplenishmentItem[];
  categories: Category[];
  settings: StoreSettings;
  reviewedProductIds?: string[];
  newProductsAlerts?: string[];
}

export interface StoreSettings {
  storeName: string;
  currencySymbol: string;
  defaultViewMode: 'grid-small' | 'grid-large' | 'list';
  defaultMinStock: number;
  pushConfig: PushNotificationConfig;
  syncConfig?: DeviceSyncConfig;
}

export type AppTab =
  | 'inventory'
  | 'scanner'
  | 'replenishment'
  | 'shopping'
  | 'movements'
  | 'alerts'
  | 'reports'
  | 'sync'
  | 'users'
  | 'settings';
export type ViewMode = 'grid-small' | 'grid-large' | 'list';
