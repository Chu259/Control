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
} from 'lucide-react';
import { Product, ExpirationItem } from '../types';
import { StorageService } from '../services/storage';
import { ExpirationService } from '../services/expirationService';
import { Sound } from '../services/sound';
import { CloudBackupService } from './../services/cloudBackupService';

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

  // Selected product being registered
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [manualProductName, setManualProductName] = useState('');
  const [detectedBarcode, setDetectedBarcode] = useState('');

  // Quick date selector state (Día / Mes / Año)
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [notes, setNotes] = useState('Control visual fin de mes');
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

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

    // Look up in products catalog
    const found = products.find(
      (p) =>
        (p.barcodeUnit && p.barcodeUnit.trim() === cleanCode) ||
        (p.barcode && p.barcode.trim() === cleanCode) ||
        (p.barcodeBulk && p.barcodeBulk.trim() === cleanCode)
    );

    setDetectedBarcode(cleanCode);

    if (found) {
      setSelectedProduct(found);
      setManualProductName(found.name);
    } else {
      setSelectedProduct(null);
      setManualProductName(`Producto (${cleanCode})`);
    }

    // Default expiration date: end of current month
    const curYear = today.getFullYear();
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

      // Throttle scans to every 250ms
      if (timestamp - lastScanTime > 250 && !isProcessingRef.current) {
        lastScanTime = timestamp;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && rawValue.trim()) {
              isProcessingRef.current = true;
              handleRecognizeBarcode(rawValue.trim());
              setTimeout(() => {
                isProcessingRef.current = false;
              }, 1200);
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

  // Save expiration logic
  const handleSaveExpiration = () => {
    if (!selectedProduct && !manualProductName.trim()) {
      Sound.playWarningBeep();
      return;
    }

    const prodToSave: Product = selectedProduct || {
      id: `custom-${Date.now()}`,
      name: manualProductName.trim(),
      barcode: detectedBarcode || `CUSTOM-${Date.now()}`,
      barcodeUnit: detectedBarcode || `CUSTOM-${Date.now()}`,
      unitsPerBulk: 1,
      category: 'General',
      stock: 0,
      minStockAlert: 5,
      costPrice: 0,
      sellingPrice: 0,
      lastUpdated: new Date().toISOString(),
    };

    const saved = ExpirationService.addExpiration({
      product: prodToSave,
      expirationDate: expirationDateStr,
      notes: notes.trim() || 'Control visual fin de mes',
    });

    Sound.playSuccessChime();
    setLastSavedMessage(`¡Registrado! ${saved.productName} vence el ${selectedDay}/${selectedMonth}/${selectedYear}.`);

    // Reset selection to keep camera free for next scan
    setTimeout(() => {
      setSelectedProduct(null);
      setDetectedBarcode('');
      setManualProductName('');
      setLastSavedMessage(null);
    }, 2500);

    setExpirations(ExpirationService.getExpirations());
    if (onDataUpdated) onDataUpdated();
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
          item.barcode.toLowerCase().includes(q) ||
          (item.aisleName && item.aisleName.toLowerCase().includes(q))
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
          <div className="w-4/5 h-2/3 border-2 border-dashed border-teal-400/80 rounded-xl relative shadow-[0_0_20px_rgba(20,184,166,0.3)]">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-teal-400 -mt-1 -ml-1 rounded-tl" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-teal-400 -mt-1 -mr-1 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-teal-400 -mb-1 -ml-1 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-teal-400 -mb-1 -mr-1 rounded-br" />

            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Top Camera Controls */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span>MLKit Escaneando continuo</span>
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
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-300 flex items-center justify-center font-bold text-sm">
                  {selectedProduct?.name?.charAt(0) || 'P'}
                </div>
              )}
              <div>
                <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">
                  Artículo Reconocido
                </span>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {selectedProduct ? selectedProduct.name : manualProductName}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                  <span>Código: <strong className="text-zinc-200">{detectedBarcode || selectedProduct?.barcode}</strong></span>
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
              onClick={() => {
                setSelectedProduct(null);
                setDetectedBarcode('');
              }}
              className="p-1 text-zinc-400 hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Date Selector (Día / Mes / Año) */}
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

            {/* Steppers for Día, Mes, Año */}
            <div className="grid grid-cols-3 gap-2">
              {/* Día */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2 text-center">
                <span className="text-[10px] text-zinc-400 font-semibold block uppercase mb-1">Día</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedDay((d) => Math.max(1, d - 1))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center active:scale-95"
                  >
                    -
                  </button>
                  <span className="text-base font-bold text-white font-mono">{String(selectedDay).padStart(2, '0')}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDay((d) => Math.min(31, d + 1))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Mes */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2 text-center">
                <span className="text-[10px] text-zinc-400 font-semibold block uppercase mb-1">Mes</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((m) => Math.max(1, m - 1))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center active:scale-95"
                  >
                    -
                  </button>
                  <span className="text-base font-bold text-amber-300 font-mono">{String(selectedMonth).padStart(2, '0')}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((m) => Math.min(12, m + 1))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Año */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2 text-center">
                <span className="text-[10px] text-zinc-400 font-semibold block uppercase mb-1">Año</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedYear((y) => Math.max(2025, y - 1))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center active:scale-95"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold text-white font-mono">{selectedYear}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedYear((y) => Math.min(2035, y + 1))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Quick preset buttons: 3 atajos dinámicos de fecha basados en el reloj del dispositivo */}
            {(() => {
              const SPANISH_MONTHS = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
              ];
              const now = new Date();
              const curYear = now.getFullYear();
              const curMonthIdx = now.getMonth();

              // Botón 1: "Este Mes" -> último día del mes actual (Ej: 31 de Octubre)
              const curMonthLastDay = new Date(curYear, curMonthIdx + 1, 0).getDate();
              const curMonthName = SPANISH_MONTHS[curMonthIdx];

              // Botón 2: "Mes Próximo" -> último día del mes entrante (Ej: 30 de Noviembre)
              const nextMonthDate = new Date(curYear, curMonthIdx + 1, 1);
              const nextYear = nextMonthDate.getFullYear();
              const nextMonthIdx = nextMonthDate.getMonth();
              const nextMonthLastDay = new Date(nextYear, nextMonthIdx + 1, 0).getDate();
              const nextMonthName = SPANISH_MONTHS[nextMonthIdx];

              // Botón 3: "1ra Sem. Siguiente" -> día 7 del mes subsiguiente (Ej: 7 de Diciembre) como margen de seguridad
              const followMonthDate = new Date(curYear, curMonthIdx + 2, 1);
              const followYear = followMonthDate.getFullYear();
              const followMonthIdx = followMonthDate.getMonth();
              const followDay = 7;
              const followMonthName = SPANISH_MONTHS[followMonthIdx];

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

            {/* Optional note input */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nota opcional (Ej: Lote 4B, frente góndola)"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
            <span className="text-amber-400 font-bold">ℹ️ Regla:</span>
            <span>Este registro NO altera stock ni bultos; solo programa las alarmas de las 10:00 y 20:00 hs.</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedProduct(null);
                setDetectedBarcode('');
              }}
              className="w-1/3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold"
            >
              Cancelar
            </button>

            <button
              type="button"
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

                      <h4 className="text-xs font-bold text-white leading-snug">
                        {item.productName}
                      </h4>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        Cod: {item.barcode}
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
    </div>
  );
};
