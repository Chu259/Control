import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Flashlight,
  Boxes,
  ShoppingCart,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  Zap,
  Volume2,
  VolumeX,
  Keyboard,
  Barcode as BarcodeIcon,
} from 'lucide-react';
import { Product } from '../types';
import { StorageService } from '../services/storage';
import { Sound } from '../services/sound';
import { ShoppingService } from '../services/shoppingService';

// MLKit barcode format constants
export const Barcode = {
  FORMAT_ITF: 'itf',
  FORMAT_EAN_13: 'ean_13',
  FORMAT_CODE_128: 'code_128',
  FORMAT_UPC_A: 'upc_a',
  FORMAT_EAN_8: 'ean_8',
  FORMAT_UPC_E: 'upc_e',
  FORMAT_QR_CODE: 'qr_code',
} as const;

interface ScannedRecord {
  id: string;
  code: string;
  productName: string;
  unitsAdded: number;
  formatMode: 'bulk' | 'unit';
  destination: 'replenishment' | 'shopping';
  timestamp: string;
  productId: string;
}

interface DummiesBurstScannerViewProps {
  products: Product[];
  onDataUpdated: () => void;
}

export const DummiesBurstScannerView: React.FC<DummiesBurstScannerViewProps> = ({
  products,
  onDataUpdated,
}) => {
  // Requirement 3: Destination toggle ('replenishment' vs 'shopping')
  const [destination, setDestination] = useState<'replenishment' | 'shopping'>('replenishment');

  // Requirement 4: Format toggle ('bulk' vs 'unit')
  const [formatMode, setFormatMode] = useState<'bulk' | 'unit'>('bulk');

  // Camera stream and status
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Manual fallback input
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Recent scan feedback
  const [lastFeedback, setLastFeedback] = useState<{
    type: 'success' | 'warning';
    title: string;
    subtitle: string;
    unitsBadge?: string;
    product?: Product;
  } | null>(null);

  // Session history
  const [historyList, setHistoryList] = useState<ScannedRecord[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Loop & debounce references
  const scanLoopRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const isCooldownRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);

  // Instantiate native MLKit BarcodeDetector
  const getBarcodeDetector = () => {
    if (barcodeDetectorRef.current) return barcodeDetectorRef.current;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const options = {
          formats: [
            Barcode.FORMAT_ITF,
            Barcode.FORMAT_EAN_13,
            Barcode.FORMAT_CODE_128,
            Barcode.FORMAT_UPC_A,
            Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_UPC_E,
            Barcode.FORMAT_QR_CODE,
          ],
        };
        barcodeDetectorRef.current = new (window as any).BarcodeDetector(options);
      } catch (err) {
        console.warn('MLKit BarcodeDetector init fallback:', err);
        barcodeDetectorRef.current = null;
      }
    }
    return barcodeDetectorRef.current;
  };

  // Requirement 2: Start camera immediately on mount and keep open in loop
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      // Apply continuous autofocus & exposure if supported by hardware
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
          const advanced: any = {};
          if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
            advanced.focusMode = 'continuous';
          }
          if (capabilities.exposureMode && Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) {
            advanced.exposureMode = 'continuous';
          }
          if (Object.keys(advanced).length > 0) {
            await (track as any).applyConstraints({ advanced: [advanced] });
          }
        } catch (e) {
          console.warn('Camera continuous focus constraint info:', e);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Permite el acceso para usar Ráfaga Dummies.'
          : 'Cámara no accesible en este entorno. Puedes ingresar códigos abajo.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      }
    } catch (err) {
      console.warn('Torch not supported:', err);
    }
  };

  // Requirement 2 & 5: Continuous detection loop with cross-recognition
  const startDetectionLoop = () => {
    const detector = getBarcodeDetector();

    const loop = async () => {
      if (
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        !isCooldownRef.current &&
        detector
      ) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            if (raw && typeof raw === 'string') {
              handleProcessBarcode(raw.trim());
            }
          }
        } catch {
          // ignore transient frame decode errors
        }
      }
      scanLoopRef.current = requestAnimationFrame(loop);
    };

    scanLoopRef.current = requestAnimationFrame(loop);
  };

  // Requirement 5: Cross-Recognition Logic & Impact
  const handleProcessBarcode = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length < 3) return;

    const now = Date.now();
    // Debounce exact same barcode for 900ms to allow smooth scanning of consecutive identical items
    if (lastScannedCodeRef.current === cleanCode && now - lastScannedTimeRef.current < 900) {
      return;
    }

    lastScannedCodeRef.current = cleanCode;
    lastScannedTimeRef.current = now;
    isCooldownRef.current = true;

    // Haptic & Audio feedback
    if (soundEnabled) {
      Sound.playScanBeep();
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {
        // ignore
      }
    }

    // Lookup product in local database (Checks both unit barcode and bulk barcode)
    const lookup = StorageService.findProductByBarcode(cleanCode);
    const product = lookup?.product;

    if (!product) {
      // Product not found in local DB
      if (soundEnabled) {
        Sound.playWarningBeep();
      }
      setLastFeedback({
        type: 'warning',
        title: 'Código No Registrado',
        subtitle: `Código leído: ${cleanCode}`,
      });

      // Clear feedback in 1.4s and continue loop immediately
      setTimeout(() => {
        isCooldownRef.current = false;
      }, 1000);
      return;
    }

    // REQUIREMENT 5: CROSS RECOGNITION (CRUCE DE DATOS)
    // If formatMode === 'bulk', even if unit barcode was scanned, add unitsPerBulk (e.g. 12 units)
    const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
    const unitsToAdd = formatMode === 'bulk' ? unitsPerBulk : 1;

    if (destination === 'replenishment') {
      // REQUIREMENT 1 & 2: MODO REPOSICIÓN - SEPARACIÓN ESTRICTA BULTOS VS UNIDADES
      const isBulkScan = formatMode === 'bulk';
      const result = StorageService.accumulateProductReposition(
        product.id,
        isBulkScan ? 'bulk' : 'unit',
        1,
        isBulkScan ? 'Ráfaga: +1 Bulto' : 'Ráfaga: +1 Unidad suelta'
      );

      const bulks = result ? result.bulksPending : (isBulkScan ? 1 : 0);
      const units = result ? result.unitsPending : (isBulkScan ? 0 : 1);
      const totalUnits = result ? result.totalUnits : (isBulkScan ? unitsPerBulk : 1);

      setLastFeedback({
        type: 'success',
        title: product.name,
        subtitle: `Pendiente: ${bulks} ${bulks === 1 ? 'Bulto' : 'Bultos'} y ${units} ${units === 1 ? 'Unidad' : 'Unidades'} (= ${totalUnits} uds totales)`,
        unitsBadge: isBulkScan ? `+1 Bulto (${unitsPerBulk}u)` : `+1 Ud suelta`,
        product: result?.product || product,
      });
    } else {
      // REQUIREMENT 1 & 2: MODO COMPRAS / INGRESO - SUMA ACUMULATIVA
      // Register directly as stock entry
      StorageService.recordStockMovement({
        productId: product.id,
        type: 'in',
        quantity: unitsToAdd,
        reason: 'compra',
        unitType: formatMode,
        bulkQuantity: formatMode === 'bulk' ? 1 : undefined,
        barcodeScanned: cleanCode,
      });

      // Accumulate in shopping list
      const shopResult = ShoppingService.accumulateShoppingItem(
        product.id,
        unitsToAdd,
        formatMode === 'bulk' ? `Ingreso Ráfaga x${unitsToAdd}` : 'Ingreso Ráfaga x1 ud'
      );

      const updatedProd = StorageService.getProducts().find((p) => p.id === product.id);

      setLastFeedback({
        type: 'success',
        title: product.name,
        subtitle: `Ingreso en Stock (+${unitsToAdd} uds, Total: ${updatedProd?.stock ?? product.stock + unitsToAdd} uds • Compras: ${shopResult.totalUnits} uds)`,
        unitsBadge: formatMode === 'bulk' ? `+${unitsToAdd} uds (1 Bulto)` : `+1 ud (Suelta)`,
        product: updatedProd || product,
      });
    }

    // Add to session history
    const record: ScannedRecord = {
      id: `burst-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      code: cleanCode,
      productName: product.name,
      unitsAdded: unitsToAdd,
      formatMode,
      destination,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      productId: product.id,
    };
    setHistoryList((prev) => [record, ...prev]);

    // Notify App of data change
    onDataUpdated();

    // Release cooldown in 850ms so next barcode can be scanned right away
    setTimeout(() => {
      isCooldownRef.current = false;
    }, 850);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleProcessBarcode(manualCode.trim());
    setManualCode('');
  };

  // Calculate session totals
  const totalScansInSession = historyList.length;
  const totalUnitsInSession = historyList.reduce((acc, item) => acc + item.unitsAdded, 0);

  return (
    <div className="relative w-full h-[calc(100vh-65px)] bg-black overflow-hidden flex flex-col select-none">
      {/* FULLSCREEN CAMERA VIEWPORT */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          autoPlay
          playsInline
        />

        {/* Ambient Darkened Viewport Overlay with Aiming Reticle */}
        <div className="absolute inset-0 bg-black/35 pointer-events-none flex flex-col items-center justify-center p-4">
          {/* Aiming Reticle */}
          <div className="relative w-72 h-44 sm:w-80 sm:h-52 rounded-3xl border-2 border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.35)] overflow-hidden flex items-center justify-center">
            {/* Corner Markers */}
            <div className="absolute top-2 left-2 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            <div className="absolute top-2 right-2 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            <div className="absolute bottom-2 left-2 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
            <div className="absolute bottom-2 right-2 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

            {/* Continuous Laser Scanning Animation Line */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-laser-scan pointer-events-none" />

            <div className="text-center px-4 py-2 bg-black/60 rounded-xl backdrop-blur-xs border border-white/10 pointer-events-none">
              <span className="text-[11px] font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5 justify-center">
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Ráfaga Continua Activa</span>
              </span>
            </div>
          </div>
        </div>

        {/* TOP CONTROLS OVERLAY: REQUIREMENT 3 (DESTINATION TOGGLE GRANDE) */}
        <div className="absolute top-3 inset-x-3 z-20 flex flex-col gap-2">
          {/* TOP BUTTON: RECTANGULAR GRANDE DE DESTINO CAMBIANTE */}
          <button
            type="button"
            id="burst-destination-toggle"
            onClick={() => {
              Sound.playSuccessChime();
              setDestination((prev) => (prev === 'replenishment' ? 'shopping' : 'replenishment'));
            }}
            className={`w-full py-3 px-4 rounded-2xl shadow-2xl flex items-center justify-between transition-all duration-200 active:scale-[0.98] border-2 cursor-pointer ${
              destination === 'replenishment'
                ? 'bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 border-purple-400 text-white shadow-purple-900/50'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 border-emerald-400 text-white shadow-emerald-900/50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  destination === 'replenishment' ? 'bg-purple-900/60 text-purple-200' : 'bg-emerald-900/60 text-emerald-200'
                }`}
              >
                {destination === 'replenishment' ? (
                  <Boxes className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
                )}
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-white/80 font-bold">
                    Destino Activo:
                  </span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">
                    Tocar para cambiar
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight truncate">
                  {destination === 'replenishment'
                    ? 'Modo: REPOSICIÓN EN GÓNDOLA'
                    : 'Modo: COMPRAS / INGRESO DE STOCK'}
                </h2>
              </div>
            </div>

            <div className="text-right pl-2 flex-shrink-0">
              <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-black/40 border border-white/20">
                {destination === 'replenishment' ? 'Góndola 📦' : 'Compras 🛒'}
              </span>
            </div>
          </button>

          {/* Camera Auxiliary Controls: Flashlight & Sound */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] text-zinc-300 font-mono border border-white/10 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{totalScansInSession} lecturas ({totalUnitsInSession} uds)</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
                  torchOn
                    ? 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/30'
                    : 'bg-black/60 text-zinc-300 border-white/15 hover:text-white'
                }`}
                title="Linterna"
              >
                <Flashlight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-xl bg-black/60 text-zinc-300 hover:text-white backdrop-blur-md border border-white/15 transition-all"
                title={soundEnabled ? 'Silenciar bip' : 'Activar sonido'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
              </button>
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="p-2 rounded-xl bg-black/60 text-zinc-300 hover:text-white backdrop-blur-md border border-white/15 transition-all"
                title="Ingreso manual de código"
              >
                <Keyboard className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="p-2 rounded-xl bg-black/60 text-zinc-300 hover:text-white backdrop-blur-md border border-white/15 transition-all"
                title="Historial de esta ráfaga"
              >
                <History className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* FEEDBACK OVERLAY CARD (Pops up dynamically after each scan) */}
        {lastFeedback && (
          <div className="absolute top-28 inset-x-4 z-30 animate-scale-up pointer-events-none">
            <div
              className={`p-3.5 rounded-2xl border-2 backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 ${
                lastFeedback.type === 'success'
                  ? 'bg-[#0f172a]/90 border-emerald-400/80 text-white'
                  : 'bg-[#2a1215]/90 border-rose-500/80 text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    lastFeedback.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {lastFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black truncate">{lastFeedback.title}</h4>
                  <p className="text-[11px] text-zinc-300 truncate mt-0.5">{lastFeedback.subtitle}</p>
                </div>
              </div>

              {lastFeedback.unitsBadge && (
                <div className="flex-shrink-0">
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500 text-black font-mono font-black text-xs shadow-md">
                    {lastFeedback.unitsBadge}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANUAL CODE INPUT (COLLAPSIBLE) */}
        {showManualInput && (
          <div className="absolute bottom-28 inset-x-4 z-30 animate-fade-in">
            <form
              onSubmit={handleManualSubmit}
              className="p-3 bg-[#131620]/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl flex items-center gap-2"
            >
              <BarcodeIcon className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Escribe código de barra manual..."
                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Procesar
              </button>
            </form>
          </div>
        )}

        {/* BOTTOM CONTROLS: REQUIREMENT 4 (FORMAT TOGGLE GRANDE DE CRUCE INTELIGENTE) */}
        <div className="absolute bottom-3 inset-x-3 z-20 flex flex-col gap-2">
          {/* BOTTOM BUTTON: RECTANGULAR GRANDE DE FORMATO DE CARGA */}
          <button
            type="button"
            id="burst-format-toggle"
            onClick={() => {
              Sound.playSuccessChime();
              setFormatMode((prev) => (prev === 'bulk' ? 'unit' : 'bulk'));
            }}
            className={`w-full py-3.5 px-4 rounded-2xl shadow-2xl flex items-center justify-between transition-all duration-200 active:scale-[0.98] border-2 cursor-pointer ${
              formatMode === 'bulk'
                ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border-amber-200 text-black shadow-amber-500/30'
                : 'bg-[#181a24] border-zinc-600 text-white shadow-black/60'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  formatMode === 'bulk' ? 'bg-black/20 text-black' : 'bg-white/10 text-teal-400'
                }`}
              >
                {formatMode === 'bulk' ? (
                  <Package className="w-6 h-6 stroke-[2.5]" />
                ) : (
                  <Layers className="w-6 h-6 stroke-[2.5]" />
                )}
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-mono font-black tracking-wider opacity-80">
                    Impacto por Lectura:
                  </span>
                  <span className="text-[9px] bg-black/20 text-inherit px-1.5 py-0.2 rounded-full font-bold">
                    Tocar para cambiar
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight truncate">
                  {formatMode === 'bulk'
                    ? 'Registrar como: 1 BULTO / CAJA'
                    : 'Registrar como: 1 UNIDAD SUELTA'}
                </h3>
              </div>
            </div>

            <div className="text-right pl-2 flex-shrink-0">
              <span
                className={`text-xs font-mono font-black px-2.5 py-1 rounded-xl border ${
                  formatMode === 'bulk' ? 'bg-black text-amber-300 border-black' : 'bg-white/10 text-white border-white/20'
                }`}
              >
                {formatMode === 'bulk' ? '⚡ xBulto' : 'x1 Ud'}
              </span>
            </div>
          </button>

          {/* Subtext explaining Cross-Recognition */}
          <div className="bg-black/60 backdrop-blur-md rounded-xl py-1 px-3 border border-white/10 text-center">
            <p className="text-[10px] text-zinc-300 truncate">
              {formatMode === 'bulk'
                ? '⚡ Cruce Inteligente: Al escanear la unidad o caja, sumará automáticamente las unidades del bulto (unitsPerBulk).'
                : 'Impacto directo: Sumará únicamente 1 unidad individual por cada código detectado.'}
            </p>
          </div>
        </div>
      </div>

      {/* SESSION HISTORY DRAWER / BOTTOM SHEET */}
      {showHistoryDrawer && (
        <div
          onClick={() => setShowHistoryDrawer(false)}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-end justify-center p-3 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#131620] border border-white/15 rounded-3xl p-4 shadow-2xl space-y-3 mb-16 animate-scale-up max-h-[70vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Historial de Ráfaga Actual ({historyList.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryList([])}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {historyList.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  Aún no has escaneado productos en esta sesión de ráfaga.
                </div>
              ) : (
                historyList.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-white truncate">{item.productName}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {item.code} • {item.timestamp}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          item.destination === 'replenishment'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {item.destination === 'replenishment' ? 'Reposición' : 'Compras'}
                      </span>
                      <span className="font-mono font-black text-amber-300">
                        +{item.unitsAdded} uds
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryDrawer(false)}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Cerrar Historial
            </button>
          </div>
        </div>
      )}

      {/* CAMERA ERROR NOTICE */}
      {cameraError && (
        <div className="absolute inset-x-4 top-24 z-30 p-4 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-200 text-xs shadow-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white">Aviso de Cámara</p>
            <p>{cameraError}</p>
            <button
              type="button"
              onClick={startCamera}
              className="mt-2 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
            >
              Reintentar Conexión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
