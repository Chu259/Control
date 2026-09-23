import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Flashlight, RefreshCw, Barcode, CheckCircle2, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { Sound } from '../services/sound';
import { StorageService } from '../services/storage';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string, product?: Product, matchType?: 'unit' | 'bulk') => void;
  products: Product[];
  mode?: 'lookup' | 'in' | 'out';
  scanTarget?: 'unit' | 'bulk' | null;
}

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onBarcodeDetected,
  products,
  mode = 'lookup',
  scanTarget,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [detectedInfo, setDetectedInfo] = useState<{
    product?: Product;
    matchType?: 'unit' | 'bulk';
  } | null>(null);
  const [scanningActive, setScanningActive] = useState(false);
  const scanLoopRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('barcode-scanner-active');
      document.documentElement.classList.add('barcode-scanner-active');
      startCamera();
    } else {
      document.body.classList.remove('barcode-scanner-active');
      document.documentElement.classList.remove('barcode-scanner-active');
      stopCamera();
      setLastScanned(null);
      setDetectedInfo(null);
      setManualCode('');
    }
    return () => {
      document.body.classList.remove('barcode-scanner-active');
      document.documentElement.classList.remove('barcode-scanner-active');
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo o navegador.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
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
          ? 'Permiso de cámara denegado. Permite el acceso para escanear.'
          : 'Cámara no accesible en este entorno. Puedes ingresar o simular el código abajo.'
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
      stream.getTracks().forEach((track) => track.stop());
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

  const handleBarcodeFound = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || trimmed === lastScanned) return;

    setLastScanned(trimmed);
    Sound.playScanBeep();

    const lookup = StorageService.findProductByBarcode(trimmed);
    const matchedProduct = lookup?.product;
    const matchType = lookup?.matchType || (scanTarget ? scanTarget : 'unit');

    setDetectedInfo({ product: matchedProduct, matchType });

    setTimeout(() => {
      onBarcodeDetected(trimmed, matchedProduct, matchType);
    }, 450);
  };

  // MLKit native barcode detector when available in Android WebView/Chromium
  const startDetectionLoop = () => {
    setScanningActive(true);

    let barcodeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e'],
        });
      } catch {
        barcodeDetector = null;
      }
    }

    const checkFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(checkFrame);
        return;
      }

      if (barcodeDetector) {
        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              handleBarcodeFound(rawValue);
              return;
            }
          }
        } catch {
          // ignore detection frame drops
        }
      }

      scanLoopRef.current = requestAnimationFrame(checkFrame);
    };

    scanLoopRef.current = requestAnimationFrame(checkFrame);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleBarcodeFound(manualCode.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="barcode-scanner-modal"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4"
    >
      <div className="relative w-full max-w-md bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#12141c]">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                scanTarget === 'bulk'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-teal-500/20 text-teal-400'
              }`}
            >
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-white">Escáner MLKit</h2>
                {scanTarget && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      scanTarget === 'bulk'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    }`}
                  >
                    {scanTarget === 'bulk' ? 'Bulto / Pack' : 'Unidad'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                {scanTarget === 'bulk'
                  ? 'Apunta la cámara al código de barra del BULTO o CAJA'
                  : 'Detecta automáticamente unidades o bultos/cajas'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              id="scanner-torch-btn"
              onClick={toggleTorch}
              className={`p-2 rounded-xl border transition-colors ${
                torchOn
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
              }`}
              title="Linterna / Flash"
            >
              <Flashlight className="w-4 h-4" />
            </button>
            <button
              id="close-scanner-btn"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewfinder */}
        <div className="relative bg-black h-64 sm:h-72 w-full overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Scanner Overlay Laser & Frame */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            <div
              className={`relative w-64 h-40 border-2 rounded-xl overflow-hidden ${
                scanTarget === 'bulk'
                  ? 'border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                  : 'border-teal-500/60 shadow-[0_0_20px_rgba(20,184,166,0.3)]'
              }`}
            >
              {/* Corner Accents */}
              <div
                className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${
                  scanTarget === 'bulk' ? 'border-amber-400' : 'border-teal-400'
                }`}
              />
              <div
                className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${
                  scanTarget === 'bulk' ? 'border-amber-400' : 'border-teal-400'
                }`}
              />
              <div
                className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${
                  scanTarget === 'bulk' ? 'border-amber-400' : 'border-teal-400'
                }`}
              />
              <div
                className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${
                  scanTarget === 'bulk' ? 'border-amber-400' : 'border-teal-400'
                }`}
              />

              {/* Laser Animation Bar */}
              <div
                className={`w-full h-0.5 absolute top-0 animate-[scanLaser_2.2s_ease-in-out_infinite] ${
                  scanTarget === 'bulk'
                    ? 'bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#fbbf24]'
                    : 'bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_8px_#2dd4bf]'
                }`}
              />
            </div>
            <p className="text-[11px] text-zinc-300 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full mt-3 font-medium border border-white/10">
              {scanTarget === 'bulk' ? '📦 Enfoca el código del BULTO / CAJA' : '🏷️ Apunta al código de la unidad o bulto'}
            </p>
          </div>

          {/* Camera Error / Fallback info */}
          {cameraError && (
            <div className="absolute inset-0 bg-[#0e1017]/95 flex flex-col items-center justify-center p-6 text-center z-10">
              <Camera className="w-10 h-10 text-zinc-500 mb-2" />
              <p className="text-xs text-zinc-300 font-medium mb-1">{cameraError}</p>
              <p className="text-[11px] text-zinc-500 mb-3">
                Usa el teclado o los botones de prueba abajo
              </p>
              <button
                onClick={startCamera}
                className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-teal-500/30"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar Cámara</span>
              </button>
            </div>
          )}

          {/* Barcode Detected Toast */}
          {lastScanned && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 z-20 animate-fade-in text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2 animate-bounce" />
              <p className="text-sm font-bold text-white">¡Código Detectado!</p>
              <p className="text-xs text-emerald-300 font-mono mt-0.5">{lastScanned}</p>
              {detectedInfo?.product && (
                <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-[#161922] border border-white/10 text-xs">
                  <p className="font-semibold text-white">{detectedInfo.product.name}</p>
                  <p
                    className={`text-[11px] font-bold mt-0.5 ${
                      detectedInfo.matchType === 'bulk' ? 'text-amber-400' : 'text-teal-400'
                    }`}
                  >
                    {detectedInfo.matchType === 'bulk'
                      ? `📦 Bulto / Pack: ${detectedInfo.product.bulkUnitName || 'Caja'} (${detectedInfo.product.unitsPerBulk} uds)`
                      : '🏷️ Unidad Individual (1 ud)'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual Input Form & Quick Demo */}
        <div className="p-4 bg-[#161922] space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="manual-barcode-input"
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Escribe o pega código de unidad o bulto..."
                className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <button
              id="submit-manual-barcode-btn"
              type="submit"
              disabled={!manualCode.trim()}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:opacity-40 text-white font-semibold rounded-xl text-xs flex items-center gap-1 transition-all"
            >
              <span>Buscar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo: Unit vs Bulk test scanning */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] text-zinc-400 font-medium">Probar escaneo por muestra:</p>
              <span className="text-[10px] text-zinc-500">Unidad 🏷️ | Bulto 📦</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {products.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-[#0e1017] border border-white/5 text-[11px]"
                >
                  <span className="text-zinc-200 truncate max-w-[120px] font-medium">{p.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleBarcodeFound(p.barcodeUnit || p.barcode)}
                      className="px-2 py-0.5 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 font-mono text-[10px] border border-teal-500/30 flex items-center gap-1"
                      title="Escanear Código Unidad"
                    >
                      <span>🏷️ Ud</span>
                      <span className="text-zinc-400">({(p.barcodeUnit || p.barcode).slice(-4)})</span>
                    </button>
                    {p.barcodeBulk && (
                      <button
                        type="button"
                        onClick={() => handleBarcodeFound(p.barcodeBulk!)}
                        className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30 flex items-center gap-1"
                        title={`Escanear Código Bulto (${p.bulkUnitName || 'Caja'})`}
                      >
                        <span>📦 Bulto</span>
                        <span className="text-zinc-400">({p.barcodeBulk.slice(-4)})</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
