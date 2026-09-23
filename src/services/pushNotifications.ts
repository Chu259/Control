import { PushNotificationConfig, Product } from '../types';
import { Sound } from './sound';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  timestamp: string;
  productId?: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

type NotificationSubscriber = (notification: InAppNotification) => void;

class PushNotificationManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private subscribers: Set<NotificationSubscriber> = new Set();
  private isSwInitializing = false;

  constructor() {
    this.initServiceWorker();
  }

  // Register the service worker for background and PWA push notifications
  async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    if (this.swRegistration) {
      return this.swRegistration;
    }
    if (this.isSwInitializing) {
      return null;
    }

    this.isSwInitializing = true;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = reg;
      console.log('✅ Service Worker para notificaciones push registrado:', reg.scope);
      return reg;
    } catch (err) {
      console.warn('No se pudo registrar Service Worker (modo fallback in-app activado):', err);
      return null;
    } finally {
      this.isSwInitializing = false;
    }
  }

  // Check if browser supports Web Notifications
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  // Get current permission status safely (handles iframe permission-policy errors)
  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    try {
      return Notification.permission;
    } catch {
      return 'denied';
    }
  }

  // Request browser notification permission with fallback
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    try {
      // In some older mobile browsers Notification.requestPermission() takes a callback, in newer it returns a Promise
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        await this.initServiceWorker();
      }
      return result;
    } catch (err) {
      console.warn('Error al solicitar permisos de notificación:', err);
      return 'denied';
    }
  }

  // Subscribe to in-app banner notifications
  subscribe(fn: NotificationSubscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  // Dispatch an in-app banner notification to all active subscribers
  dispatchInApp(notification: InAppNotification): void {
    this.subscribers.forEach((fn) => {
      try {
        fn(notification);
      } catch (err) {
        console.error('Error dispatching notification to subscriber:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app-push-notification', {
          detail: notification,
        })
      );
    }
  }

  /**
   * Send notification:
   * 1. Plays notification chime + vibration if requested.
   * 2. Always triggers in-app banner toast (guaranteeing visibility inside iframe, mobile and desktop).
   * 3. Sends native OS / browser notification via ServiceWorker or Notification constructor when permitted.
   */
  async sendNotification(
    title: string,
    options: {
      body: string;
      icon?: string;
      tag?: string;
      playSound?: boolean;
      type?: 'critical' | 'warning' | 'info' | 'success';
      productId?: string;
      actionLabel?: string;
      onAction?: () => void;
    }
  ): Promise<boolean> {
    const playSound = options.playSound !== false;
    if (playSound) {
      if (options.type === 'critical') {
        Sound.playWarningTone();
      } else {
        Sound.playNotificationChime();
      }
    }

    const inAppItem: InAppNotification = {
      id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body: options.body,
      type: options.type || 'warning',
      timestamp: new Date().toISOString(),
      productId: options.productId,
      icon: options.icon,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    };

    // Always trigger in-app banner so user never misses notifications
    this.dispatchInApp(inAppItem);

    // Attempt Native OS / PWA Web Push notification if permission is granted
    let nativeSent = false;
    if (this.isSupported() && this.getPermission() === 'granted') {
      try {
        const swReg = this.swRegistration || (await this.initServiceWorker());
        const notificationOptions: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
          body: options.body,
          icon: options.icon || '/assets/icon-192.png',
          badge: '/assets/icon-192.png',
          tag: options.tag || `push-${Date.now()}`,
          vibrate: [200, 100, 200],
          renotify: true,
          data: {
            url: '/',
            timestamp: Date.now(),
            productId: options.productId,
          },
        };

        if (swReg && 'showNotification' in swReg) {
          await swReg.showNotification(title, notificationOptions);
          nativeSent = true;
        } else {
          // Fallback to desktop window.Notification constructor
          new Notification(title, notificationOptions);
          nativeSent = true;
        }
      } catch (err) {
        console.warn('No se pudo enviar notificación nativa al SO (mostrada en la aplicación):', err);
      }
    }

    return nativeSent || true;
  }

  // Send a test push notification to immediately verify audio and visual banners
  async sendTestNotification(config?: PushNotificationConfig): Promise<{ native: boolean; inApp: boolean }> {
    const title = config?.customTitle || '🔔 Notificación Push de Prueba';
    const body = config?.customMessage || '¡El sistema de alertas y notificaciones push está funcionando al 100%!';
    const soundEnabled = config?.soundEnabled !== false;

    const nativeSent = await this.sendNotification(title, {
      body,
      playSound: soundEnabled,
      type: 'info',
      tag: 'test-push-notification',
      actionLabel: 'Entendido',
    });

    return { native: nativeSent, inApp: true };
  }

  // Check low stock products and notify
  checkAndNotifyLowStock(
    lowStockProducts: { product: Product; isCritical: boolean }[],
    config: PushNotificationConfig
  ): { notified: boolean; count: number } {
    if (!config || !config.enabled || lowStockProducts.length === 0) {
      return { notified: false, count: 0 };
    }

    const criticalItems = lowStockProducts.filter((p) => p.isCritical);
    const targetItems = config.notifyOnCritical ? criticalItems : lowStockProducts;

    if (targetItems.length === 0) {
      return { notified: false, count: 0 };
    }

    const itemNames = targetItems
      .slice(0, 3)
      .map((item) => `${item.product.name} (${item.product.stock} ${item.product.unit || 'uds'})`)
      .join(', ');
    const moreText = targetItems.length > 3 ? ` y ${targetItems.length - 3} más...` : '';

    const title = config.customTitle || '⚠️ Alerta de Stock Bajo';
    const body = `${config.customMessage || 'Reposición urgente requerida'}: ${itemNames}${moreText}`;

    this.sendNotification(title, {
      body,
      playSound: config.soundEnabled,
      type: criticalItems.length > 0 ? 'critical' : 'warning',
      tag: 'low-stock-summary',
      actionLabel: 'Ver Alertas',
    });

    return { notified: true, count: targetItems.length };
  }

  // Notify when a specific product reaches critical or 0 stock
  notifyStockDepleted(product: Product, isCritical: boolean, config: PushNotificationConfig): void {
    if (!config || !config.enabled) return;
    if (config.notifyOnCritical && !isCritical) return;

    const title = isCritical && product.stock === 0 ? '🚨 ¡STOCK AGOTADO!' : '⚠️ Stock Mínimo Alcanzado';
    const body = `${product.name} tiene solo ${product.stock} ${product.unit || 'uds'} restantes en existencia.`;

    this.sendNotification(title, {
      body,
      playSound: config.soundEnabled,
      type: product.stock === 0 ? 'critical' : 'warning',
      productId: product.id,
      tag: `stock-${product.id}`,
      actionLabel: 'Ver Producto',
    });
  }

  // Notify admins when a sync payload brings new products created by other devices
  notifyNewProductsFromSync(newProductsCount: number, deviceName: string, userName?: string): void {
    const from = userName ? `${userName} (${deviceName})` : deviceName;
    const title = '✨ Nuevos Productos Sincronizados';
    const body = `${from} agregó ${newProductsCount} nuevo(s) producto(s) al catálogo pendientes de revisión.`;

    this.sendNotification(title, {
      body,
      playSound: true,
      type: 'info',
      tag: `sync-new-prods-${Date.now()}`,
      actionLabel: 'Revisar Catálogo',
    });
  }
}

export const NotificationService = new PushNotificationManager();
