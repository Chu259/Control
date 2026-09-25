import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  Flashlight,
  RefreshCw,
  Barcode as BarcodeIcon,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { Product } from '../types';
import { Sound } from '../services/sound';
import { StorageService } from '../services/storage';

// Explicit MLKit barcode formats matching Android MLKit Barcode.FORMAT_*
export const Barcode = {
  FORMAT_ITF: 'itf',
  FORMAT_EAN_13: 'ean_13',
  FORMAT_CODE_128: 'code_128',
  FORMAT_UPC_A: 'upc_a',
  FORMAT_EAN_8: 'ean_8',
  FORMAT_UPC_E: 'upc_e',
  FORMAT_QR_CODE: 'qr_code',
} as const;

export interface BarcodeScannerOptions {
  formats: string[];
}

// Strict checksum and sanity validator for commercial barcodes
export function validateBarcodeSanity(code: string): { valid: boolean; format: string; error?: string } {
  const clean = code.trim();
  if (!clean || clean.length < 4) {
    return { valid: false, format: 'unknown', error: 'Código demasiado corto o incompleto' };
  }

  // 1. ITF-14 (14 digits) standard for boxes/bulks (e.g. Cañuelas, Natura, sopas)
  if (/^\d{14}$/.test(clean)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      const digit = parseInt(clean[i], 10);
      const weight = i % 2 === 0 ? 3 : 1;
      sum += digit * weight;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const providedCheck = parseInt(clean[13], 10);
    if (checkDigit !== providedCheck) {
      return { valid: false, format: 'ITF-14', error: `Dígito verificador inválido en ITF-14 (calculado ${checkDigit}, leído ${providedCheck})` };
    }
    return { valid: true, format: 'ITF-14' };
  }

  // 2. EAN-13 (13 digits)
  if (/^\d{13}$/.test(clean)) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(clean[i], 10);
      const weight = i % 2 === 0 ? 1 : 3;
      sum += digit * weight;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const providedCheck = parseInt(clean[12], 10);
    if (checkDigit !== providedCheck) {
      return { valid: false, format: 'EAN-13', error: `Dígito verificador inválido en EAN-13 (calculado ${checkDigit}, leído ${providedCheck})` };
    }
    return { valid: true, format: 'EAN-13' };
  }

  // 3. UPC-A (12 digits)
  if (/^\d{12}$/.test(clean)) {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(clean[i], 10);
      const weight = i % 2 === 0 ? 3 : 1;
      sum += digit * weight;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const providedCheck = parseInt(clean[11], 10);
    if (checkDigit !== providedCheck) {
      return { valid: false, format: 'UPC-A', error: `Dígito verificador inválido en UPC-A (calculado ${checkDigit}, leído ${providedCheck})` };
    }
    return { valid: true, format: 'UPC-A' };
  }

  // 4. EAN-8 (8 digits)
  if (/^\d{8}$/.test(clean)) {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(clean[i], 10);
      const weight = i % 2 === 0 ? 3 : 1;
      sum += digit * weight;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const providedCheck = parseInt(clean[7], 10);
    if (checkDigit !== providedCheck) {
      return { valid: false, format: 'EAN-8', error: `Dígito verificador inválido en EAN-8` };
    }
    return { valid: true, format: 'EAN-8' };
  }

  // 5. Code 128 (alphanumeric logistics barcodes)
  if (/^[A-Za-z0-9\-_./]{4,40}$/.test(clean)) {
    return { valid: true, format: 'CODE-128' };
  }

  return { valid: false, format: 'unknown', error: 'Formato o caracteres no válidos para código comercial' };
}

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [highContrastFilter, setHighContrastFilter] = useState(false);
  const scanLoopRef = useRef<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [analyzingGallery, setAnalyzingGallery] = useState(false);
  const barcodeDetectorRef = useRef<any>(null);
  const isProcessingRef = useRef(false);

  // Returns or instantiates MLKit BarcodeDetector configured with all bulk & unit formats
  const getBarcodeDetector = () => {
    if (barcodeDetectorRef.current) return barcodeDetectorRef.current;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const options: BarcodeScannerOptions = {
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
        barcodeDetectorRef.current = new window.BarcodeDetector(options);
      } catch (err) {
        console.warn('BarcodeDetector initialization fallback:', err);
        barcodeDetectorRef.current = null;
      }
    }
    return barcodeDetectorRef.current;
  };

  useEffect(() => {
    if (isOpen) {
      isProcessingRef.current = false;
      document.body.classList.add('barcode-scanner-active');
      document.documentElement.classList.add('barcode-scanner-active');
      startCamera();
    } else {
      isProcessingRef.current = false;
      document.body.classList.remove('barcode-scanner-active');
      document.documentElement.classList.remove('barcode-scanner-active');
      stopCamera();
      setLastScanned(null);
      setDetectedInfo(null);
      setScanWarning(null);
      setManualCode('');
    }
    return () => {
      document.body.classList.remove('barcode-scanner-active');
      document.documentElement.classList.remove('barcode-scanner-active');
      stopCamera();
    };
  }, [isOpen]);

  // High resolution mode (1080p Full HD) + continuous autofocus and exposure
  const startCamera = async () => {
    setCameraError(null);
    setScanWarning(null);
    isProcessingRef.current = false;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo o navegador.');
      }

      // Configure high resolution and continuous autofocus constraints
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

      // Force continuous autofocus, continuous exposure
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
          if (capabilities.whiteBalanceMode && Array.isArray(capabilities.whiteBalanceMode) && capabilities.whiteBalanceMode.includes('continuous')) {
            advanced.whiteBalanceMode = 'continuous';
          }
          if (Object.keys(advanced).length > 0) {
            await (track as any).applyConstraints({ advanced: [advanced] });
          }
        } catch (e) {
          console.warn('Could not apply continuous autofocus constraints:', e);
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

  // Same smooth, direct barcode processing logic for both Unit and Bulk
  const handleBarcodeFound = (code: string): boolean => {
    const trimmed = code.trim();
    if (!trimmed || isProcessingRef.current || trimmed === lastScanned) return false;

    if (trimmed.length < 3) return false;

    isProcessingRef.current = true;
    setScanWarning(null);
    setLastScanned(trimmed);
    Sound.playScanBeep();

    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }

    const lookup = StorageService.findProductByBarcode(trimmed);
    const matchedProduct = lookup?.product;
    // Target variable: bulk or unit as chosen by the user
    const matchType = scanTarget || (lookup?.matchType || 'unit');

    setDetectedInfo({ product: matchedProduct, matchType });

    setTimeout(() => {
      onBarcodeDetected(trimmed, matchedProduct, matchType);
      isProcessingRef.current = false;
    }, 450);

    return true;
  };

  // Exact same high-performance, non-blocking MLKit engine for BOTH units and bulks
  const startDetectionLoop = () => {
    const barcodeDetector = getBarcodeDetector();

    const checkFrame = async () => {
      if (isProcessingRef.current) return;

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
              const handled = handleBarcodeFound(rawValue);
              if (handled) {
                return; // Stop animation loop cleanly on successful read
              }
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

  // Helper for gallery photos: enhances contrast on green/cardboard packaging
  const processCardboardGreenContrast = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        let val = r * 1.4 - g * 0.4;
        if (val < 90) {
          val = 0;
        } else if (val > 150) {
          val = 255;
        } else {
          val = (val - 90) * (255 / 60);
        }
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {}
  };

  // Open native mobile photo gallery
  const handleOpenGallery = () => {
    setScanWarning(null);
    galleryInputRef.current?.click();
  };

  // Scan barcode directly from selected gallery photo / screenshot using MLKit
  const handleGalleryImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzingGallery(true);
    setScanWarning(null);

    try {
      const reader = new FileReader();
      reader.onload = async (readerEvent) => {
        const dataUrl = readerEvent.target?.result as string;
        if (!dataUrl) {
          setAnalyzingGallery(false);
          setScanWarning('No se pudo leer la foto seleccionada.');
          return;
        }

        const img = new window.Image();
        img.onload = async () => {
          try {
            const detector = getBarcodeDetector();
            let rawCode: string | null = null;

            if (detector) {
              // 1. Direct detection on the full image element
              try {
                const barcodes = await detector.detect(img);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  rawCode = barcodes[0].rawValue;
                }
              } catch (err) {
                console.warn('Direct detect error on image, trying canvas:', err);
              }

              // 2. If nothing detected, render to canvas (handles EXIF, high resolution, contrast enhancement)
              if (!rawCode) {
                const canvas = document.createElement('canvas');
                const maxDim = 1920;
                let w = img.naturalWidth || img.width;
                let h = img.naturalHeight || img.height;
                if (w > maxDim || h > maxDim) {
                  if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                  } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                  }
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(img, 0, 0, w, h);
                  // Normal canvas detect
                  try {
                    const cBarcodes = await detector.detect(canvas);
                    if (cBarcodes && cBarcodes.length > 0 && cBarcodes[0].rawValue) {
                      rawCode = cBarcodes[0].rawValue;
                    }
                  } catch {}

                  // High-contrast / green-on-cardboard filter
                  if (!rawCode) {
                    processCardboardGreenContrast(ctx, w, h);
                    try {
                      const contrastBarcodes = await detector.detect(canvas);
                      if (contrastBarcodes && contrastBarcodes.length > 0 && contrastBarcodes[0].rawValue) {
                        rawCode = contrastBarcodes[0].rawValue;
                      }
                    } catch {}
                  }
                }
              }
            }

            if (rawCode) {
              setAnalyzingGallery(false);
              handleBarcodeFound(rawCode);
            } else {
              setAnalyzingGallery(false);
              setScanWarning(
                'No se detectó ningún código de barras en la foto o captura. Asegúrate de que las barras estén nítidas y completas.'
              );
              Sound.playWarningBeep();
            }
          } catch (err: any) {
            setAnalyzingGallery(false);
            setScanWarning('Error al procesar la foto con MLKit: ' + (err?.message || 'Error desconocido'));
          } finally {
            if (galleryInputRef.current) galleryInputRef.current.value = '';
          }
        };

        img.onerror = () => {
          setAnalyzingGallery(false);
          setScanWarning('No se pudo cargar la imagen seleccionada desde la galería.');
          if (galleryInputRef.current) galleryInputRef.current.value = '';
        };

        img.src = dataUrl;
      };

      reader.onerror = () => {
        setAnalyzingGallery(false);
        setScanWarning('Error al leer el archivo de la galería.');
        if (galleryInputRef.current) galleryInputRef.current.value = '';
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setAnalyzingGallery(false);
      setScanWarning('Error al abrir la foto: ' + (err?.message || 'Error desconocido'));
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleBarcodeFound(manualCode.trim());
    }
  };

  const handleRetryScan = () => {
    isProcessingRef.current = false;
    setScanWarning(null);
    setLastScanned(null);
    startDetectionLoop();
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
            {/* Hidden file input for native image/screenshot selection */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryImageSelected}
            />

            <button
              id="scanner-gallery-btn"
              type="button"
              onClick={handleOpenGallery}
              disabled={analyzingGallery}
              className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1.5"
              title="Abrir Galería de Fotos / Capturas"
            >
              {analyzingGallery ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline text-xs font-semibold">Galería</span>
            </button>

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

          {/* Gallery Image Analyzing Spinner */}
          {analyzingGallery && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-40 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center mb-2.5">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
              </div>
              <p className="text-sm font-bold text-white mb-0.5">Analizando Imagen...</p>
              <p className="text-xs text-zinc-400">Leyendo códigos de barra con motor MLKit</p>
            </div>
          )}

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
            
            <div className="flex items-center gap-2 mt-3 pointer-events-auto">
              <p className="text-[11px] text-zinc-300 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full font-medium border border-white/10">
                {scanTarget === 'bulk' ? '📦 Enfoca el código del BULTO / CAJA' : '🏷️ Apunta al código de la unidad o bulto'}
              </p>
              <button
                type="button"
                id="viewfinder-gallery-btn"
                onClick={handleOpenGallery}
                disabled={analyzingGallery}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 backdrop-blur-md border border-teal-500/40 text-[11px] font-semibold transition-all active:scale-95 shadow-md"
                title="Escanear desde foto o captura en galería"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Galería</span>
              </button>
            </div>
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

          {/* Damaged or Unclear Barcode Warning Modal overlay */}
          {scanWarning && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-30 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-2.5 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white mb-1">Código Dañado o No Claro</p>
              <p className="text-xs text-amber-300 max-w-xs mb-3 px-2 leading-relaxed">
                {scanWarning}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetryScan}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-escanear Código</span>
                </button>
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 text-zinc-300 font-semibold rounded-xl text-xs flex items-center gap-1 transition-colors border border-white/10"
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  <span>{torchOn ? 'Apagar Luz' : 'Encender Luz'}</span>
                </button>
              </div>
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

        {/* Gallery Barcode Scan Action Bar */}
        <div className="px-4 py-2.5 bg-[#12141c] border-b border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <ImageIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] text-zinc-300">¿Tienes una foto o captura?</span>
          </div>
          <button
            type="button"
            id="bar-gallery-scan-btn"
            onClick={handleOpenGallery}
            disabled={analyzingGallery}
            className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
          >
            {analyzingGallery ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span>Escanear desde Galería</span>
          </button>
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
