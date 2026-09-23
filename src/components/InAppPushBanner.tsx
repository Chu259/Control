import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, PackageX, Sparkles, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { InAppNotification, NotificationService } from '../services/pushNotifications';

interface InAppPushBannerProps {
  onNavigateToAlerts?: () => void;
  onNavigateToProduct?: (productId: string) => void;
}

export const InAppPushBanner: React.FC<InAppPushBannerProps> = ({
  onNavigateToAlerts,
  onNavigateToProduct,
}) => {
  const [currentNotification, setCurrentNotification] = useState<InAppNotification | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = NotificationService.subscribe((notification) => {
      setCurrentNotification(notification);
      setIsVisible(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isVisible || !currentNotification) return;

    // Auto dismiss after 6.5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 6500);

    return () => clearTimeout(timer);
  }, [isVisible, currentNotification]);

  if (!isVisible || !currentNotification) {
    return null;
  }

  const handleActionClick = () => {
    if (currentNotification.onAction) {
      currentNotification.onAction();
    } else if (currentNotification.productId && onNavigateToProduct) {
      onNavigateToProduct(currentNotification.productId);
    } else if (onNavigateToAlerts) {
      onNavigateToAlerts();
    }
    setIsVisible(false);
  };

  const getTypeStyles = () => {
    switch (currentNotification.type) {
      case 'critical':
        return {
          border: 'border-rose-500/40',
          bg: 'bg-[#150a0e]/95',
          iconBg: 'bg-rose-500/20 text-rose-400',
          icon: <PackageX className="w-5 h-5 text-rose-400" />,
          accent: 'text-rose-400',
          btnBg: 'bg-rose-500 hover:bg-rose-400 text-white',
        };
      case 'info':
        return {
          border: 'border-sky-500/40',
          bg: 'bg-[#0a121a]/95',
          iconBg: 'bg-sky-500/20 text-sky-400',
          icon: <Sparkles className="w-5 h-5 text-sky-400" />,
          accent: 'text-sky-400',
          btnBg: 'bg-sky-500 hover:bg-sky-400 text-white',
        };
      case 'success':
        return {
          border: 'border-emerald-500/40',
          bg: 'bg-[#0a1811]/95',
          iconBg: 'bg-emerald-500/20 text-emerald-400',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          accent: 'text-emerald-400',
          btnBg: 'bg-emerald-500 hover:bg-emerald-400 text-black',
        };
      case 'warning':
      default:
        return {
          border: 'border-amber-500/40',
          bg: 'bg-[#18130b]/95',
          iconBg: 'bg-amber-500/20 text-amber-400',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          accent: 'text-amber-400',
          btnBg: 'bg-amber-500 hover:bg-amber-400 text-black',
        };
    }
  };

  const style = getTypeStyles();

  return (
    <div
      id="in-app-push-banner"
      className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:max-w-md z-50 transition-all duration-300 transform translate-y-0"
    >
      <div
        className={`p-3.5 rounded-2xl border ${style.border} ${style.bg} backdrop-blur-md shadow-2xl flex flex-col gap-2.5 text-white`}
      >
        {/* Header line: App name + time + close */}
        <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">🔔</span>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Notificación Push • Ahora
            </span>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.iconBg} shadow-sm`}
          >
            {style.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white leading-tight mb-0.5">
              {currentNotification.title}
            </h4>
            <p className="text-[11.5px] text-zinc-300 leading-snug line-clamp-2">
              {currentNotification.body}
            </p>
          </div>
        </div>

        {/* Action button if available */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={() => setIsVisible(false)}
            className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white font-medium transition-colors"
          >
            Descartar
          </button>
          <button
            onClick={handleActionClick}
            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95 ${style.btnBg}`}
          >
            <span>{currentNotification.actionLabel || 'Ver Detalle'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
