import { ExpirationItem, Product } from '../types';
import { Sound } from './sound';
import { CloudBackupService } from './cloudBackupService';

const STORAGE_KEY = 'depos_expiration_agenda';

export const ExpirationService = {
  getExpirations(): ExpirationItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error('Error reading expiration agenda:', e);
      return [];
    }
  },

  saveExpirations(items: ExpirationItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('expirations_updated', { detail: items }));
      }
    } catch (e) {
      console.error('Error saving expiration agenda:', e);
    }
  },

  addExpiration(params: {
    product: Product;
    expirationDate: string; // YYYY-MM-DD
    notes?: string;
  }): ExpirationItem {
    const list = this.getExpirations();
    const cleanDate = params.expirationDate.trim();

    // Check if an active item for same product and same expiration date exists
    const existingIndex = list.findIndex(
      (item) => item.productId === params.product.id && item.expirationDate === cleanDate && item.status === 'pending'
    );

    let targetItem: ExpirationItem;
    if (existingIndex >= 0) {
      targetItem = {
        ...list[existingIndex],
        productName: params.product.name,
        barcode: params.product.barcodeUnit || params.product.barcode,
        notes: params.notes || list[existingIndex].notes,
      };
      list[existingIndex] = targetItem;
    } else {
      targetItem = {
        id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: params.product.id,
        productName: params.product.name,
        barcode: params.product.barcodeUnit || params.product.barcode,
        expirationDate: cleanDate,
        aisleName: params.product.category,
        status: 'pending',
        registeredAt: new Date().toISOString(),
        notes: params.notes || 'Control fin de mes',
      };
      list.unshift(targetItem);
    }

    this.saveExpirations(list);
    Sound.playSuccessChime();

    // Invisible Cloud Backup trigger
    CloudBackupService.triggerAutoBackup();

    return targetItem;
  },

  resolveExpiration(id: string, notes?: string): ExpirationItem | null {
    const list = this.getExpirations();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: ExpirationItem = {
      ...list[index],
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      notes: notes || list[index].notes || 'Producto Retirado / Góndola Verificada',
    };

    list[index] = updated;
    this.saveExpirations(list);
    Sound.playSuccessChime();

    // Invisible Cloud Backup trigger
    CloudBackupService.triggerAutoBackup();

    return updated;
  },

  deleteExpiration(id: string): void {
    const list = this.getExpirations().filter((item) => item.id !== id);
    this.saveExpirations(list);
    CloudBackupService.triggerAutoBackup();
  },

  /**
   * Evaluates active expirations against local device clock for strict daily alarm schedule:
   * - 10:00 a. m. Morning Alert ("⚠️ ALERTA DE VENCIMIENTO HOY: [Producto] vence hoy. Retirar o poner en oferta")
   * - 20:00 hs Closing Alert (Screen-blocking required confirmation "✔ Producto Retirado / Góndola Verificada")
   */
  checkStrictAlarms(): {
    todayDueItems: ExpirationItem[];
    isMorningActive: boolean;
    isClosingActive: boolean;
    todayStr: string;
  } {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const hours = now.getHours();

    // Products that expire today (or expired before today and remain unresolved)
    const list = this.getExpirations();
    const todayDueItems = list.filter(
      (item) => item.status === 'pending' && item.expirationDate <= todayStr
    );

    const hasDue = todayDueItems.length > 0;
    // Morning control: active from 10:00 AM until 19:59
    const isMorningActive = hasDue && hours >= 10 && hours < 20;
    // Closing control: active from 20:00 hs onwards
    const isClosingActive = hasDue && hours >= 20;

    return {
      todayDueItems,
      isMorningActive,
      isClosingActive,
      todayStr,
    };
  },
};
