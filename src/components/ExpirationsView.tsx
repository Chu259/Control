import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Calendar,
  CalendarClock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Search,
  Sparkles,
  Flashlight,
  RefreshCw,
  Plus,
  Tag,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Barcode as BarcodeIcon,
  Pause,
  RotateCw,
  Lock,
} from 'lucide-react';
import { Product, ExpirationItem } from '../types';
import { StorageService } from '../services/storage';
import { ExpirationService } from '../services/expirationService';
import { Sound } from '../services/sound';
import { CloudBackupService } from './../services/cloudBackupService';
import { CyclicWheelPickerModal } from './CyclicWheelPickerModal';

const SPANISH_MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface ExpirationsViewProps {
  products: Product[];
  onDataUpdated?: () => void;
  onNavigateToProduct?: (productId: string) => void;
}

export const ExpirationsView: React.FC<ExpirationsViewProps> = ({
  products,
  onDataUpdated,
  onNavigateToProduct,
}) => {
  // Expiration items state
  const [expirations, setExpirations] = useState<ExpirationItem[]>(() => ExpirationService.getExpirations());
  const [filterTab, setFilterTab] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Camera scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const scanLoopRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const isProcessingRef = useRef(false);

  // Manual code input
  const [manualCode, setManualCode] = useState('');

  // Camera freeze state (Congelar Cámara tras Detección para evitar doble escaneo)
  const [isCameraFrozen, setIsCameraFrozen] = useState(false);
  const isCameraFrozenRef = useRef(false);

  // Selected product being registered
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [manualProductName, setManualProductName] = useState('');
  const [detectedBarcode, setDetectedBarcode] = useState('');

  // Cuadro de "Anotaciones / Nombre de Lote" visible SIEMPRE (Obligatorio para nuevos / Opcional para existentes)
  const [notesOrAnnotation, setNotesOrAnnotation] = useState('');
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const notesInputRef = useRef<HTMLInputElement | null>(null);

  // Quick date selector state (Día / Mes / Año)
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(2026); // Congelado automáticamente en el año en curso (2026)
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

  // Modal selector rodillo nativo (bucle infinito 360°)
  const [isRollerModalOpen, setIsRollerModalOpen] = useState(false);
  const [rollerInitialTab, setRollerInitialTab] = useState<'day' | 'month'>('day');

  // Sync state on external updates
  useEffect(() => {
    const handleUpdated = () => {
      setExpirations(ExpirationService.getExpirations());
    };
    window.addEventListener('expirations_updated', handleUpdated);
    return () => {
      window.removeEventListener('expirations_updated', handleUpdated);
    };
  }, []);

  // Barcode detector initialization
  const getBarcodeDetector = () => {
    if (barcodeDetectorRef.current) return barcodeDetectorRef.current;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const options = {
          formats: [
            'itf',
            'ean_13',
            'code_128',
            'upc_a',
            'ean_8',
            'upc_e',
            'qr_code',
          ],
        };
        barcodeDetectorRef.current = new (window as any).BarcodeDetector(options);
      } catch (err) {
        console.warn('BarcodeDetector fallback:', err);
        barcodeDetectorRef.current = null;
      }
    }
    return barcodeDetectorRef.current;
  };

  // Start camera on mount, stop on unmount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Cámara no soportada en este navegador');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      // Autofocus
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            await (track as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch {}
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
      setCameraError('Cámara no disponible. Puedes ingresar el código o buscar el producto manualmente abajo.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    setTorchOn(false);
  };

  const resumeCamera = async () => {
    setIsCameraFrozen(false);
    isCameraFrozenRef.current = false;
    isProcessingRef.current = false;
    if (videoRef.current && cameraActive) {
      try {
        await videoRef.current.play();
      } catch (err) {
        console.warn('Error resuming video stream:', err);
      }
    }
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const newTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorch }],
      });
      setTorchOn(newTorch);
    } catch (e) {
      console.warn('Torch not supported:', e);
    }
  };

  const handleRecognizeBarcode = (barcode: string) => {
    const cleanCode = barcode.trim();
    if (!cleanCode) return;

    Sound.playScanBeep();

    // 1. Congelar Cámara por completo tras detección (Evitar doble escaneo)
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (e) {
        console.warn('Error pausing video:', e);
      }
    }
    setIsCameraFrozen(true);
    isCameraFrozenRef.current = true;
    isProcessingRef.current = true;

    // Look up in products catalog
    const found = products.find(
      (p) =>
        (p.barcodeUnit && p.barcodeUnit.trim() === cleanCode) ||
        (p.barcode && p.barcode.trim() === cleanCode) ||
        (p.barcodeBulk && p.barcodeBulk.trim() === cleanCode)
    );

    setDetectedBarcode(cleanCode);
    setAnnotationError(null);

    if (found) {
      setSelectedProduct(found);
      setManualProductName(found.name);
      setNotesOrAnnotation('');
    } else {
      setSelectedProduct(null);
      setManualProductName('');
      setNotesOrAnnotation('');
      setTimeout(() => {
        notesInputRef.current?.focus();
      }, 150);
    }

    // Default expiration date: end of current month (Año congelado en 2026)
    const curYear = 2026;
    const curMonth = today.getMonth() + 1;
    const lastDayOfMonth = new Date(curYear, curMonth, 0).getDate();
    setSelectedYear(curYear);
    setSelectedMonth(curMonth);
    setSelectedDay(lastDayOfMonth);

    setLastSavedMessage(null);
  };

  const startDetectionLoop = () => {
    const detector = getBarcodeDetector();
    if (!detector) return;

    let lastScanTime = 0;
    const scanFrame = async (timestamp: number) => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Si la cámara está congelada o procesando un escaneo previo, PAUSAR captura por completo
      if (isCameraFrozenRef.current || isProcessingRef.current) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Throttle scans to every 250ms
      if (timestamp - lastScanTime > 250) {
        lastScanTime = timestamp;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && rawValue.trim()) {
              isProcessingRef.current = true;
              handleRecognizeBarcode(rawValue.trim());
            }
          }
        } catch {
          // ignore detection frame errors
        }
      }

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    };

    scanLoopRef.current = requestAnimationFrame(scanFrame);
  };

  // Preset date buttons
  const applyPreset = (monthsToAdd: number, endOfMonth: boolean = true) => {
    const target = new Date();
    target.setMonth(target.getMonth() + monthsToAdd);
    const y = target.getFullYear();
    const m = target.getMonth() + 1;
    const d = endOfMonth ? new Date(y, m, 0).getDate() : Math.min(today.getDate(), new Date(y, m, 0).getDate());

    setSelectedYear(y);
    setSelectedMonth(m);
    setSelectedDay(d);
  };

  // Compute formatted expiration date string YYYY-MM-DD
  const formatIsoDate = (d: number, m: number, y: number): string => {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const expirationDateStr = formatIsoDate(selectedDay, selectedMonth, selectedYear);

  const handleCancel = () => {
    setSelectedProduct(null);
    setDetectedBarcode('');
    setManualProductName('');
    setNotesOrAnnotation('');
    setAnnotationError(null);
    setIsRollerModalOpen(false);
    resumeCamera();
  };

  // Save expiration logic
  const handleSaveExpiration = () => {
    // 2. Cuadro de "Anotaciones / Nombre de Lote":
    // - Si el producto es NUEVO: OBLIGATORIO para escribir su nombre descriptivo.
    // - Si el producto YA EXISTE: OPCIONAL (puede dejarse vacío sin trabar el guardado).
    if (!selectedProduct) {
      if (!notesOrAnnotation.trim()) {
        setAnnotationError('Debes ingresar las anotaciones o el nombre descriptivo del artículo.');
        Sound.playWarningBeep();
        notesInputRef.current?.focus();
        return;
      }
    }

    const effectiveName = selectedProduct ? selectedProduct.name : notesOrAnnotation.trim();
    const effectiveNotes = notesOrAnnotation.trim() || 'Control visual fin de mes';

    const prodToSave: Product = selectedProduct || {
      id: `custom-${Date.now()}`,
      name: effectiveName,
      barcode: detectedBarcode || `CUSTOM-${Date.now()}`,
      barcodeUnit: detectedBarcode || `CUSTOM-${Date.now()}`,
      unitsPerBulk: 1,
      category: 'Sin Registrar',
      stock: 0,
      minStockAlert: 5,
      costPrice: 0,
      sellingPrice: 0,
      lastUpdated: new Date().toISOString(),
    };

    const saved = ExpirationService.addExpiration({
      product: prodToSave,
      expirationDate: expirationDateStr,
      notes: effectiveNotes,
      tempProductName: !selectedProduct ? effectiveName : undefined,
    });

    Sound.playSuccessChime();
    setLastSavedMessage(`¡Registrado! ${saved.productName} vence el ${selectedDay}/${selectedMonth}/${selectedYear}.`);

    // Reset selection and reactivate camera automatically
    setSelectedProduct(null);
    setDetectedBarcode('');
    setManualProductName('');
    setNotesOrAnnotation('');
    setAnnotationError(null);
    setIsRollerModalOpen(false);
    resumeCamera();

    setExpirations(ExpirationService.getExpirations());
    if (onDataUpdated) onDataUpdated();

    setTimeout(() => {
      setLastSavedMessage(null);
    }, 3500);
  };

  const handleResolve = (id: string) => {
    ExpirationService.resolveExpiration(id, 'Producto Retirado / Góndola Verificada');
    setExpirations(ExpirationService.getExpirations());
    if (onDataUpdated) onDataUpdated();
  };

  const handleDelete = (id: string) => {
    ExpirationService.deleteExpiration(id);
    setExpirations(ExpirationService.getExpirations());
    if (onDataUpdated) onDataUpdated();
  };

  // Filter and sort expirations
  const filteredExpirations = expirations
    .filter((item) => {
      if (filterTab === 'pending' && item.status !== 'pending') return false;
      if (filterTab === 'resolved' && item.status !== 'resolved') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.productName.toLowerCase().includes(q) ||
          (item.tempProductName && item.tempProductName.toLowerCase().includes(q)) ||
          item.barcode.toLowerCase().includes(q) ||
          (item.aisleName && item.aisleName.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));

  // Count pending today / overdue
  const todayIso = formatIsoDate(today.getDate(), today.getMonth() + 1, today.getFullYear());
  const pendingCount = expirations.filter((it) => it.status === 'pending').length;
  const overdueOrTodayCount = expirations.filter(
    (it) => it.status === 'pending' && it.expirationDate <= todayIso
  ).length;

  return (
    <div className="space-y-4 pb-28 animate-fade-in px-3 pt-2">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-rose-500/10 border border-amber-500/30 rounded-2xl p-3.5 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/30 border border-amber-500/40 text-amber-300 flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Agenda de Vencimientos
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold">
                Fin de Mes
              </span>
            </h2>
            <p className="text-[11px] text-zinc-300">
              Control visual con cámara MLKit y alarmas estrictas 10:00 hs y 20:00 hs
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl block">
            {pendingCount} Pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
          {overdueOrTodayCount > 0 && (
            <span className="text-[10px] text-rose-400 font-bold mt-0.5 block animate-pulse">
              ⚠️ {overdueOrTodayCount} para HOY
            </span>
          )}
        </div>
      </div>

      {/* Camera Live Viewport (Clean & Always Active) */}
      <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className={`w-4/5 h-2/3 border-2 border-dashed rounded-xl relative transition-all ${
            isCameraFrozen
              ? 'border-amber-400/90 shadow-[0_0_25px_rgba(251,191,36,0.4)]'
              : 'border-teal-400/80 shadow-[0_0_20px_rgba(20,184,166,0.3)]'
          }`}>
            <div className={`absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 -mt-1 -ml-1 rounded-tl ${isCameraFrozen ? 'border-amber-400' : 'border-teal-400'}`} />
            <div className={`absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 -mt-1 -mr-1 rounded-tr ${isCameraFrozen ? 'border-amber-400' : 'border-teal-400'}`} />
            <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 -mb-1 -ml-1 rounded-bl ${isCameraFrozen ? 'border-amber-400' : 'border-teal-400'}`} />
            <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 -mb-1 -mr-1 rounded-br ${isCameraFrozen ? 'border-amber-400' : 'border-teal-400'}`} />

            {!isCameraFrozen && (
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
            )}
          </div>
        </div>

        {/* Frozen Indicator Overlay */}
        {isCameraFrozen && (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center pointer-events-none z-10 animate-fade-in">
            <div className="bg-black/85 border border-amber-400/70 rounded-2xl px-4 py-2.5 shadow-2xl max-w-xs space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-amber-300 text-xs font-bold">
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Cámara Pausada / Visor Congelado</span>
              </div>
              <p className="text-[10px] text-zinc-300 leading-snug">
                Código detectado con éxito. Interactúa con el formulario abajo sin peligro de reescaneo.
              </p>
            </div>
          </div>
        )}

        {/* Top Camera Controls */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto z-20">
          <div className={`flex items-center gap-1.5 backdrop-blur-md px-2.5 py-1 rounded-full border text-[11px] ${
            isCameraFrozen
              ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
              : 'bg-black/60 border-white/10 text-teal-300'
          }`}>
            {isCameraFrozen ? (
              <>
                <Pause className="w-3 h-3 text-amber-400" />
                <span>Captura pausada para edición</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                <span>MLKit Escaneando continuo</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                torchOn
                  ? 'bg-amber-500 text-black border-amber-400 shadow-lg'
                  : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
              }`}
              title="Linterna"
            >
              <Flashlight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-black/80 transition-all"
              title="Girar Cámara"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-0 bg-zinc-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
            <Camera className="w-8 h-8 text-amber-400 mb-2" />
            <p className="text-xs text-zinc-300 mb-3 max-w-xs">{cameraError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl"
            >
              Reintentar Cámara
            </button>
          </div>
        )}
      </div>

      {/* Quick Barcode / Name Input for Fallback */}
      <div className="bg-[#141824] border border-white/10 rounded-2xl p-2.5 flex items-center gap-2">
        <BarcodeIcon className="w-4 h-4 text-zinc-400 flex-shrink-0 ml-1" />
        <input
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="O tipear código o nombre del producto..."
          className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-hidden"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && manualCode.trim()) {
              handleRecognizeBarcode(manualCode.trim());
              setManualCode('');
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (manualCode.trim()) {
              handleRecognizeBarcode(manualCode.trim());
              setManualCode('');
            }
          }}
          disabled={!manualCode.trim()}
          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-black text-xs font-bold rounded-xl transition-all"
        >
          Cargar
        </button>
      </div>

      {/* Feedback Alert for Last Saved */}
      {lastSavedMessage && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold animate-scale-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{lastSavedMessage}</span>
        </div>
      )}

      {/* Registration Card (Activated when a product is recognized or typed) */}
      {(selectedProduct || detectedBarcode) && (
        <div className="bg-[#161a26] border-2 border-teal-500/50 rounded-2xl p-4 shadow-2xl space-y-4 animate-scale-up">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {selectedProduct?.image ? (
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-12 h-12 rounded-xl object-cover bg-white/5 border border-white/10"
                />
              ) : (
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold text-xs ${
                  selectedProduct
                    ? 'bg-teal-500/20 border-teal-500/30 text-teal-300'
                    : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                }`}>
                  {selectedProduct ? (selectedProduct.name.charAt(0) || 'P') : 'NUEVO'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    selectedProduct
                      ? 'text-teal-400 bg-teal-500/10 border border-teal-500/20'
                      : 'text-amber-300 bg-amber-500/15 border border-amber-500/30'
                  }`}>
                    {selectedProduct ? 'Artículo en Catálogo' : '⚠️ Producto Sin Registrar'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white leading-tight mt-0.5">
                  {selectedProduct ? selectedProduct.name : (notesOrAnnotation.trim() || 'Ingresar nombre temporal abajo')}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 flex-wrap">
                  <span>Código: <strong className="text-zinc-200 font-mono">{detectedBarcode || selectedProduct?.barcode}</strong></span>
                  {selectedProduct?.category && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-[10px] text-zinc-300">
                      {selectedProduct.category}
                    </span>
                  )}
                  {selectedProduct && (
                    <span>Stock: <strong className="text-zinc-200">{selectedProduct.stock} uds</strong></span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              title="Cancelar y reanudar cámara"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Cuadro de "Anotaciones / Nombre de Lote" FISICAMENTE VISIBLE SIEMPRE */}
          {/* - Obligatorio para producto nuevo (sin registrar) */}
          {/* - Opcional para producto existente en catálogo */}
          <div
            id="field-notes-annotation-card"
            className={`rounded-2xl p-3.5 space-y-1.5 transition-all ${
              !selectedProduct
                ? 'bg-amber-500/10 border-2 border-amber-500/40 shadow-md'
                : 'bg-white/[0.04] border border-white/10'
            }`}
          >
            <label htmlFor="input-notes-annotation" className="block text-xs font-bold flex items-center justify-between">
              <span className={!selectedProduct ? 'text-amber-300 flex items-center gap-1.5' : 'text-zinc-200 flex items-center gap-1.5'}>
                <Tag className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>
                  {!selectedProduct
                    ? 'Anotaciones / Nombre Temporal del Artículo:'
                    : 'Anotaciones / Nombre de Lote:'}
                </span>
              </span>
              {!selectedProduct ? (
                <span className="text-[10px] text-rose-400 font-extrabold bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
                  * Obligatorio
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400 font-semibold bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                  Opcional
                </span>
              )}
            </label>
            <input
              id="input-notes-annotation"
              ref={notesInputRef}
              type="text"
              value={notesOrAnnotation}
              onChange={(e) => {
                setNotesOrAnnotation(e.target.value);
                if (annotationError && e.target.value.trim()) {
                  setAnnotationError(null);
                }
              }}
              placeholder={
                !selectedProduct
                  ? 'Ej: Gatorade Manzana 500ml, Lote especial góndola...'
                  : 'Opcional: Ej. Caja dañada, Lote de oferta, Frente góndola...'
              }
              className={`w-full px-3 py-2.5 rounded-xl bg-[#0e111a] border text-xs text-white placeholder-zinc-500 focus:outline-hidden transition-all ${
                annotationError
                  ? 'border-rose-500 ring-2 ring-rose-500/50'
                  : !selectedProduct
                  ? 'border-amber-500/50 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50'
                  : 'border-white/10 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/50'
              }`}
            />
            {annotationError ? (
              <p className="text-[10px] text-rose-400 font-bold flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{annotationError}</span>
              </p>
            ) : (
              <p className="text-[10px] text-zinc-400">
                {!selectedProduct
                  ? 'Obligatorio: Escribe una descripción libre para saber con certeza qué producto físico retirar del estante en la alarma.'
                  : 'Opcional: Puedes registrar detalles de góndola de forma libre o dejarlo vacío sin trabar el guardado de la alerta.'}
              </p>
            )}
          </div>

          {/* Quick Date Selector (Día / Mes / Año) con Selector Tipo Rodillo Nativo */}
          <div className="bg-[#0e111a] border border-white/10 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Fecha de Vencimiento de la Hoja
              </span>
              <span className="text-xs font-mono font-bold text-white bg-teal-500/20 border border-teal-500/40 px-2 py-0.5 rounded-md">
                {String(selectedDay).padStart(2, '0')} / {String(selectedMonth).padStart(2, '0')} / {selectedYear}
              </span>
            </div>

            {/* Cuadros Numéricos Táctiles (Sin botones +/-; abren rodillo infinito al presionar) */}
            <div className="grid grid-cols-3 gap-2">
              {/* Día - Tocar para abrir rodillo cíclico infinito 1-31 */}
              <button
                type="button"
                id="btn-open-roller-day"
                onClick={() => {
                  setRollerInitialTab('day');
                  setIsRollerModalOpen(true);
                }}
                className="bg-white/[0.03] hover:bg-white/[0.08] active:scale-95 border border-white/10 hover:border-teal-400/50 rounded-xl p-2.5 text-center transition-all flex flex-col items-center justify-between group shadow-sm"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider group-hover:text-teal-300">
                    Día
                  </span>
                  <span className="text-[9px] text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded border border-teal-500/20 font-mono">
                    1-31
                  </span>
                </div>
                <span className="text-2xl font-black text-white font-mono my-1 tracking-tight">
                  {String(selectedDay).padStart(2, '0')}
                </span>
                <span className="text-[9px] text-teal-300/80 font-medium flex items-center gap-0.5">
                  <RotateCw className="w-2.5 h-2.5" />
                  Rodillo 360°
                </span>
              </button>

              {/* Mes - Tocar para abrir rodillo cíclico infinito 1-12 */}
              <button
                type="button"
                id="btn-open-roller-month"
                onClick={() => {
                  setRollerInitialTab('month');
                  setIsRollerModalOpen(true);
                }}
                className="bg-white/[0.03] hover:bg-white/[0.08] active:scale-95 border border-white/10 hover:border-amber-400/50 rounded-xl p-2.5 text-center transition-all flex flex-col items-center justify-between group shadow-sm"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider group-hover:text-amber-300">
                    Mes
                  </span>
                  <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-mono">
                    1-12
                  </span>
                </div>
                <div className="my-1 text-center">
                  <span className="text-2xl font-black text-amber-300 font-mono block leading-none">
                    {String(selectedMonth).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-300 block truncate mt-0.5">
                    {SPANISH_MONTH_NAMES[selectedMonth - 1]}
                  </span>
                </div>
                <span className="text-[9px] text-amber-300/80 font-medium flex items-center gap-0.5">
                  <RotateCw className="w-2.5 h-2.5" />
                  Rodillo 360°
                </span>
              </button>

              {/* Año - Congelado automáticamente en el año en curso (2026) para ahorrar clics */}
              <div
                className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 text-center flex flex-col items-center justify-between opacity-85 select-none"
                title="Año en curso congelado automáticamente para ahorrar clics"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-zinc-500" />
                    Año
                  </span>
                  <span className="text-[9px] text-zinc-500 bg-white/5 px-1.5 py-0.2 rounded border border-white/5">
                    Fijo
                  </span>
                </div>
                <span className="text-xl font-black text-zinc-300 font-mono my-1 tracking-tight">
                  {selectedYear}
                </span>
                <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5">
                  🔒 Año 2026
                </span>
              </div>
            </div>

            {/* Quick preset buttons: 3 atajos dinámicos de fecha basados en el reloj del dispositivo */}
            {(() => {
              const now = new Date();
              const curYear = 2026;
              const curMonthIdx = now.getMonth();

              // Botón 1: "Este Mes" -> último día del mes actual (Ej: 31 de Octubre)
              const curMonthLastDay = new Date(curYear, curMonthIdx + 1, 0).getDate();
              const curMonthName = SPANISH_MONTH_NAMES[curMonthIdx];

              // Botón 2: "Mes Próximo" -> último día del mes entrante (Ej: 30 de Noviembre)
              const nextMonthDate = new Date(curYear, curMonthIdx + 1, 1);
              const nextYear = nextMonthDate.getFullYear();
              const nextMonthIdx = nextMonthDate.getMonth();
              const nextMonthLastDay = new Date(nextYear, nextMonthIdx + 1, 0).getDate();
              const nextMonthName = SPANISH_MONTH_NAMES[nextMonthIdx];

              // Botón 3: "1ra Sem. Siguiente" -> día 7 del mes subsiguiente (Ej: 7 de Diciembre) como margen de seguridad
              const followMonthDate = new Date(curYear, curMonthIdx + 2, 1);
              const followYear = followMonthDate.getFullYear();
              const followMonthIdx = followMonthDate.getMonth();
              const followDay = 7;
              const followMonthName = SPANISH_MONTH_NAMES[followMonthIdx];

              const isBtn1Active = selectedYear === curYear && selectedMonth === (curMonthIdx + 1) && selectedDay === curMonthLastDay;
              const isBtn2Active = selectedYear === nextYear && selectedMonth === (nextMonthIdx + 1) && selectedDay === nextMonthLastDay;
              const isBtn3Active = selectedYear === followYear && selectedMonth === (followMonthIdx + 1) && selectedDay === followDay;

              return (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-zinc-400 font-semibold block">
                    Atajos Dinámicos (Control Mensual):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Botón 1: Este Mes */}
                    <button
                      type="button"
                      id="btn-shortcut-este-mes"
                      onClick={() => {
                        setSelectedYear(curYear);
                        setSelectedMonth(curMonthIdx + 1);
                        setSelectedDay(curMonthLastDay);
                      }}
                      className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                        isBtn1Active
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md ring-1 ring-amber-400/50'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-300'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight">
                        Este Mes ({curMonthName})
                      </span>
                      <span className="text-[10px] text-amber-400/90 font-mono mt-0.5">
                        Fija: {curMonthLastDay} de {curMonthName}
                      </span>
                    </button>

                    {/* Botón 2: Mes Próximo */}
                    <button
                      type="button"
                      id="btn-shortcut-mes-proximo"
                      onClick={() => {
                        setSelectedYear(nextYear);
                        setSelectedMonth(nextMonthIdx + 1);
                        setSelectedDay(nextMonthLastDay);
                      }}
                      className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                        isBtn2Active
                          ? 'bg-teal-500/20 border-teal-400 text-teal-200 shadow-md ring-1 ring-teal-400/50'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-300'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight">
                        Mes Próximo ({nextMonthName})
                      </span>
                      <span className="text-[10px] text-teal-300/90 font-mono mt-0.5">
                        Fija: {nextMonthLastDay} de {nextMonthName}
                      </span>
                    </button>

                    {/* Botón 3: 1ra Sem. Siguiente */}
                    <button
                      type="button"
                      id="btn-shortcut-1ra-sem-siguiente"
                      onClick={() => {
                        setSelectedYear(followYear);
                        setSelectedMonth(followMonthIdx + 1);
                        setSelectedDay(followDay);
                      }}
                      className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                        isBtn3Active
                          ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow-md ring-1 ring-indigo-400/50'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-300'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight">
                        1ra Sem. Siguiente ({followMonthName})
                      </span>
                      <span className="text-[10px] text-indigo-300/90 font-mono mt-0.5">
                        Fija: {followDay} de {followMonthName} (Margen)
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
            <span className="text-amber-400 font-bold">ℹ️ Regla:</span>
            <span>Este registro NO altera stock ni bultos; solo programa las alarmas de las 10:00 y 20:00 hs.</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="w-1/3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold active:scale-95 transition-all"
            >
              Cancelar
            </button>

            <button
              type="button"
              id="btn-save-expiration-agenda"
              onClick={handleSaveExpiration}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-98 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Guardar en Agenda
            </button>
          </div>
        </div>
      )}

      {/* Expirations Agenda List Header & Filters */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            Agenda Registrada ({filteredExpirations.length})
          </h3>

          <div className="flex items-center gap-1 bg-[#161a26] p-0.5 rounded-xl border border-white/5">
            <button
              onClick={() => setFilterTab('pending')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                filterTab === 'pending'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFilterTab('resolved')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                filterTab === 'resolved'
                  ? 'bg-emerald-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Resueltos
            </button>
            <button
              onClick={() => setFilterTab('all')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                filterTab === 'all'
                  ? 'bg-white/20 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Todos
            </button>
          </div>
        </div>

        {/* Search inside agenda */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por artículo, código o pasillo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#141824] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-hidden"
          />
        </div>

        {/* Agenda Cards */}
        {filteredExpirations.length === 0 ? (
          <div className="bg-[#141824] border border-dashed border-white/10 rounded-2xl p-6 text-center text-zinc-400 space-y-2">
            <CalendarClock className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-xs font-semibold text-zinc-300">No hay vencimientos en este filtro</p>
            <p className="text-[11px] text-zinc-500">
              Escanea el código de barras con la cámara arriba para registrar el control de fin de mes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExpirations.map((item) => {
              const isPending = item.status === 'pending';
              const isOverdue = item.expirationDate < todayIso;
              const isToday = item.expirationDate === todayIso;

              // Format date DD/MM/YYYY
              const [y, m, d] = item.expirationDate.split('-');
              const formattedDate = `${d}/${m}/${y}`;

              // Calculate days remaining
              const expTime = new Date(item.expirationDate).getTime();
              const todayTime = new Date(todayIso).getTime();
              const diffDays = Math.round((expTime - todayTime) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isPending && isToday
                      ? 'bg-rose-500/15 border-rose-500/50 shadow-lg shadow-rose-950/30'
                      : isPending && isOverdue
                      ? 'bg-rose-950/20 border-rose-600/40'
                      : isPending && diffDays <= 7
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : item.status === 'resolved'
                      ? 'bg-[#121620] border-emerald-500/20 opacity-70'
                      : 'bg-[#141824] border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        {isPending && isToday ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500 text-white animate-pulse">
                            ⚠️ VENCE HOY
                          </span>
                        ) : isPending && isOverdue ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white">
                            VENCIDO
                          </span>
                        ) : isPending ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            En {diffDays} día{diffDays !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ✔ Resuelto / Verificado
                          </span>
                        )}

                        {item.aisleName && (
                          <span className="text-[10px] text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded">
                            {item.aisleName}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-white leading-snug flex items-center gap-2 flex-wrap">
                        <span>{item.tempProductName || item.productName}</span>
                        {item.tempProductName && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                            Anotación Temporal
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        Cod: <strong className="text-zinc-200">{item.barcode}</strong>
                      </p>
                      {item.notes && (
                        <p className="text-[10px] text-zinc-400 mt-1 italic">
                          "{item.notes}"
                        </p>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-bold font-mono text-zinc-200 block">
                        {formattedDate}
                      </span>
                      <span className="text-[9px] text-zinc-500 block">
                        {item.status === 'resolved' ? 'Verificado' : 'Fecha límite'}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons on card */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-2">
                    <span className="text-[10px] text-zinc-500">
                      Reg: {new Date(item.registeredAt).toLocaleDateString('es-ES')}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleResolve(item.id)}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          ✔ Góndola Verificada
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Cyclic Wheel / Roller Modal (Bucle Infinito 360° / Selección 1 Toque) */}
      <CyclicWheelPickerModal
        isOpen={isRollerModalOpen}
        initialTab={rollerInitialTab}
        selectedDay={selectedDay}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelectDay={(day) => setSelectedDay(day)}
        onSelectMonth={(month) => setSelectedMonth(month)}
        onClose={() => setIsRollerModalOpen(false)}
      />
    </div>
  );
};
