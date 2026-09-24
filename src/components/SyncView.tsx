import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Server,
  Layers,
  History,
  Sparkles,
  Wifi,
  Package,
  Barcode,
  Camera,
  X,
  ClipboardPaste,
  FileCode,
  Share2,
  Upload,
  Download,
  ImageOff,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import { DeviceSyncConfig, SyncRole, Product, StockMovement } from '../types';
import { SyncService, OptimizedExportResult } from '../services/syncService';
import { StorageService } from '../services/storage';
import { Sound } from '../services/sound';
import { NotificationService } from '../services/pushNotifications';
import { NetworkPermissionService } from '../services/networkPermissions';

interface SyncViewProps {
  products: Product[];
  movements: StockMovement[];
  onRefreshData: () => void;
  currency: string;
  onOpenScanner?: (callback: (scannedText: string) => void) => void;
}

const DEFAULT_HOTSPOT_IP = '192.168.43.1';
const DEFAULT_PORT = 3000;

export const SyncView: React.FC<SyncViewProps> = ({
  products,
  movements,
  onRefreshData,
  currency,
  onOpenScanner,
}) => {
  const [config, setConfig] = useState<DeviceSyncConfig>(() => SyncService.getDeviceConfig());
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [storeCodeInput, setStoreCodeInput] = useState(config.syncCode || 'TIENDA-7894');
  const [deviceNameInput, setDeviceNameInput] = useState(config.deviceName || 'Caja Principal (Mostrador)');
  const [hostIpInput, setHostIpInput] = useState(config.hostIp || DEFAULT_HOTSPOT_IP);
  const [serverUrlInput, setServerUrlInput] = useState(config.serverUrl || `http://${DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [pingStatus, setPingStatus] = useState<{ testing: boolean; result?: { success: boolean; message: string } } | null>(null);

  // Manual JSON sync modals (Requirement 5)
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportedJsonText, setExportedJsonText] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [forceStripImages, setForceStripImages] = useState(false);
  const [exportOptState, setExportOptState] = useState<{
    isGenerating: boolean;
    isSafeForClipboard: boolean;
    imagesStripped: boolean;
    imagesCompressed: boolean;
    totalChars: number;
    sizeKB: number;
    reason?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fallback camera reader when onOpenScanner prop is not passed
  const [fallbackScannerOpen, setFallbackScannerOpen] = useState(false);

  // Filter new products added by users
  const newProductsFromUsers = products.filter((p) => p.isNewFromUser && !p.reviewedByAdmin);

  // Regenerate pairing QR when storeCode, deviceName or hostIp changes
  useEffect(() => {
    let isMounted = true;
    const ip = config.hostIp || hostIpInput || DEFAULT_HOTSPOT_IP;
    SyncService.generatePairingQR(config.syncCode, config.deviceName, ip).then((url) => {
      if (isMounted) setQrDataUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [config.syncCode, config.deviceName, config.role, config.hostIp, hostIpInput]);

  const handleRoleChange = (newRole: SyncRole) => {
    let newDeviceId = config.deviceId;
    if (newRole === 'client' && (config.deviceId === 'dev-master-principal' || config.deviceId.startsWith('dev-master'))) {
      newDeviceId = `dev-client-${Math.random().toString(36).substring(2, 8)}`;
    } else if (newRole === 'master' && config.deviceId.startsWith('dev-client')) {
      newDeviceId = `dev-master-${Math.random().toString(36).substring(2, 8)}`;
    }

    const updated: DeviceSyncConfig = {
      ...config,
      role: newRole,
      deviceId: newDeviceId,
      deviceName:
        newRole === 'master'
          ? (config.deviceName.includes('Terminal') ? 'Caja Principal (Mostrador)' : config.deviceName)
          : (config.deviceName.includes('Principal') ? 'Terminal Móvil (Vendedor)' : config.deviceName),
    };
    setConfig(updated);
    setDeviceNameInput(updated.deviceName);
    SyncService.saveDeviceConfig(updated);
    Sound.playScanBeep();
    setMessage({
      type: 'info',
      text:
        newRole === 'master'
          ? 'Este dispositivo ahora es el Dispositivo Principal (Host / Servidor Local).'
          : 'Este dispositivo ahora es un Dispositivo Secundario (Cliente enlazado al Servidor Local).',
    });
  };

  const handleSaveConfig = () => {
    const trimmedCode = storeCodeInput.trim().toUpperCase() || 'TIENDA-7894';
    const trimmedName = deviceNameInput.trim() || 'Dispositivo';
    const trimmedHostIp = hostIpInput.trim() || DEFAULT_HOTSPOT_IP;
    const trimmedServer = serverUrlInput.trim() || `http://${trimmedHostIp}:${DEFAULT_PORT}`;

    const updated: DeviceSyncConfig = {
      ...config,
      syncCode: trimmedCode,
      deviceName: trimmedName,
      hostIp: trimmedHostIp,
      serverUrl: trimmedServer,
    };
    setConfig(updated);
    SyncService.saveDeviceConfig(updated);
    setIsEditingSettings(false);
    setMessage({ type: 'success', text: 'Configuración de sincronización guardada con éxito.' });
  };

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(config.syncCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Test connection to the local sync server (Ping)
  const handleTestConnection = async () => {
    setPingStatus({ testing: true });
    const targetUrl = serverUrlInput.trim() || `http://${hostIpInput.trim()}:${DEFAULT_PORT}`;
    const res = await SyncService.testServerConnection(targetUrl);
    setPingStatus({ testing: false, result: res });
  };

  // Unified Multi-Device Sync: merges movements, stock, products, shopping list
  const handleSyncAll = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await SyncService.syncDatabase(config.syncCode);
      if (res.success) {
        Sound.playSuccessChime();
        setConfig(SyncService.getDeviceConfig());
        onRefreshData();
        setMessage({
          type: 'success',
          text: res.message,
        });

        if (res.newUserAlertsCount && res.newUserAlertsCount > 0) {
          NotificationService.notifyNewProductsFromSync(res.newUserAlertsCount, 'Terminal de usuario');
        }
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error en la sincronización local.' });
    } finally {
      setSyncing(false);
    }
  };

  // Process pairing data decoded from QR (Requirement 2)
  const handleProcessPairingData = (rawText: string) => {
    try {
      const data = JSON.parse(rawText.trim());
      if (data && (data.code || data.storeCode)) {
        const code = (data.code || data.storeCode || '').trim().toUpperCase();
        const hostIp = data.hostIp || (data.serverUrl ? new URL(data.serverUrl).hostname : DEFAULT_HOTSPOT_IP);
        const port = data.port || (data.serverUrl ? new URL(data.serverUrl).port || DEFAULT_PORT : DEFAULT_PORT);
        const serverUrl = data.serverUrl || `http://${hostIp}:${port}`;

        const updated: DeviceSyncConfig = {
          ...config,
          role: 'client',
          syncCode: code,
          hostIp,
          port: Number(port) || DEFAULT_PORT,
          serverUrl,
        };
        setConfig(updated);
        setStoreCodeInput(code);
        setHostIpInput(hostIp);
        setServerUrlInput(serverUrl);
        SyncService.saveDeviceConfig(updated);
        Sound.playSuccessChime();
        setMessage({
          type: 'success',
          text: `¡Vinculado con éxito! Tienda: ${code} | Servidor Local: ${serverUrl}`,
        });

        // Trigger immediate sync with the newly linked host
        setTimeout(() => {
          handleSyncAll();
        }, 500);
        return;
      }
    } catch {
      // Plain text fallback (URL or store code)
      if (rawText.startsWith('http://') || rawText.startsWith('https://')) {
        const updated: DeviceSyncConfig = {
          ...config,
          role: 'client',
          serverUrl: rawText.trim(),
        };
        setConfig(updated);
        setServerUrlInput(rawText.trim());
        SyncService.saveDeviceConfig(updated);
        setMessage({
          type: 'success',
          text: `Servidor configurado: ${rawText.trim()}`,
        });
        return;
      } else if (rawText.trim().length >= 3) {
        const updated: DeviceSyncConfig = {
          ...config,
          role: 'client',
          syncCode: rawText.trim().toUpperCase(),
        };
        setConfig(updated);
        setStoreCodeInput(rawText.trim().toUpperCase());
        SyncService.saveDeviceConfig(updated);
        setMessage({
          type: 'success',
          text: `Código de tienda configurado: ${rawText.trim().toUpperCase()}`,
        });
        return;
      }
    }

    setMessage({
      type: 'error',
      text: 'El código escaneado no contiene datos válidos del Dispositivo Principal.',
    });
  };

  // Open camera scanner for pairing (Requirement 2)
  const handleScanServerQR = () => {
    if (onOpenScanner) {
      onOpenScanner((scannedValue) => {
        handleProcessPairingData(scannedValue);
      });
    } else {
      setFallbackScannerOpen(true);
    }
  };

  // Request or re-verify local network / location permissions for Wi-Fi Hotspot peer routing
  const handleRequestNetworkPermissions = async () => {
    const res = await NetworkPermissionService.requestPermissionsExplicitly();
    if (res.granted) {
      Sound.playSuccessChime();
      setMessage({ type: 'success', text: res.message });
    } else {
      setMessage({ type: 'info', text: res.message });
    }
  };

  // Requirement 3: Generate Optimized Export JSON (Compresses or strips images to strictly fit under 20,000 characters)
  const handleOpenExportModal = async (stripImages = false) => {
    setExportModalOpen(true);
    setCopiedJson(false);
    setForceStripImages(stripImages);
    setExportOptState({
      isGenerating: true,
      isSafeForClipboard: true,
      imagesStripped: false,
      imagesCompressed: false,
      totalChars: 0,
      sizeKB: 0,
    });

    try {
      const result = await SyncService.generateOptimizedSyncJson({ forceStripImages: stripImages });
      setExportedJsonText(result.json);
      setForceStripImages(result.imagesStripped);
      setExportOptState({
        isGenerating: false,
        isSafeForClipboard: result.isSafeForClipboard,
        imagesStripped: result.imagesStripped,
        imagesCompressed: result.imagesCompressed,
        totalChars: result.totalChars,
        sizeKB: result.sizeKB,
        reason: result.reason,
      });
    } catch {
      const fallback = SyncService.getSyncJsonText({ stripImages: true });
      setExportedJsonText(fallback);
      setForceStripImages(true);
      setExportOptState({
        isGenerating: false,
        isSafeForClipboard: true,
        imagesStripped: true,
        imagesCompressed: false,
        totalChars: fallback.length,
        sizeKB: Math.round((fallback.length / 1024) * 10) / 10,
      });
    }
  };

  // Requirement 5: Copy JSON to Clipboard using Capacitor Native Clipboard
  const handleCopyJsonToClipboard = async () => {
    try {
      await Clipboard.write({ string: exportedJsonText });
      Sound.playSuccessChime();
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    } catch {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(exportedJsonText);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = exportedJsonText;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        Sound.playSuccessChime();
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2500);
      } catch {
        alert('Por favor selecciona el texto del cuadro inferior y cópialo manualmente.');
      }
    }
  };

  // Requirement 5: Open Import JSON Modal
  const handleOpenImportModal = () => {
    setImportJsonText('');
    setImportError(null);
    setImportModalOpen(true);
  };

  // Requirement 2: Read clipboard with multi-channel support capable of reading > 100,000 characters
  const readFullClipboardContent = async (): Promise<{ text: string; source: string }> => {
    let bestText = '';
    let source = '';

    // Channel 1: Native Capacitor Clipboard plugin
    try {
      const capResult = await Clipboard.read();
      if (capResult && typeof capResult.value === 'string' && capResult.value.length > 0) {
        bestText = capResult.value;
        source = 'Capacitor Native';
      }
    } catch (capErr) {
      console.warn('Capacitor clipboard read warning:', capErr);
    }

    // Channel 2: Navigator Clipboard API (Web standard, handles > 100,000 chars seamlessly in modern WebView)
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
      try {
        const navText = await navigator.clipboard.readText();
        // If web clipboard returned more text (e.g. Capacitor was bounded by IPC/ROM), choose the longer one
        if (navText && navText.length > bestText.length) {
          bestText = navText;
          source = 'Navigator Clipboard';
        }
      } catch (navErr) {
        console.warn('Navigator clipboard fallback warning:', navErr);
      }
    }

    return { text: bestText, source };
  };

  // Requirement 2 & 5: Paste from Clipboard using native multi-source reader and execute local import
  const handlePasteFromClipboard = async () => {
    try {
      const { text, source } = await readFullClipboardContent();

      if (text && text.trim()) {
        const cleanText = text.trim();
        setImportJsonText(cleanText);
        setImportError(null);
        Sound.playScanBeep();

        // Check if string was truncated by Android clipboard at exactly ~20,000 characters
        if (cleanText.length === 20000 || (cleanText.length >= 19900 && cleanText.length <= 20100 && !cleanText.endsWith('}'))) {
          setImportError('Atención: El portapapeles de Android cortó el texto a 20,000 caracteres (Unterminated string). En el teléfono emisor, exporta activando "Modo sin fotos" o carga el archivo .json directamente.');
          return;
        }

        // Try automatic import
        try {
          const parsed = JSON.parse(cleanText);
          if (parsed && (parsed.products || parsed.storeCode || parsed.localPendingProducts)) {
            const res = SyncService.importSyncFile(cleanText);
            if (res.success) {
              Sound.playSuccessChime();
              setImportModalOpen(false);
              setImportJsonText('');
              setImportError(null);
              setMessage({
                type: 'success',
                text: `¡Importado con éxito (${source || 'Portapapeles'})! ${res.message}`,
              });
              onRefreshData();
              return;
            } else {
              setImportError(res.message);
            }
          }
        } catch {
          // If not complete JSON, leave text in textarea for user review
        }
      } else {
        setImportError('El portapapeles está vacío o no contiene texto. Copia primero el código JSON del otro dispositivo.');
      }
    } catch {
      setImportError('No se pudo leer el portapapeles. Pega el texto manualmente en el cuadro o carga el archivo .json.');
    }
  };

  // Direct file import to bypass any clipboard limitation
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && content.trim()) {
        const clean = content.trim();
        setImportJsonText(clean);
        setImportError(null);
        const res = SyncService.importSyncFile(clean);
        if (res.success) {
          Sound.playSuccessChime();
          setImportModalOpen(false);
          setImportJsonText('');
          setMessage({
            type: 'success',
            text: `¡Archivo "${file.name}" importado con éxito! ${res.message}`,
          });
          onRefreshData();
        } else {
          setImportError(res.message);
        }
      }
    };
    reader.onerror = () => {
      setImportError('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Requirement 5: Process and Apply Imported JSON
  const handleProcessImportedJson = () => {
    if (!importJsonText.trim()) {
      setImportError('El cuadro de texto está vacío. Pega aquí el código JSON para importar.');
      return;
    }

    const res = SyncService.importSyncFile(importJsonText.trim());
    if (res.success) {
      Sound.playSuccessChime();
      setImportModalOpen(false);
      setImportJsonText('');
      setImportError(null);
      setMessage({
        type: 'success',
        text: res.message || 'Inventario importado exitosamente desde el JSON.',
      });
      onRefreshData();
    } else {
      setImportError(res.message || 'Error al procesar el JSON. Verifica que sea un formato válido.');
    }
  };

  // Approve a single user-added product
  const handleApproveProduct = async (productId: string) => {
    setApprovingId(productId);
    try {
      const res = await SyncService.approveProduct(productId);
      Sound.playSuccessChime();
      onRefreshData();
      setMessage({
        type: 'success',
        text: `Producto aprobado exitosamente. Se ha integrado oficialmente al catálogo maestro.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al aprobar producto' });
    } finally {
      setApprovingId(null);
    }
  };

  // Approve all pending user products
  const handleApproveAllProducts = async () => {
    for (const p of newProductsFromUsers) {
      await SyncService.approveProduct(p.id);
    }
    Sound.playSuccessChime();
    onRefreshData();
    setMessage({
      type: 'success',
      text: `Se aprobaron los ${newProductsFromUsers.length} productos nuevos agregados por los usuarios.`,
    });
  };

  const formatLastSync = (timestamp?: string) => {
    if (!timestamp) return 'Nunca sincronizado';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + date.toLocaleDateString() + ')';
  };

  return (
    <div id="sync-view" className="space-y-4 pb-20 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#171a24] to-[#12141c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Sincronización Local P2P / Hotspot</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                    config.role === 'master'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  }`}
                >
                  {config.role === 'master' ? 'Servidor Local (Host)' : 'Dispositivo Secundario'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Conexión 100% Offline directa mediante Zona Wi-Fi (Hotspot) o red local sin salir a internet.
              </p>
            </div>
          </div>

          {/* Quick sync button */}
          <button
            id="main-sync-action-btn"
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>
              {syncing
                ? 'Sincronizando...'
                : config.role === 'master'
                ? 'Sincronizar y Publicar Base'
                : 'Sincronizar con Servidor Local'}
            </span>
          </button>
        </div>

        {/* Message notification */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2.5 animate-fade-in ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : message.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="flex-1">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-zinc-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* NEW PRODUCTS FROM USERS SECTION */}
      {newProductsFromUsers.length > 0 && (
        <div id="new-user-products-section" className="bg-gradient-to-r from-purple-950/40 via-amber-950/30 to-[#161922] border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Productos Nuevos Agregados por Usuarios</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-black">
                    {newProductsFromUsers.length} pendientes
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Otros operadores agregaron estos artículos desde sus teléfonos. Confírmalos para integrarlos al catálogo maestro:
                </p>
              </div>
            </div>

            <button
              id="approve-all-user-products-btn"
              onClick={handleApproveAllProducts}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aprobar Todos</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {newProductsFromUsers.map((prod) => (
              <div
                key={prod.id}
                className="bg-[#12141c]/90 border border-white/10 rounded-xl p-3 flex flex-col justify-between hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-lg bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10">
                    {prod.image ? (
                      <img
                        src={prod.image}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <Package className="w-7 h-7 text-zinc-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs sm:text-sm text-white truncate">{prod.name}</h4>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/10 text-zinc-300">
                        {prod.category}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-400 font-mono space-y-0.5 mt-1">
                      <div className="flex items-center gap-1">
                        <Barcode className="w-3 h-3 text-teal-400" />
                        <span>Ud: {prod.barcodeUnit || prod.barcode}</span>
                      </div>
                      {prod.barcodeBulk && (
                        <div className="flex items-center gap-1 text-amber-300/90">
                          <span>📦 Bulto: {prod.barcodeBulk} (x{prod.unitsPerBulk || 12})</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-1.5 text-[10px] text-zinc-500">
                      <span>Agregado por: </span>
                      <strong className="text-zinc-300">{prod.addedByUserName || prod.addedByDeviceName || 'Usuario'}</strong>
                      {prod.addedAt && (
                        <span className="ml-1 text-zinc-500">({new Date(prod.addedAt).toLocaleDateString()})</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/5">
                  <div className="text-xs">
                    <span className="text-zinc-400">Stock Inicial: </span>
                    <strong className="text-teal-400">{prod.stock} uds</strong>
                  </div>

                  <button
                    id={`approve-prod-${prod.id}`}
                    onClick={() => handleApproveProduct(prod.id)}
                    disabled={approvingId === prod.id}
                    className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>{approvingId === prod.id ? 'Aprobando...' : 'Aprobar Producto'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local Wi-Fi & Antenna Permission Banner */}
      <div className="bg-[#131620] border border-teal-500/20 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center flex-shrink-0">
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Antena Wi-Fi y Conexión de Red Local</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                P2P Offline
              </span>
            </h4>
            <p className="text-[11px] text-zinc-400">
              Permite a los teléfonos comunicarse mediante la Zona Wi-Fi (Hotspot) para enviar y recibir productos sin internet.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRequestNetworkPermissions}
          className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-semibold text-xs rounded-xl border border-teal-500/30 flex items-center gap-1.5 self-start sm:self-auto transition-colors flex-shrink-0 active:scale-95"
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>Verificar / Activar Permiso</span>
        </button>
      </div>

      {/* Role Selector Card */}
      <div className="bg-[#161922] border border-white/10 rounded-2xl p-4 shadow-lg">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
          1. Rol de este Dispositivo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option: Master Device */}
          <button
            id="role-master-btn"
            type="button"
            onClick={() => handleRoleChange('master')}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              config.role === 'master'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5'
                : 'bg-[#12141c] border-white/5 hover:border-white/20 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">👑</span>
                <span className="text-xs font-bold text-white">Dispositivo Principal (Host / Servidor Local)</span>
              </div>
              {config.role === 'master' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Actúa como el servidor HTTP local en la red. Emite el código QR verde con su IP interna para que los demás celulares se conecten mediante Zona Wi-Fi o router local sin internet.
            </p>
          </button>

          {/* Option: Secondary / Client Device */}
          <button
            id="role-client-btn"
            type="button"
            onClick={() => handleRoleChange('client')}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              config.role === 'client'
                ? 'bg-teal-500/10 border-teal-500/50 shadow-md shadow-teal-500/5'
                : 'bg-[#12141c] border-white/5 hover:border-white/20 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">📱</span>
                <span className="text-xs font-bold text-white">Dispositivo Secundario (Vendedor / Repositor)</span>
              </div>
              {config.role === 'client' && (
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Se conecta a la Zona Wi-Fi del celular principal. Escanea el código QR del Host para vincularse de inmediato y enviar sus ventas y reposiciones sin cables.
            </p>
          </button>
        </div>
      </div>

      {/* Store Pairing & Code Card */}
      <div className="bg-[#161922] border border-white/10 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            2. Configuración P2P y Código de Tienda
          </h3>
          <button
            id="toggle-edit-sync-settings"
            onClick={() => setIsEditingSettings(!isEditingSettings)}
            className="text-[11px] text-teal-400 hover:text-teal-300 transition-colors font-medium"
          >
            {isEditingSettings ? 'Cerrar Ajustes' : 'Configurar IP / Código'}
          </button>
        </div>

        {isEditingSettings ? (
          <div className="bg-[#12141c] p-4 rounded-xl border border-white/10 space-y-3 mb-3 animate-fade-in">
            <div>
              <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                Código de la Tienda (Identificador común para enlazar):
              </label>
              <input
                id="sync-code-input"
                type="text"
                value={storeCodeInput}
                onChange={(e) => setStoreCodeInput(e.target.value.toUpperCase())}
                placeholder="ej: TIENDA-7894"
                className="w-full bg-[#1b1e2b] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white uppercase focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                Nombre de este Teléfono:
              </label>
              <input
                id="device-name-input"
                type="text"
                value={deviceNameInput}
                onChange={(e) => setDeviceNameInput(e.target.value)}
                placeholder="ej: Caja Mostrador / Teléfono Carlos"
                className="w-full bg-[#1b1e2b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>

            {config.role === 'master' ? (
              <div>
                <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                  IP Interna del Host (Para generar el QR local):
                </label>
                <div className="flex gap-2">
                  <input
                    id="host-ip-input"
                    type="text"
                    value={hostIpInput}
                    onChange={(e) => {
                      setHostIpInput(e.target.value);
                      setServerUrlInput(`http://${e.target.value}:${DEFAULT_PORT}`);
                    }}
                    placeholder="192.168.43.1"
                    className="flex-1 bg-[#1b1e2b] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHostIpInput(DEFAULT_HOTSPOT_IP);
                      setServerUrlInput(`http://${DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`);
                    }}
                    className="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 text-emerald-300 rounded border border-emerald-500/20"
                  >
                    📶 Zona Wi-Fi Android ({DEFAULT_HOTSPOT_IP})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
                      setHostIpInput(host);
                      setServerUrlInput(`http://${host}:${DEFAULT_PORT}`);
                    }}
                    className="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 text-zinc-300 rounded border border-white/5"
                  >
                    💻 Mismo Equipo ({typeof window !== 'undefined' ? window.location.hostname : 'localhost'})
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                  URL / IP del Servidor Local (Dispositivo Principal):
                </label>
                <div className="flex gap-2">
                  <input
                    id="server-url-input"
                    type="text"
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    placeholder={`http://${DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`}
                    className="flex-1 bg-[#1b1e2b] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:border-teal-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={pingStatus?.testing}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Wifi className="w-3.5 h-3.5 text-teal-400" />
                    <span>{pingStatus?.testing ? 'Probando...' : 'Probar'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Ping result */}
            {pingStatus?.result && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 ${
                  pingStatus.result.success
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${pingStatus.result.success ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>{pingStatus.result.message}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsEditingSettings(false)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 text-xs rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs rounded-lg transition-colors"
              >
                Guardar Ajustes
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 bg-[#12141c] rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className="px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30">
                <span className="text-base sm:text-lg font-mono font-extrabold text-teal-400 tracking-wider">
                  {config.syncCode}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{config.deviceName}</p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  {config.role === 'master'
                    ? `IP Host: ${config.hostIp || DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`
                    : `Conectado a: ${config.serverUrl || `http://${DEFAULT_HOTSPOT_IP}:${DEFAULT_PORT}`}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="copy-sync-code-btn"
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs rounded-lg transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? '¡Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Master QR Code or Secondary Pairing Scanner */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {config.role === 'master' ? (
            <div className="bg-[#12141c] p-4 rounded-xl border border-white/5 flex flex-col items-center text-center">
              <p className="text-xs font-semibold text-white mb-1">
                Código QR Local del Dispositivo Principal
              </p>
              <p className="text-[11px] text-zinc-400 mb-3 max-w-xs">
                Contiene únicamente la IP local ({config.hostIp || DEFAULT_HOTSPOT_IP}:{DEFAULT_PORT}) y el código de la tienda para sincronización P2P directa sin internet.
              </p>
              {qrDataUrl ? (
                <div className="p-3 bg-[#0f172a] rounded-2xl border-2 border-emerald-500/40 shadow-xl shadow-emerald-500/10">
                  <img
                    src={qrDataUrl}
                    alt="Código QR de Vinculación Local"
                    className="w-48 h-48 object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 rounded-xl bg-black/40 flex items-center justify-center text-zinc-600 text-xs">
                  Generando QR local...
                </div>
              )}

              <div className="mt-3 text-left w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-zinc-300 space-y-1">
                <p className="font-semibold text-emerald-400 flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Pasos para enlazar sin internet:
                </p>
                <p className="text-zinc-400">1. Enciende la <strong>Zona Wi-Fi (Hotspot)</strong> de este teléfono.</p>
                <p className="text-zinc-400">2. Conecta el teléfono secundario a esa red Wi-Fi.</p>
                <p className="text-zinc-400">3. En el teléfono secundario, pulsa <strong>'Escanear QR de Servidor'</strong>.</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#12141c] p-4 rounded-xl border border-white/5 flex flex-col justify-between h-full space-y-3">
              <div>
                <p className="text-xs font-semibold text-white mb-1">
                  Vincular con Dispositivo Principal
                </p>
                <p className="text-[11px] text-zinc-400 mb-3">
                  Escanea el código QR verde del Dispositivo Principal para configurar automáticamente la IP local y el código de la tienda.
                </p>
              </div>

              {/* Requirement 2: Visible prominent "Escanear QR de Servidor" button */}
              <button
                id="scan-server-qr-btn"
                type="button"
                onClick={handleScanServerQR}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4 text-emerald-100" />
                <span className="text-sm">Escanear QR de Servidor</span>
              </button>

              <div className="space-y-2 pt-2 border-t border-white/5">
                <button
                  id="client-pull-btn"
                  onClick={handleSyncAll}
                  disabled={syncing}
                  className="w-full py-2.5 px-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>Sincronizar con Servidor Local</span>
                </button>
              </div>
            </div>
          )}

          {/* Sync Stats & Live Summary */}
          <div className="bg-[#12141c] p-4 rounded-xl border border-white/5 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-teal-400" />
              <span>Estado del Inventario Local</span>
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                <p className="text-[10px] text-zinc-500">Productos en Catálogo</p>
                <p className="text-sm font-bold text-white mt-0.5">{products.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                <p className="text-[10px] text-zinc-500">Movimientos Registrados</p>
                <p className="text-sm font-bold text-white mt-0.5">{movements.length}</p>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 pt-1 space-y-1">
              <div className="flex justify-between">
                <span>Última sincronización:</span>
                <span className="font-mono text-zinc-200">{formatLastSync(config.lastSyncTimestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span>Dispositivos registrados:</span>
                <span className="text-teal-400 font-semibold">
                  {config.connectedDevices?.length || 1} terminal(es)
                </span>
              </div>
            </div>

            {config.connectedDevices && config.connectedDevices.length > 0 && (
              <div className="pt-2 border-t border-white/5 space-y-1">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Terminales Registrados:</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {config.connectedDevices.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] text-zinc-300 bg-black/20 px-2 py-1 rounded">
                      <span className="truncate">{d.deviceName} ({d.userName || d.role})</span>
                      <span className="text-zinc-500 font-mono text-[9px]">
                        {new Date(d.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Requirement 5: Manual Sync by Copying / Pasting JSON text in a Modal (Bypasses Android File Download restrictions) */}
      <div className="bg-[#161922] border border-white/10 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            3. Sincronización Manual por Portapapeles (Copiar / Pegar JSON)
          </h3>
        </div>
        <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
          Para transferir el catálogo completo de productos y movimientos entre dispositivos sin depender del sistema de descargas de Android ni de cables:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            id="export-sync-file-btn"
            type="button"
            onClick={() => handleOpenExportModal(false)}
            className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition-all active:scale-95"
          >
            <Copy className="w-4 h-4 text-teal-400" />
            <span>Exportar Copia (Ver y Copiar JSON)</span>
          </button>

          <button
            id="import-sync-modal-btn"
            type="button"
            onClick={handleOpenImportModal}
            className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-teal-500/40 text-teal-300 font-semibold text-xs transition-all active:scale-95"
          >
            <ClipboardPaste className="w-4 h-4 text-teal-400" />
            <span>Importar Copia (Pegar JSON)</span>
          </button>
        </div>
      </div>

      {/* MODAL: EXPORT SYNC JSON (Requirement 3 & 5) */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className="relative w-full max-w-xl bg-[#161922] border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#12141c]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Copia de Sincronización (JSON)</h3>
                  <p className="text-[11px] text-zinc-400">
                    {products.length} productos y {movements.length} movimientos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {exportOptState?.isGenerating ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                  <p className="text-xs text-zinc-300 font-medium">Optimizando paquete de sincronización...</p>
                  <p className="text-[11px] text-zinc-500">Ajustando tamaño seguro para evitar cortes en el portapapeles de Android</p>
                </div>
              ) : (
                <>
                  {/* Status Banner based on Android 20,000 characters threshold */}
                  {exportOptState?.imagesStripped ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                      <ImageOff className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                      <div className="space-y-1">
                        <p className="font-semibold text-white">Modo Seguro para Android Activado (Sin Fotos)</p>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          {exportOptState.reason || 'Para garantizar que el texto no sea cortado a los 20,000 caracteres por el portapapeles de Android, las fotos se omitieron automáticamente.'}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-medium">
                          ✓ Se priorizaron al 100%: Nombre, Código de Barra, Stock, Precios y Movimientos.
                        </p>
                      </div>
                    </div>
                  ) : exportOptState?.imagesCompressed ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                      <div className="space-y-1">
                        <p className="font-semibold text-white">Fotos Comprimidas Fuertemente (Tamaño Seguro)</p>
                        <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                          Las fotos se optimizaron en miniaturas ultraligeras. El paquete pesa menos de 20,000 caracteres y no se cortará en el portapapeles.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Size & Options Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">Tamaño:</span>
                      <span className="text-[11px] font-mono font-bold text-white">
                        {exportedJsonText.length.toLocaleString()} caracteres ({((exportedJsonText.length / 1024).toFixed(1))} KB)
                      </span>
                      {exportedJsonText.length <= 20000 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                          ✓ Seguro (&lt;20K)
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold">
                          ⚠️ &gt;20K
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenExportModal(!forceStripImages)}
                      className="text-[11px] font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1.5 self-start sm:self-auto px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {forceStripImages ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Intentar incluir fotos</span>
                        </>
                      ) : (
                        <>
                          <ImageOff className="w-3.5 h-3.5" />
                          <span>Omitir fotos (Modo Ultraligero)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-zinc-300">
                    Presiona el botón para copiar todo el JSON al portapapeles y pegarlo en el otro dispositivo:
                  </p>

                  <button
                    type="button"
                    id="copy-sync-json-btn"
                    onClick={handleCopyJsonToClipboard}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                      copiedJson
                        ? 'bg-emerald-500 text-black shadow-emerald-500/30'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white shadow-teal-500/20'
                    }`}
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>¡Copiado al Portapapeles!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar al Portapapeles</span>
                      </>
                    )}
                  </button>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                      Texto del archivo JSON (sin límite de tamaño):
                    </label>
                    <textarea
                      readOnly
                      value={exportedJsonText}
                      onFocus={(e) => e.target.select()}
                      autoComplete="off"
                      spellCheck={false}
                      rows={7}
                      className="w-full bg-[#0d1017] border border-white/10 rounded-xl p-3 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-teal-500 resize-none select-all"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border-t border-white/10 bg-[#12141c]">
              <button
                type="button"
                onClick={() => SyncService.exportSyncFile()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium text-xs rounded-xl transition-colors"
                title="Descargar archivo .json completo con fotos originales"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                <span>Descargar archivo .sync.json completo</span>
              </button>

              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-medium text-xs rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT SYNC JSON (Requirement 1, 2 & 5) */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className="relative w-full max-w-xl bg-[#161922] border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Hidden native file input for direct JSON file import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              onChange={handleImportJsonFile}
              className="hidden"
            />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#12141c]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                  <ClipboardPaste className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Importar Copia de Sincronización</h3>
                  <p className="text-[11px] text-zinc-400">
                    Pega el código JSON o carga el archivo para restaurar inventario
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-zinc-300">
                  Elige cómo importar los datos:
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-2.5 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-semibold text-[11px] rounded-lg transition-colors flex items-center gap-1.5 border border-teal-500/30 active:scale-95"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Pegar Portapapeles</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-zinc-200 font-semibold text-[11px] rounded-lg transition-colors flex items-center gap-1.5 border border-white/10 active:scale-95"
                    title="Cargar directamente un archivo .json descargado"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cargar Archivo .json</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-zinc-400 block">
                    Cuadro de texto JSON:
                  </label>
                  {importJsonText.length > 0 && (
                    <span className="text-[10px] font-mono text-zinc-400">
                      {importJsonText.length.toLocaleString()} caracteres
                    </span>
                  )}
                </div>

                {/* Requirement 1: Textarea with NO maxlength restriction, and onPaste handling */}
                <textarea
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    setImportError(null);
                  }}
                  onPaste={(e) => {
                    try {
                      const clipboardData = e.clipboardData;
                      if (clipboardData) {
                        const pasted = clipboardData.getData('text/plain') || clipboardData.getData('text');
                        if (pasted && pasted.length > 0) {
                          e.preventDefault();
                          setImportJsonText(pasted);
                          setImportError(null);

                          // Check if truncated at exactly ~20,000 characters
                          if (pasted.length === 20000 || (pasted.length >= 19900 && pasted.length <= 20100 && !pasted.endsWith('}'))) {
                            setImportError('Atención: El portapapeles de Android cortó el texto a 20,000 caracteres (Unterminated string). En el teléfono emisor, exporta activando "Modo sin fotos" o carga el archivo .json directamente.');
                            return;
                          }

                          // Auto-validate and import if complete
                          try {
                            const parsed = JSON.parse(pasted);
                            if (parsed && (parsed.products || parsed.storeCode || parsed.localPendingProducts)) {
                              const res = SyncService.importSyncFile(pasted);
                              if (res.success) {
                                Sound.playSuccessChime();
                                setImportModalOpen(false);
                                setImportJsonText('');
                                setMessage({
                                  type: 'success',
                                  text: `¡Importado con éxito desde el texto pegado! ${res.message}`,
                                });
                                onRefreshData();
                              } else {
                                setImportError(res.message);
                              }
                            }
                          } catch {
                            // Leave in textarea for manual review
                          }
                        }
                      }
                    } catch (pasteErr) {
                      console.warn('onPaste capture warning:', pasteErr);
                    }
                  }}
                  placeholder="Pega aquí el código JSON (comienza con { y termina con }). No hay límite de tamaño."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  rows={8}
                  className="w-full bg-[#0d1017] border border-white/10 rounded-xl p-3 text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/5">
                💡 <span className="font-semibold text-zinc-300">Consejo para celulares Android:</span> Si el texto se trunca a 20,000 caracteres al transferirlo por WhatsApp o portapapeles, en el otro celular selecciona <strong className="text-teal-300">"Omitir fotos (Modo Ultraligero)"</strong> o carga directamente el archivo <strong className="text-teal-300">.json</strong> con el botón de arriba.
              </p>

              {importError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 p-3 border-t border-white/10 bg-[#12141c]">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-zinc-300 font-medium text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="apply-import-json-btn"
                onClick={handleProcessImportedJson}
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg active:scale-95"
              >
                Procesar e Importar Inventario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
