import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Flashlight,
  RefreshCw,
  X,
  Zap,
  CheckCircle2,
  Share2,
  Trash2,
  Plus,
  Barcode as BarcodeIcon,
  Sparkles,
  Download,
  Copy,
  Check,
  Package,
  Layers,
  ArrowRight,
  ExternalLink,
  Save,
  Image as ImageIcon,
} from 'lucide-react';
import {
  CatalogAssistantService,
  AssistantItem,
} from '../services/catalogAssistantService';
import { Sound } from '../services/sound';

interface CatalogAssistantViewProps {
  onSwitchToMainApp?: () => void;
}

export const CatalogAssistantView: React.FC<CatalogAssistantViewProps> = ({
  onSwitchToMainApp,
}) => {
  const [items, setItems] = useState<AssistantItem[]>(() =>
    CatalogAssistantService.getItems()
  );
  const [isBurstActive, setIsBurstActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [batchCodesInput, setBatchCodesInput] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Camera states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const scanLoopRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const lastScannedTimeRef = useRef<{ [code: string]: number }>({});

  // Sync items when service updates in background
  useEffect(() => {
    const handleUpdate = () => {
      setItems(CatalogAssistantService.getItems());
    };
    window.addEventListener('catalog_assistant_updated', handleUpdate);
    return () => {
      window.removeEventListener('catalog_assistant_updated', handleUpdate);
    };
  }, []);

  // Barcode detector
  const getBarcodeDetector = () => {
    if (barcodeDetectorRef.current) return barcodeDetectorRef.current;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const options = {
          formats: ['ean_13', 'upc_a', 'ean_8', 'code_128', 'itf'],
        };
        barcodeDetectorRef.current = new (window as any).BarcodeDetector(options);
      } catch (err) {
        console.warn('BarcodeDetector fallback:', err);
      }
    }
    return barcodeDetectorRef.current;
  };

  // Camera lifecycle: start when isBurstActive, stop when not
  useEffect(() => {
    if (isBurstActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isBurstActive, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Cámara no soportada en este dispositivo');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        startBurstScanLoop();
      }
    } catch (err: any) {
      console.warn('Burst camera start error:', err);
      setCameraError('No se pudo acceder a la cámara. Puedes ingresar códigos manualmente.');
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

  const startBurstScanLoop = () => {
    const detector = getBarcodeDetector();
    if (!detector) return;

    let lastScanTime = 0;
    const scanFrame = async (timestamp: number) => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Check every 120ms for ultra rapid burst detection
      if (timestamp - lastScanTime > 120) {
        lastScanTime = timestamp;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            for (const b of barcodes) {
              const rawVal = b.rawValue || '';
              const clean = rawVal.trim().replace(/[^0-9]/g, '');
              if (clean.length >= 8) {
                const now = Date.now();
                const lastTime = lastScannedTimeRef.current[clean] || 0;
                // Cooldown of 2 seconds per identical barcode to prevent double counting in burst mode
                if (now - lastTime > 2000) {
                  lastScannedTimeRef.current[clean] = now;
                  Sound.playScanBeep();
                  setLastScannedCode(clean);
                  await CatalogAssistantService.addBarcode(clean);
                  setItems(CatalogAssistantService.getItems());
                }
              }
            }
          }
        } catch {
          // Frame drop safe
        }
      }

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    };

    scanLoopRef.current = requestAnimationFrame(scanFrame);
  };

  const handleAddManualCode = async () => {
    const clean = manualCode.trim().replace(/[^0-9]/g, '');
    if (!clean) return;
    Sound.playScanBeep();
    await CatalogAssistantService.addBarcode(clean);
    setItems(CatalogAssistantService.getItems());
    setManualCode('');
  };

  const handleBatchCodesSubmit = async () => {
    const lines = batchCodesInput.split(/[\n,;]+/);
    const validCodes = lines.map((l) => l.trim().replace(/[^0-9]/g, '')).filter((c) => c.length >= 8);
    if (validCodes.length > 0) {
      Sound.playScanBeep();
      await CatalogAssistantService.addBurstCodes(validCodes);
      setItems(CatalogAssistantService.getItems());
    }
    setBatchCodesInput('');
    setShowBatchModal(false);
  };

  const handleApprove = async (id: string) => {
    Sound.playScanBeep();
    await CatalogAssistantService.approveItem(id);
    setItems(CatalogAssistantService.getItems());
  };

  const handleSelectImage = (id: string, idx: 0 | 1) => {
    CatalogAssistantService.selectImage(id, idx);
    setItems(CatalogAssistantService.getItems());
  };

  const handleSaveNameEdit = (id: string) => {
    if (editNameText.trim()) {
      CatalogAssistantService.updateName(id, editNameText.trim());
      setItems(CatalogAssistantService.getItems());
    }
    setEditingItemId(null);
  };

  const handleDelete = (id: string) => {
    CatalogAssistantService.deleteItem(id);
    setItems(CatalogAssistantService.getItems());
  };

  const handleClearAll = () => {
    if (window.confirm('¿Deseas vaciar la cola del asistente de catálogo?')) {
      CatalogAssistantService.clearQueue();
      setItems([]);
    }
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      await CatalogAssistantService.exportLightweightJson();
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyJson = async () => {
    const jsonStr = CatalogAssistantService.getLightweightCatalogJson();
    try {
      await navigator.clipboard.writeText(jsonStr);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    } catch {
      // Fallback
    }
  };

  const approvedCount = items.filter((it) => it.status === 'approved').length;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-zinc-100 font-sans pb-32">
      {/* Top Header - Dark Modern Studio Theme */}
      <header className="sticky top-0 z-30 bg-[#0d1322]/95 backdrop-blur-md border-b border-cyan-500/20 px-4 py-3 shadow-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0d1322] rounded-[10px] flex items-center justify-center text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-wide">
                  depos <span className="text-cyan-400">Asistente</span>
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                  Catálogo
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Escáner en ráfaga • Extractor Google Imágenes • JSON Liviano
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToMainApp && (
              <button
                type="button"
                onClick={onSwitchToMainApp}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all"
                title="Volver a la App Principal"
              >
                <span>depos Principal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Counter & Status Bar */}
        <div className="max-w-4xl mx-auto mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">
              Total códigos: <strong className="text-white">{items.length}</strong>
            </span>
            <span className="text-zinc-400">
              Aprobados: <strong className="text-emerald-400">{approvedCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2"
            >
              + Pegar Lote
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] text-zinc-500 hover:text-rose-400 font-medium ml-2"
              >
                Vaciar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-3 pt-4 space-y-4">
        {/* Module 1: Escáner Masivo en Ráfaga */}
        <section className="bg-[#121829] border border-cyan-500/20 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Escáner Masivo en Ráfaga (MLKit)</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsBurstActive(!isBurstActive)}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                isBurstActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                  : 'bg-gradient-to-r from-cyan-500 to-teal-400 hover:brightness-110 text-black shadow-lg shadow-cyan-500/20'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{isBurstActive ? 'Detener Escáner' : '🚀 Iniciar Ráfaga'}</span>
            </button>
          </div>

          {/* Active Burst Camera Viewport */}
          {isBurstActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black border border-cyan-500/30 aspect-[16/9] shadow-2xl flex items-center justify-center animate-fade-in">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Viewfinder Overlay with Continuous Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-3/5 border-2 border-cyan-400/80 rounded-xl relative shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 -mt-1 -ml-1 border-cyan-400" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 -mt-1 -mr-1 border-cyan-400" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 -mb-1 -ml-1 border-cyan-400" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 -mb-1 -mr-1 border-cyan-400" />
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Top Viewfinder Controls */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto z-10">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-cyan-500/40 text-[11px] text-cyan-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Modo Ráfaga Activo</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                      torchOn
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-black/60 text-white border-white/20'
                    }`}
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFacingMode((p) => (p === 'environment' ? 'user' : 'environment'))}
                    className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBurstActive(false)}
                    className="p-1.5 rounded-full bg-rose-600/90 text-white hover:bg-rose-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Last Scanned Feedback Toast */}
              {lastScannedCode && (
                <div className="absolute bottom-3 inset-x-4 bg-emerald-950/90 border border-emerald-500/50 rounded-xl py-1.5 px-3 backdrop-blur-md flex items-center justify-between text-xs text-emerald-300 font-semibold animate-scale-up">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>¡Código detectado: {lastScannedCode}!</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Buscando imágenes...</span>
                </div>
              )}

              {/* Camera Error Message */}
              {cameraError && (
                <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-4 text-center">
                  <p className="text-xs text-rose-300 mb-2">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => setIsBurstActive(false)}
                    className="px-3 py-1 bg-zinc-800 text-white text-xs rounded-lg"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Manual Single Barcode Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <BarcodeIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Tipear o pegar código de 13 dígitos..."
                className="w-full bg-[#0a0d17] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-cyan-400 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddManualCode();
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleAddManualCode}
              disabled={!manualCode.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black text-xs font-bold transition-all"
            >
              Agregar
            </button>
          </div>
        </section>

        {/* Module 2: Tarjetas de Producto con Extractor de Google Imágenes (Filtro 2 Opciones) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Lista de Extracción de Productos</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-white/5 font-semibold">
                {items.length} {items.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </h2>
          </div>

          {items.length === 0 ? (
            <div className="bg-[#121829]/60 border border-dashed border-white/10 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
                <BarcodeIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Cola de Catálogo Vacía</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Inicia el escáner en ráfaga para disparar lecturas continuas o tipea un código de barras.
                La app extraerá automáticamente las 2 mejores imágenes con fondo blanco comercial.
              </p>
              <button
                type="button"
                onClick={() => setIsBurstActive(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition-all inline-flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                <span>Iniciar Escáner en Ráfaga</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {items.map((item) => {
                const isEditing = editingItemId === item.id;
                const isApproved = item.status === 'approved';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                      isApproved
                        ? 'bg-[#101e1a] border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                        : 'bg-[#121829] border-white/10 hover:border-cyan-500/30 shadow-lg'
                    }`}
                  >
                    {/* Top Bar of Card */}
                    <div className="p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-lg">
                          EAN: {item.barcode}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isApproved ? (
                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Foto Guardada
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full">
                              Pendiente Aprobación
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                            title="Eliminar de la lista"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Commercial Name Field (Editable) */}
                      <div>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editNameText}
                              onChange={(e) => setEditNameText(e.target.value)}
                              className="flex-1 bg-[#0a0d17] border border-cyan-400 text-xs text-white px-2.5 py-1.5 rounded-lg focus:outline-hidden"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNameEdit(item.id)}
                              className="p-1.5 bg-cyan-500 text-black rounded-lg text-xs font-bold"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
                              {item.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemId(item.id);
                                setEditNameText(item.name);
                              }}
                              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 ml-2 flex-shrink-0"
                            >
                              Editar
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Extractor de Google Imágenes: Strictly Top 2 Commercial Options on White Background */}
                      <div className="pt-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Imágenes Comerciales (2 Opciones Fondo Blanco)</span>
                          </label>
                          {item.isLoadingImages && (
                            <span className="text-[10px] text-cyan-400 animate-pulse font-medium">
                              Extrayendo...
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Option 1: Frente Neto Comercial */}
                          <div
                            onClick={() => handleSelectImage(item.id, 0)}
                            className={`cursor-pointer rounded-xl p-2 transition-all relative flex flex-col items-center justify-center bg-white border-2 ${
                              item.selectedImageIndex === 0
                                ? 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                                : 'border-zinc-300 hover:border-zinc-400 opacity-80'
                            }`}
                          >
                            <div className="w-full h-28 flex items-center justify-center overflow-hidden">
                              <img
                                src={item.images[0]}
                                alt="Opción 1 Frente"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="mt-1 flex items-center justify-between w-full pt-1 border-t border-zinc-200 text-[10px]">
                              <span className="font-bold text-zinc-700">Opción 1: Frente</span>
                              {item.selectedImageIndex === 0 && (
                                <span className="bg-cyan-600 text-white font-extrabold px-1.5 py-0.2 rounded-full text-[9px] flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Elegida
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Option 2: Packaging Comercial / Perspectiva */}
                          <div
                            onClick={() => handleSelectImage(item.id, 1)}
                            className={`cursor-pointer rounded-xl p-2 transition-all relative flex flex-col items-center justify-center bg-white border-2 ${
                              item.selectedImageIndex === 1
                                ? 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                                : 'border-zinc-300 hover:border-zinc-400 opacity-80'
                            }`}
                          >
                            <div className="w-full h-28 flex items-center justify-center overflow-hidden">
                              <img
                                src={item.images[1]}
                                alt="Opción 2 Packaging"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="mt-1 flex items-center justify-between w-full pt-1 border-t border-zinc-200 text-[10px]">
                              <span className="font-bold text-zinc-700">Opción 2: Pack</span>
                              {item.selectedImageIndex === 1 && (
                                <span className="bg-cyan-600 text-white font-extrabold px-1.5 py-0.2 rounded-full text-[9px] flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Elegida
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action of Card: Approve and Download Physical JPG strictly to Documents/depos_images/[barcode].jpg */}
                    <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-zinc-400 font-mono truncate">
                        {item.savedImagePath ? item.savedImagePath : `depos_images/${item.barcode}.jpg`}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApprove(item.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all flex-shrink-0 ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-lg shadow-emerald-500/20 hover:brightness-110'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isApproved ? '✔ Re-Guardar Foto' : 'Aprobar y Guardar Foto (.jpg)'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating Bottom Bar: Ultralight JSON Export Actions */}
      <footer className="fixed bottom-0 inset-x-0 bg-[#0d1322]/95 backdrop-blur-md border-t border-cyan-500/30 p-3 z-40 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Exportación JSON Liviana</span>
              <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono px-1.5 rounded">
                Sin Base64
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Solo Nombre Comercial y Código de Barras ({items.length} regs)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJson}
              disabled={items.length === 0}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-semibold text-zinc-200 border border-white/10 flex items-center gap-1.5 transition-all"
              title="Copiar JSON al portapapeles"
            >
              {copiedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedSuccess ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={items.length === 0 || isExporting}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:brightness-110 disabled:opacity-40 text-black font-extrabold text-xs shadow-xl shadow-cyan-500/25 flex items-center gap-2 active:scale-95 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>📤 Exportar Catálogo JSON</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Batch Codes Paste Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#121829] border border-cyan-500/30 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarcodeIcon className="w-4 h-4 text-cyan-400" />
                <span>Pegar Lote de Códigos de Barras</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Pega códigos de barras de 13 dígitos separados por saltos de línea o comas. Se extraerán sus imágenes comerciales en segundo plano.
            </p>

            <textarea
              rows={6}
              value={batchCodesInput}
              onChange={(e) => setBatchCodesInput(e.target.value)}
              placeholder="7790070507273&#10;7790895000997&#10;7791290000160"
              className="w-full bg-[#0a0d17] border border-white/10 rounded-xl p-3 text-xs font-mono text-white placeholder-zinc-600 focus:outline-hidden focus:border-cyan-400"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchCodesSubmit}
                disabled={!batchCodesInput.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black text-xs font-bold"
              >
                Cargar Lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
