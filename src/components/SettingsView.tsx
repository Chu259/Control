import React, { useRef, useState, useEffect } from 'react';
import { Store, ShieldCheck, Download, Upload, RotateCcw, Save, CheckCircle2, Lock, Tag, Plus, Bell, Volume2, AlertTriangle, Send, Sparkles } from 'lucide-react';
import { StoreSettings, Category, Product } from '../types';
import { StorageService } from '../services/storage';
import { NotificationService } from '../services/pushNotifications';

interface SettingsViewProps {
  settings: StoreSettings;
  onUpdateSettings: (settings: StoreSettings) => void;
  onDataReload: () => void;
  categories?: Category[];
  products?: Product[];
  onManageCategories?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onDataReload,
  categories = [],
  products = [],
  onManageCategories,
}) => {
  const [form, setForm] = useState<StoreSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPermissionStatus(NotificationService.getPermission());
  }, []);

  const handleRequestNativePermission = async () => {
    const result = await NotificationService.requestPermission();
    setPermissionStatus(result);
    if (result === 'granted') {
      setTestResult('¡Permiso concedido en el navegador!');
    } else {
      setTestResult('Permiso no concedido. Las notificaciones in-app y sonido seguirán funcionando.');
    }
    setTimeout(() => setTestResult(null), 4000);
  };

  const handleTestPushNotification = async () => {
    setIsTestingPush(true);
    setTestResult(null);
    try {
      const res = await NotificationService.sendTestNotification(form.pushConfig);
      setTestResult(
        res.native
          ? '🔔 Notificación enviada al sistema operativo y en pantalla con sonido.'
          : '🔔 Alerta de prueba enviada con sonido y banner en pantalla.'
      );
    } catch {
      setTestResult('Error enviando notificación de prueba.');
    } finally {
      setIsTestingPush(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const jsonStr = StorageService.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Copia_Seguridad_${settings.storeName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const success = StorageService.importBackup(content);
        if (success) {
          alert('¡Copia de seguridad restaurada con éxito!');
          onDataReload();
        } else {
          alert('Error: el archivo seleccionado no tiene el formato JSON válido.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('¿Restablecer el catálogo a los datos iniciales de demostración? Los cambios actuales se perderán si no hiciste una copia.')) {
      StorageService.resetToInitial();
      onDataReload();
      alert('Catálogo restablecido con éxito.');
    }
  };

  return (
    <div id="settings-view" className="p-4 space-y-5 pb-24 max-w-2xl mx-auto">
      {/* Privacy Notice Banner */}
      <div className="bg-[#121620] border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3 shadow-lg">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-xs">
          <h3 className="text-sm font-bold text-white mb-1">Privacidad Total y Operación Offline</h3>
          <p className="text-zinc-400 leading-relaxed">
            Esta aplicación está diseñada para operar <strong className="text-emerald-300">100% fuera de línea</strong>. Todos tus productos, existencias, códigos de barra y movimientos de stock permanecen seguros en el almacenamiento local de tu dispositivo Android sin transferirse a ningún servidor externo.
          </p>
        </div>
      </div>

      {/* Store Settings Form */}
      <form onSubmit={handleSave} className="bg-[#161922] border border-white/10 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
          <Store className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Configuración del Inventario</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Nombre del Negocio / Depósito</label>
            <input
              id="store-name-input"
              type="text"
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Umbral Stock Bajo Global (Unidades)</label>
            <input
              id="default-min-stock-input"
              type="number"
              min="0"
              value={form.defaultMinStock}
              onChange={(e) => setForm({ ...form, defaultMinStock: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Push Notifications Configuration */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <div>
                <h4 className="text-xs font-bold text-white">Notificaciones Push y Alertas</h4>
                <p className="text-[11px] text-zinc-400">Alertas en tiempo real de stock crítico y reposición</p>
              </div>
            </div>

            {/* Permission Badge */}
            <div className="flex items-center gap-1.5">
              {permissionStatus === 'granted' ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Nativas Activas
                </span>
              ) : permissionStatus === 'denied' ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1" title="El navegador bloquea notificaciones externas; el modo alerta en pantalla con sonido está 100% activo.">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Modo In-App Activo
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestNativePermission}
                  className="px-2 py-0.5 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-bold transition-colors"
                >
                  Activar Permisos SO
                </button>
              )}
            </div>
          </div>

          {/* Master Push Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0e1017] border border-white/5">
            <div>
              <span className="text-xs font-semibold text-white block">Habilitar Alertas Push</span>
              <span className="text-[10px] text-zinc-400">Mostrar banners y notificaciones ante eventos de stock</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="push-enabled-toggle"
                type="checkbox"
                checked={form.pushConfig?.enabled ?? true}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pushConfig: {
                      ...(form.pushConfig || {
                        frequency: 'immediate',
                        notifyOnCritical: true,
                        soundEnabled: true,
                        customTitle: '⚠️ Alerta de Stock Bajo',
                        customMessage: 'Hay productos que alcanzaron su nivel crítico de stock.',
                      }),
                      enabled: e.target.checked,
                    },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Sound Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0e1017] border border-white/5">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
              <div>
                <span className="text-xs font-semibold text-white block">Sonido de Notificación</span>
                <span className="text-[10px] text-zinc-400">Emitir timbre audible y vibración al recibir alertas</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="push-sound-toggle"
                type="checkbox"
                checked={form.pushConfig?.soundEnabled ?? true}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pushConfig: {
                      ...(form.pushConfig || {
                        enabled: true,
                        frequency: 'immediate',
                        notifyOnCritical: true,
                        customTitle: '⚠️ Alerta de Stock Bajo',
                        customMessage: 'Hay productos que alcanzaron su nivel crítico de stock.',
                      }),
                      soundEnabled: e.target.checked,
                    },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Critical Only Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0e1017] border border-white/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <div>
                <span className="text-xs font-semibold text-white block">Solo Stock Crítico</span>
                <span className="text-[10px] text-zinc-400">Notificar únicamente si el stock está agotado o ≤ 50% del mínimo</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="push-critical-only-toggle"
                type="checkbox"
                checked={form.pushConfig?.notifyOnCritical ?? false}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pushConfig: {
                      ...(form.pushConfig || {
                        enabled: true,
                        frequency: 'immediate',
                        soundEnabled: true,
                        customTitle: '⚠️ Alerta de Stock Bajo',
                        customMessage: 'Hay productos que alcanzaron su nivel crítico de stock.',
                      }),
                      notifyOnCritical: e.target.checked,
                    },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Custom Title & Message Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Título de la Alerta</label>
              <input
                id="push-title-input"
                type="text"
                value={form.pushConfig?.customTitle || '⚠️ Alerta de Stock Bajo'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pushConfig: {
                      ...(form.pushConfig || {
                        enabled: true,
                        frequency: 'immediate',
                        notifyOnCritical: true,
                        soundEnabled: true,
                        customMessage: 'Hay productos que alcanzaron su nivel crítico de stock.',
                      }),
                      customTitle: e.target.value,
                    },
                  })
                }
                className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Mensaje Base</label>
              <input
                id="push-message-input"
                type="text"
                value={form.pushConfig?.customMessage || 'Reposición urgente requerida'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pushConfig: {
                      ...(form.pushConfig || {
                        enabled: true,
                        frequency: 'immediate',
                        notifyOnCritical: true,
                        soundEnabled: true,
                        customTitle: '⚠️ Alerta de Stock Bajo',
                      }),
                      customMessage: e.target.value,
                    },
                  })
                }
                className="w-full bg-[#0e1017] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Test Push Button */}
          <div className="pt-1 flex flex-col gap-2">
            <button
              id="test-push-btn"
              type="button"
              disabled={isTestingPush}
              onClick={handleTestPushNotification}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTestingPush ? 'Probando Notificación...' : '🔔 Probar Notificación Push Ahora'}</span>
            </button>

            {testResult && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2 animate-fade-in">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{testResult}</span>
              </div>
            )}
          </div>
        </div>

        <button
          id="save-settings-btn"
          type="submit"
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Guardar Configuración</span>
        </button>

        {savedSuccess && (
          <p className="text-xs text-emerald-400 text-center font-medium flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> ¡Ajustes guardados correctamente!
          </p>
        )}
      </form>

      {/* Pasillos y Categorías Management */}
      <div className="bg-[#161922] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Pasillos y Categorías</h3>
              <p className="text-[11px] text-zinc-400">Organiza las secciones de tu góndola o depósito</p>
            </div>
          </div>
          {onManageCategories && (
            <button
              type="button"
              id="settings-manage-categories-btn"
              onClick={onManageCategories}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Administrar</span>
            </button>
          )}
        </div>

        {/* Categories preview chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {categories
            .filter((c) => c.id !== 'all')
            .map((cat) => {
              const pCount = products.filter((p) => p.category === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="px-2.5 py-1 rounded-lg bg-[#0e1017] border border-white/5 flex items-center gap-1.5 text-xs text-zinc-300"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color || '#0ea5e9' }}
                  />
                  <span className="font-medium text-white">{cat.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">({pCount})</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Local Backup & Restore */}
      <div className="bg-[#161922] border border-white/10 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Copias de Seguridad Locales (JSON)</span>
        </h3>
        <p className="text-xs text-zinc-400">
          Exporta una copia de seguridad completa a tu dispositivo para transferirla o resguardarla sin internet.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            id="export-backup-btn"
            onClick={handleExportBackup}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 flex flex-col items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-5 h-5 text-emerald-400" />
            <span>Exportar Copia</span>
          </button>

          <button
            id="import-backup-btn"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 flex flex-col items-center justify-center gap-1.5 transition-colors"
          >
            <Upload className="w-5 h-5 text-indigo-400" />
            <span>Restaurar Copia</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportBackup}
          className="hidden"
        />
      </div>

      {/* Reset catalogue */}
      <div className="pt-2">
        <button
          id="reset-demo-data-btn"
          onClick={handleResetData}
          className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restablecer Catálogo de Muestra</span>
        </button>
      </div>
    </div>
  );
};
