import { Product, ShoppingListItem, ReplenishmentItem } from '../types';
import { CloudBackupService } from './cloudBackupService';
import { jsPDF } from 'jspdf';

const SHOPPING_STORAGE_KEY = 'inventario_shopping_list_v1';
const REPLENISHMENT_STORAGE_KEY = 'inventario_replenishment_list_v1';

export const ShoppingService = {
  // Shopping list management
  getShoppingList(): ShoppingListItem[] {
    try {
      const data = localStorage.getItem(SHOPPING_STORAGE_KEY);
      if (!data) return [];
      const parsed: ShoppingListItem[] = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveShoppingList(items: ShoppingListItem[]): void {
    localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(items));
  },

  addToShoppingList(productId: string, customNotes?: string, targetQuantity?: string): ShoppingListItem[] {
    const list = this.getShoppingList();
    const existingIndex = list.findIndex((item) => item.productId === productId);
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        customNotes: customNotes || list[existingIndex].customNotes,
        targetQuantity: targetQuantity || list[existingIndex].targetQuantity,
      };
      this.saveShoppingList(list);
    } else {
      list.push({
        id: `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        customNotes,
        targetQuantity,
        addedAt: new Date().toISOString(),
      });
      this.saveShoppingList(list);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shopping_list_updated', { detail: { list } }));
    }
    return list;
  },

  addOrUpdateShoppingItem(
    productId: string,
    params: {
      totalUnits: number;
      bulks?: number;
      looseUnits?: number;
      customNotes?: string;
    }
  ): { list: ShoppingListItem[]; item: ShoppingListItem } {
    const list = this.getShoppingList();
    const existingIndex = list.findIndex((item) => item.productId === productId);

    const b = params.bulks ?? 0;
    const u = params.looseUnits ?? 0;
    const totalUnits = params.totalUnits;

    let targetQuantityStr = '';
    if (b > 0 && u > 0) {
      targetQuantityStr = `${b} cj y ${u} uds (${totalUnits} uds)`;
    } else if (b > 0) {
      targetQuantityStr = `${b} cj (${totalUnits} uds)`;
    } else {
      targetQuantityStr = `${totalUnits} uds`;
    }

    const noteStr =
      params.customNotes || (b > 0 ? `${b} bultos para proveedor` : `${totalUnits} uds pedidas`);

    let targetItem: ShoppingListItem;
    if (existingIndex >= 0) {
      targetItem = {
        ...list[existingIndex],
        targetQuantity: targetQuantityStr,
        customNotes: noteStr,
      };
      list[existingIndex] = targetItem;
    } else {
      targetItem = {
        id: `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        targetQuantity: targetQuantityStr,
        customNotes: noteStr,
        addedAt: new Date().toISOString(),
      };
      list.unshift(targetItem);
    }

    this.saveShoppingList(list);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('shopping_list_updated', {
          detail: { productId, item: targetItem, list },
        })
      );
    }

    return { list, item: targetItem };
  },

  removeFromShoppingList(productId: string): ShoppingListItem[] {
    const list = this.getShoppingList().filter((item) => item.productId !== productId);
    this.saveShoppingList(list);
    return list;
  },

  updateShoppingItem(productId: string, updates: Partial<ShoppingListItem>): ShoppingListItem[] {
    const list = this.getShoppingList().map((item) => {
      if (item.productId === productId) {
        return { ...item, ...updates };
      }
      return item;
    });
    this.saveShoppingList(list);
    return list;
  },

  clearShoppingList(): void {
    localStorage.removeItem(SHOPPING_STORAGE_KEY);
  },

  // Replenishment list management
  getReplenishmentList(): ReplenishmentItem[] {
    try {
      const data = localStorage.getItem(REPLENISHMENT_STORAGE_KEY);
      if (!data) return [];
      const parsed: ReplenishmentItem[] = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveReplenishmentList(items: ReplenishmentItem[]): void {
    localStorage.setItem(REPLENISHMENT_STORAGE_KEY, JSON.stringify(items));
    CloudBackupService.triggerAutoBackup();
  },

  addToReplenishmentList(
    productId: string,
    locationNotes?: string,
    suggestedUnits?: number,
    bulks?: number,
    units?: number,
    unitsPerBulk: number = 12
  ): ReplenishmentItem[] {
    const list = this.getReplenishmentList();
    const existing = list.find((item) => item.productId === productId);
    const safeBulks = bulks !== undefined ? Math.max(0, Math.floor(bulks)) : 0;
    const safeUnits = units !== undefined ? Math.max(0, Math.floor(units)) : (suggestedUnits ?? 0);
    const totalUnits = (safeBulks * unitsPerBulk) + safeUnits;

    if (!existing) {
      list.push({
        id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        status: 'pending',
        locationNotes,
        bulksPending: safeBulks,
        unitsPending: safeUnits,
        suggestedUnits: totalUnits,
        quantityToAdd: totalUnits,
        addedAt: new Date().toISOString(),
      });
    } else {
      existing.status = 'pending';
      if (bulks !== undefined || units !== undefined) {
        existing.bulksPending = safeBulks;
        existing.unitsPending = safeUnits;
        existing.suggestedUnits = totalUnits;
        existing.quantityToAdd = totalUnits;
      } else if (suggestedUnits !== undefined && suggestedUnits > 0) {
        existing.suggestedUnits = suggestedUnits;
        existing.quantityToAdd = suggestedUnits;
        existing.unitsPending = suggestedUnits;
      }
      if (locationNotes) {
        existing.locationNotes = locationNotes;
      }
    }
    this.saveReplenishmentList(list);
    return list;
  },

  // Set explicit independent breakdown of Bultos and Unidades Sueltas
  setReplenishmentBreakdown(
    productId: string,
    bulksPending: number,
    unitsPending: number,
    unitsPerBulk: number = 12,
    locationNotes?: string
  ): ReplenishmentItem {
    const list = this.getReplenishmentList();
    const existingIndex = list.findIndex((item) => item.productId === productId);
    const safeBulks = Math.max(0, Math.floor(bulksPending));
    const safeUnits = Math.max(0, Math.floor(unitsPending));
    const totalUnits = (safeBulks * unitsPerBulk) + safeUnits;

    let targetItem: ReplenishmentItem;
    if (existingIndex >= 0) {
      targetItem = {
        ...list[existingIndex],
        status: 'pending',
        bulksPending: safeBulks,
        unitsPending: safeUnits,
        suggestedUnits: totalUnits,
        quantityToAdd: totalUnits,
        locationNotes: locationNotes || list[existingIndex].locationNotes || 'Ráfaga Dummies',
      };
      list[existingIndex] = targetItem;
    } else {
      targetItem = {
        id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        status: 'pending',
        locationNotes: locationNotes || 'Ráfaga Dummies',
        bulksPending: safeBulks,
        unitsPending: safeUnits,
        suggestedUnits: totalUnits,
        quantityToAdd: totalUnits,
        addedAt: new Date().toISOString(),
      };
      list.push(targetItem);
    }
    this.saveReplenishmentList(list);
    return targetItem;
  },

  // Cumulative addition for Ráfaga Dummies: updates Bultos and Unidades Sueltas independently
  accumulateReplenishment(
    productId: string,
    mode: 'bulk' | 'unit',
    amount: number = 1,
    locationNotes?: string,
    unitsPerBulk: number = 12
  ): {
    list: ReplenishmentItem[];
    item: ReplenishmentItem;
    bulksPending: number;
    unitsPending: number;
    totalUnits: number;
  } {
    const list = this.getReplenishmentList();
    const existingIndex = list.findIndex((item) => item.productId === productId);
    let bulksPending = 0;
    let unitsPending = 0;
    let targetItem: ReplenishmentItem;

    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      bulksPending = existing.bulksPending ?? 0;
      unitsPending = existing.unitsPending ?? 0;

      if (mode === 'bulk') {
        bulksPending = Math.max(0, bulksPending + amount);
      } else {
        unitsPending = Math.max(0, unitsPending + amount);
      }

      const totalUnits = (bulksPending * unitsPerBulk) + unitsPending;

      targetItem = {
        ...existing,
        status: 'pending',
        bulksPending,
        unitsPending,
        suggestedUnits: totalUnits,
        quantityToAdd: totalUnits,
        locationNotes: locationNotes || existing.locationNotes || 'Ráfaga Dummies',
      };
      list[existingIndex] = targetItem;
    } else {
      if (mode === 'bulk') {
        bulksPending = Math.max(0, amount);
      } else {
        unitsPending = Math.max(0, amount);
      }
      const totalUnits = (bulksPending * unitsPerBulk) + unitsPending;

      targetItem = {
        id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        status: 'pending',
        locationNotes: locationNotes || 'Ráfaga Dummies',
        bulksPending,
        unitsPending,
        suggestedUnits: totalUnits,
        quantityToAdd: totalUnits,
        addedAt: new Date().toISOString(),
      };
      list.push(targetItem);
    }

    this.saveReplenishmentList(list);
    return {
      list,
      item: targetItem,
      bulksPending,
      unitsPending,
      totalUnits: (bulksPending * unitsPerBulk) + unitsPending,
    };
  },

  // Updates independent counters for Bultos and Unidades Sueltas directly
  updateReplenishmentBreakdown(
    productId: string,
    bulksPending: number,
    unitsPending: number,
    unitsPerBulk: number = 12
  ): ReplenishmentItem[] {
    const list = this.getReplenishmentList().map((item) => {
      if (item.productId === productId) {
        const safeBulks = Math.max(0, Math.floor(bulksPending));
        const safeUnits = Math.max(0, Math.floor(unitsPending));
        const totalUnits = (safeBulks * unitsPerBulk) + safeUnits;
        return {
          ...item,
          bulksPending: safeBulks,
          unitsPending: safeUnits,
          suggestedUnits: totalUnits,
          quantityToAdd: totalUnits,
        };
      }
      return item;
    });
    this.saveReplenishmentList(list);
    return list;
  },

  // Cumulative addition for Shopping list in Ráfaga
  accumulateShoppingItem(
    productId: string,
    unitsToAdd: number,
    customNotes?: string
  ): { list: ShoppingListItem[]; item: ShoppingListItem; totalUnits: number; previousUnits: number } {
    const list = this.getShoppingList();
    const existingIndex = list.findIndex((item) => item.productId === productId);
    let totalUnits = unitsToAdd;
    let previousUnits = 0;
    let targetItem: ShoppingListItem;

    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      const match = (existing.targetQuantity || '').match(/\d+/);
      previousUnits = match ? parseInt(match[0], 10) : 0;
      totalUnits = previousUnits + unitsToAdd;
      targetItem = {
        ...existing,
        targetQuantity: `${totalUnits} uds`,
        customNotes: customNotes || existing.customNotes || 'Ingreso Ráfaga',
      };
      list[existingIndex] = targetItem;
    } else {
      targetItem = {
        id: `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        targetQuantity: `${unitsToAdd} uds`,
        customNotes: customNotes || 'Ingreso Ráfaga',
        addedAt: new Date().toISOString(),
      };
      list.push(targetItem);
    }

    this.saveShoppingList(list);
    return { list, item: targetItem, totalUnits, previousUnits };
  },

  toggleReplenishmentStatus(productId: string): ReplenishmentItem[] {
    const list = this.getReplenishmentList().map((item) => {
      if (item.productId === productId) {
        return {
          ...item,
          status: item.status === 'pending' ? 'completed' : 'pending',
        } as ReplenishmentItem;
      }
      return item;
    });
    this.saveReplenishmentList(list);
    return list;
  },

  setReplenishmentStatus(productId: string, status: 'pending' | 'completed'): ReplenishmentItem[] {
    const list = this.getReplenishmentList().map((item) => {
      if (item.productId === productId) {
        return {
          ...item,
          status,
        } as ReplenishmentItem;
      }
      return item;
    });
    this.saveReplenishmentList(list);
    return list;
  },

  updateReplenishmentQuantity(productId: string, quantityToAdd: number): ReplenishmentItem[] {
    const list = this.getReplenishmentList().map((item) => {
      if (item.productId === productId) {
        return {
          ...item,
          quantityToAdd: Math.max(0, quantityToAdd),
        };
      }
      return item;
    });
    this.saveReplenishmentList(list);
    return list;
  },

  updateReplenishmentUnitMode(productId: string, unitMode: 'unit' | 'bulk'): ReplenishmentItem[] {
    const list = this.getReplenishmentList().map((item) => {
      if (item.productId === productId) {
        return {
          ...item,
          unitMode,
        };
      }
      return item;
    });
    this.saveReplenishmentList(list);
    return list;
  },

  removeFromReplenishmentList(productId: string): ReplenishmentItem[] {
    const list = this.getReplenishmentList().filter((item) => item.productId !== productId);
    this.saveReplenishmentList(list);
    return list;
  },

  clearReplenishmentList(): void {
    localStorage.removeItem(REPLENISHMENT_STORAGE_KEY);
  },

  /**
   * Generates a high-resolution, printable JPG canvas of the Shopping List
   * containing product images/icons, barcodes (unit and bulk), current stock,
   * and a prominent empty box for handwriting the quantities to purchase.
   */
  async exportShoppingListToJPG(
    products: Product[],
    items: ShoppingListItem[],
    storeName: string
  ): Promise<string> {
    const matchedProducts = items
      .map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        return prod ? { product: prod, item } : null;
      })
      .filter((x): x is { product: Product; item: ShoppingListItem } => x !== null);

    if (matchedProducts.length === 0) {
      throw new Error('La lista de compras no tiene productos seleccionados.');
    }

    // High resolution width for crisp rendering & printing (1200px)
    const canvasWidth = 1200;
    const headerHeight = 170;
    const rowHeight = 135;
    const footerHeight = 100;
    const canvasHeight = headerHeight + matchedProducts.length * rowHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el contexto de imagen JPG.');
    }

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 1. Header Banner
    ctx.fillStyle = '#0F172A'; // Deep slate
    ctx.fillRect(0, 0, canvasWidth, headerHeight - 15);

    // Accent line
    ctx.fillStyle = '#0EA5E9'; // Sky blue
    ctx.fillRect(0, headerHeight - 15, canvasWidth, 6);

    // Store & Title Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(storeName || 'depos', 45, 58);

    ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('LISTA DE COMPRAS Y PEDIDOS DE MERCADERÍA', 45, 96);

    ctx.font = '16px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94A3B8';
    const dateFormatted = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    ctx.fillText(
      `Fecha de Emisión: ${dateFormatted}  •  Total de Artículos: ${matchedProducts.length}`,
      45,
      132
    );

    // Column Headers
    const tableTop = headerHeight + 5;
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(35, tableTop, canvasWidth - 70, 36);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('FOTO / ICONO', 55, tableTop + 24);
    ctx.fillText('PRODUCTO Y EMPAQUE', 200, tableTop + 24);
    ctx.fillText('CÓDIGOS DE BARRA (UD / BULTO)', 520, tableTop + 24);
    ctx.fillText('STOCK ACTUAL', 810, tableTop + 24);
    ctx.fillText('CANTIDAD A COMPRAR (ANOTAR)', 940, tableTop + 24);

    // Pre-load images safely
    const loadedImages: { [id: string]: HTMLImageElement | null } = {};
    await Promise.all(
      matchedProducts.map(async ({ product }) => {
        if (!product.image) {
          loadedImages[product.id] = null;
          return;
        }
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = product.image;
          await new Promise((res) => {
            img.onload = () => res(true);
            img.onerror = () => res(false);
          });
          loadedImages[product.id] = img;
        } catch {
          loadedImages[product.id] = null;
        }
      })
    );

    // 2. Render Rows
    let currentY = tableTop + 45;

    matchedProducts.forEach(({ product, item }, idx) => {
      // Alternating row background
      if (idx % 2 === 1) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(35, currentY - 5, canvasWidth - 70, rowHeight - 8);
      }

      // Border outline
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(35, currentY - 5, canvasWidth - 70, rowHeight - 8);

      // Col 1: Image / Icon
      const imgX = 55;
      const imgY = currentY + 6;
      const imgSize = 85;

      const loadedImg = loadedImages[product.id];
      if (loadedImg) {
        // Draw rounded photo frame
        ctx.save();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(imgX - 2, imgY - 2, imgSize + 4, imgSize + 4);
        ctx.drawImage(loadedImg, imgX, imgY, imgSize, imgSize);
        ctx.restore();
      } else {
        // Fallback icon placeholder
        ctx.fillStyle = '#F1F5F9';
        ctx.fillRect(imgX, imgY, imgSize, imgSize);
        ctx.strokeStyle = '#CBD5E1';
        ctx.strokeRect(imgX, imgY, imgSize, imgSize);

        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 22px "Segoe UI", Roboto, sans-serif';
        const initials = product.name.slice(0, 2).toUpperCase();
        ctx.fillText(initials, imgX + 28, imgY + 52);
      }

      // Col 2: Name, Category & Packaging presentation
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
      const truncatedName =
        product.name.length > 30 ? product.name.slice(0, 28) + '...' : product.name;
      ctx.fillText(truncatedName, 200, currentY + 30);

      ctx.font = '13px "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText(`Categoría: ${product.category.toUpperCase()}`, 200, currentY + 52);

      const factor = Math.max(1, product.unitsPerBulk || 12);
      const bulkName = product.bulkUnitName || `Caja x${factor}`;
      ctx.fillStyle = '#D97706'; // Amber badge text
      ctx.font = 'bold 13px "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Presentación: ${bulkName} (${factor} uds/bulto)`, 200, currentY + 74);

      if (item.customNotes) {
        ctx.fillStyle = '#0284C7';
        ctx.font = 'italic 12px "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Nota: ${item.customNotes}`, 200, currentY + 94);
      }

      // Col 3: Barcodes (Unit and Bulk)
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillText(`CÓD. UNIDAD:`, 520, currentY + 32);
      ctx.fillStyle = '#0369A1';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(product.barcodeUnit || product.barcode, 520, currentY + 50);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillText(`CÓD. BULTO:`, 520, currentY + 74);
      ctx.fillStyle = '#B45309';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(product.barcodeBulk || '--- Sin código ---', 520, currentY + 92);

      // Col 4: Current stock in store
      ctx.fillStyle = '#334155';
      ctx.font = '13px "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Existencias:', 810, currentY + 32);

      const isLow = product.stock <= (product.minStockAlertUnit ?? product.minStockAlert ?? 5);
      ctx.fillStyle = isLow ? '#DC2626' : '#16A34A';
      ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${product.stock} ${product.unit || 'uds'}`, 810, currentY + 58);

      const currentBulks = Math.floor(product.stock / factor);
      ctx.fillStyle = '#64748B';
      ctx.font = '13px "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`(${currentBulks} bultos cerrados)`, 810, currentY + 80);

      // Col 5: RECUADRO INTERACTIVO / IMPRESO PARA CANTIDADES A COMPRAR
      const boxX = 940;
      const boxY = currentY + 12;
      const boxW = 210;
      const boxH = 80;

      // Outer box
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Line header
      ctx.fillStyle = '#0369A1';
      ctx.font = 'bold 11px "Segoe UI", Roboto, sans-serif';
      ctx.fillText('CANTIDAD A PEDIR:', boxX + 12, boxY + 18);

      const hasBulksVal = typeof item.bulksToBuy === 'number' && !isNaN(item.bulksToBuy);
      const hasUnitsVal = typeof item.unitsToBuy === 'number' && !isNaN(item.unitsToBuy);

      // Cuadro Bultos
      if (hasBulksVal) {
        ctx.fillStyle = '#F0F9FF';
        ctx.fillRect(boxX + 14, boxY + 24, 68, 34);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX + 14, boxY + 24, 68, 34);

        ctx.fillStyle = '#0369A1';
        ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(item.bulksToBuy), boxX + 14 + 34, boxY + 49);
      } else {
        // Recuadro azul punteado totalmente limpio, transparente y en blanco sin textos
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(boxX + 14, boxY + 24, 68, 34);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(boxX + 14, boxY + 24, 68, 34);
        ctx.setLineDash([]);
      }

      // Cuadro Unidades
      if (hasUnitsVal) {
        ctx.fillStyle = '#F0F9FF';
        ctx.fillRect(boxX + 98, boxY + 24, 68, 34);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX + 98, boxY + 24, 68, 34);

        ctx.fillStyle = '#0369A1';
        ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(item.unitsToBuy), boxX + 98 + 34, boxY + 49);
      } else {
        // Recuadro azul punteado totalmente limpio, transparente y en blanco sin textos
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(boxX + 98, boxY + 24, 68, 34);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(boxX + 98, boxY + 24, 68, 34);
        ctx.setLineDash([]);
      }

      // Las palabras BULTOS y UNIDADES debajo del cuadro
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 10px "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BULTOS', boxX + 14 + 34, boxY + 70);
      ctx.fillText('UNIDADES', boxX + 98 + 34, boxY + 70);
      ctx.textAlign = 'start'; // reset alignment

      currentY += rowHeight;
    });

    // 3. Footer
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(35, currentY, canvasWidth - 70, footerHeight - 15);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(35, currentY, canvasWidth - 70, footerHeight - 15);

    ctx.fillStyle = '#475569';
    ctx.font = '13px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(
      'Documento de Compras y Abastecimiento  •  Control Físico de Mercaderías con Doble Código de Barra',
      55,
      currentY + 30
    );

    ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('Firma / Recibido por Proveedor: __________________________    Fecha de Entrega: ____ / ____ / ________', 55, currentY + 60);

    // Convert canvas to JPG
    const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.94);
    return jpgDataUrl;
  },

  /**
   * Generates a crisp, multi-page vector A4 PDF using jsPDF for crystal clear printing
   * and sharing via WhatsApp, Gmail, or print services without quality loss.
   */
  async exportShoppingListToPDF(
    products: Product[],
    items: ShoppingListItem[],
    storeName: string
  ): Promise<string> {
    const matchedProducts = items
      .map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        return prod ? { product: prod, item } : null;
      })
      .filter((x): x is { product: Product; item: ShoppingListItem } => x !== null);

    if (matchedProducts.length === 0) {
      throw new Error('La lista de compras no tiene productos seleccionados.');
    }

    // A4 dimensions in mm: 210 x 297
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const marginX = 10;
    const contentWidth = 190; // 210 - 20

    // Preload product images safely converted to data URLs for jsPDF
    const loadedImageDataUrls: { [id: string]: string | null } = {};
    await Promise.all(
      matchedProducts.map(async ({ product }) => {
        if (!product.image) {
          loadedImageDataUrls[product.id] = null;
          return;
        }
        try {
          if (product.image.startsWith('data:image/')) {
            loadedImageDataUrls[product.id] = product.image;
            return;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = product.image;
          await new Promise((res) => {
            img.onload = () => res(true);
            img.onerror = () => res(false);
          });
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 100;
          c.height = img.naturalHeight || 100;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            loadedImageDataUrls[product.id] = c.toDataURL('image/jpeg', 0.85);
          } else {
            loadedImageDataUrls[product.id] = null;
          }
        } catch {
          loadedImageDataUrls[product.id] = null;
        }
      })
    );

    const itemsPerPageFirst = 9; // Page 1 has large header banner
    const itemsPerPageSubsequent = 10; // Page 2+ has compact header
    const rowHeight = 24.5; // mm per row

    // Calculate total pages
    const totalItems = matchedProducts.length;
    let totalPages = 1;
    if (totalItems > itemsPerPageFirst) {
      const remaining = totalItems - itemsPerPageFirst;
      totalPages = 1 + Math.ceil(remaining / itemsPerPageSubsequent);
    }

    const drawHeader = (pageNumber: number) => {
      if (pageNumber === 1) {
        // Full Header Banner on Page 1
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(marginX, 8, contentWidth, 24, 'F');

        // Sky accent line
        doc.setFillColor(14, 165, 233); // sky-500
        doc.rect(marginX, 32, contentWidth, 1.2, 'F');

        // Store Name
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(storeName || 'depos', marginX + 4, 15);

        // Subtitle
        doc.setTextColor(56, 189, 248); // sky-400
        doc.setFontSize(8.5);
        doc.text('LISTA DE COMPRAS Y PEDIDOS DE MERCADERÍA', marginX + 4, 21);

        // Meta info
        doc.setTextColor(148, 163, 184); // slate-400
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const dateFormatted = new Date().toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        doc.text(
          `Fecha de Emisión: ${dateFormatted}  •  Total: ${matchedProducts.length} artículos  •  Pág. 1 de ${totalPages}`,
          marginX + 4,
          27
        );

        // Table Header
        const tableHeaderY = 35;
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(marginX, tableHeaderY, contentWidth, 7, 'F');
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.rect(marginX, tableHeaderY, contentWidth, 7, 'S');

        doc.setTextColor(51, 65, 85); // slate-700
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('FOTO', marginX + 3, tableHeaderY + 4.8);
        doc.text('PRODUCTO Y EMPAQUE', marginX + 22, tableHeaderY + 4.8);
        doc.text('CÓDIGOS DE BARRA (UD / BULTO)', marginX + 85, tableHeaderY + 4.8);
        doc.text('STOCK ACTUAL', marginX + 135, tableHeaderY + 4.8);
        doc.text('CANTIDAD A PEDIR', marginX + 162, tableHeaderY + 4.8);

        return tableHeaderY + 7;
      } else {
        // Compact Header for Subsequent Pages
        doc.setFillColor(15, 23, 42);
        doc.rect(marginX, 8, contentWidth, 11, 'F');
        doc.setFillColor(14, 165, 233);
        doc.rect(marginX, 19, contentWidth, 0.8, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(`${storeName || 'depos'} — LISTA DE COMPRAS`, marginX + 4, 14.5);

        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`Página ${pageNumber} de ${totalPages}`, marginX + contentWidth - 25, 14.5);

        // Table Header
        const tableHeaderY = 21;
        doc.setFillColor(241, 245, 249);
        doc.rect(marginX, tableHeaderY, contentWidth, 6.5, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(marginX, tableHeaderY, contentWidth, 6.5, 'S');

        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('FOTO', marginX + 3, tableHeaderY + 4.5);
        doc.text('PRODUCTO Y EMPAQUE', marginX + 22, tableHeaderY + 4.5);
        doc.text('CÓDIGOS DE BARRA (UD / BULTO)', marginX + 85, tableHeaderY + 4.5);
        doc.text('STOCK ACTUAL', marginX + 135, tableHeaderY + 4.5);
        doc.text('CANTIDAD A PEDIR', marginX + 162, tableHeaderY + 4.5);

        return tableHeaderY + 6.5;
      }
    };

    let currentPage = 1;
    let currentY = drawHeader(1);

    matchedProducts.forEach(({ product, item }, idx) => {
      // Check if we need a new page
      const isPageBreak =
        currentPage === 1
          ? idx === itemsPerPageFirst
          : (idx - itemsPerPageFirst) % itemsPerPageSubsequent === 0;

      if (idx > 0 && isPageBreak) {
        // Draw page footer on current page
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `depos • Documento de Compras y Abastecimiento • Pág. ${currentPage} de ${totalPages}`,
          105,
          291,
          { align: 'center' }
        );

        doc.addPage('a4', 'portrait');
        currentPage++;
        currentY = drawHeader(currentPage);
      }

      // Alternating row background
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');
      }

      // Border outline
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'S');

      // Col 1: Photo / Icon (x: marginX + 2 to marginX + 19)
      const photoX = marginX + 2.5;
      const photoY = currentY + 2.5;
      const photoSize = 18;

      const imgDataUrl = loadedImageDataUrls[product.id];
      if (imgDataUrl) {
        try {
          doc.addImage(imgDataUrl, 'JPEG', photoX, photoY, photoSize, photoSize);
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.2);
          doc.rect(photoX, photoY, photoSize, photoSize, 'S');
        } catch {
          doc.setFillColor(241, 245, 249);
          doc.rect(photoX, photoY, photoSize, photoSize, 'F');
          doc.setTextColor(100, 116, 139);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(product.name.slice(0, 2).toUpperCase(), photoX + 5, photoY + 11);
        }
      } else {
        doc.setFillColor(241, 245, 249);
        doc.rect(photoX, photoY, photoSize, photoSize, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.rect(photoX, photoY, photoSize, photoSize, 'S');
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(product.name.slice(0, 2).toUpperCase(), photoX + 5, photoY + 11);
      }

      // Col 2: Product Name & Packaging (x: marginX + 23, width 60mm)
      const col2X = marginX + 23;
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);

      const displayName =
        product.name.length > 32 ? product.name.slice(0, 30) + '...' : product.name;
      doc.text(displayName, col2X, currentY + 6);

      // Category / Pasillo
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Pasillo: ${product.category?.trim().toUpperCase().replace(/\s+/g, '-') || 'PASILLO-1'}`,
        col2X,
        currentY + 11
      );

      // Bulk Packaging info
      const factor = Math.max(1, product.unitsPerBulk || 12);
      const bulkName = product.bulkUnitName || `Caja x${factor}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text(`Presentación: ${bulkName} (${factor} uds/bulto)`, col2X, currentY + 15.5);

      if (item.customNotes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        doc.setTextColor(2, 132, 199);
        doc.text(`Nota: ${item.customNotes}`, col2X, currentY + 19.5);
      }

      // Col 3: Barcodes (x: marginX + 85, width 48mm)
      const col3X = marginX + 85;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(51, 65, 85);
      doc.text('CÓD. UNIDAD:', col3X, currentY + 6);

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(3, 105, 161); // sky-700
      doc.text(product.barcodeUnit || product.barcode, col3X, currentY + 10.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(51, 65, 85);
      doc.text('CÓD. BULTO:', col3X, currentY + 15);

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text(product.barcodeBulk || '--- Sin código ---', col3X, currentY + 19.5);

      // Col 4: Current stock (x: marginX + 135, width 25mm)
      const col4X = marginX + 135;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Existencias:', col4X, currentY + 6);

      const isLow = product.stock <= (product.minStockAlertUnit ?? product.minStockAlert ?? 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      if (isLow) {
        doc.setTextColor(220, 38, 38); // rose-600
      } else {
        doc.setTextColor(22, 163, 74); // emerald-600
      }
      doc.text(`${product.stock} ${product.unit || 'uds'}`, col4X, currentY + 12);

      const currentBulks = Math.floor(product.stock / factor);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`(${currentBulks} bultos)`, col4X, currentY + 17);

      // Col 5: Recuadro de compra interactivo / manual (x: marginX + 160, width 38mm)
      const boxX = marginX + 158;
      const boxY = currentY + 2.5;
      const boxW = 39;
      const boxH = 19;

      // Outer Box container
      doc.setFillColor(255, 255, 255);
      doc.rect(boxX, boxY, boxW, boxH, 'F');
      doc.setDrawColor(2, 132, 199); // sky-600
      doc.setLineWidth(0.35);
      doc.rect(boxX, boxY, boxW, boxH, 'S');

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(3, 105, 161);
      doc.text('CANTIDAD A PEDIR:', boxX + 2, boxY + 3.2);

      const hasBulksVal = typeof item.bulksToBuy === 'number' && !isNaN(item.bulksToBuy);
      const hasUnitsVal = typeof item.unitsToBuy === 'number' && !isNaN(item.unitsToBuy);

      // Sub-box Bultos
      const bultosBoxX = boxX + 2;
      const bultosBoxY = boxY + 4.2;
      const subBoxW = 16.5;
      const subBoxH = 9.2;

      if (hasBulksVal) {
        doc.setFillColor(240, 249, 255);
        doc.rect(bultosBoxX, bultosBoxY, subBoxW, subBoxH, 'F');
        doc.setDrawColor(2, 132, 199);
        doc.setLineWidth(0.3);
        doc.rect(bultosBoxX, bultosBoxY, subBoxW, subBoxH, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(3, 105, 161);
        doc.text(String(item.bulksToBuy), bultosBoxX + subBoxW / 2, bultosBoxY + 6.5, {
          align: 'center',
        });
      } else {
        // Recuadro azul punteado totalmente limpio, transparente y en blanco sin textos
        doc.setFillColor(255, 255, 255);
        doc.rect(bultosBoxX, bultosBoxY, subBoxW, subBoxH, 'F');
        doc.setDrawColor(2, 132, 199); // azul / sky-600
        doc.setLineWidth(0.35);
        doc.setLineDashPattern([1.2, 0.8], 0);
        doc.rect(bultosBoxX, bultosBoxY, subBoxW, subBoxH, 'S');
        doc.setLineDashPattern([], 0); // reset dash
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(51, 65, 85);
      doc.text('BULTOS', bultosBoxX + subBoxW / 2, boxY + 16.8, { align: 'center' });

      // Sub-box Unidades
      const unidadesBoxX = boxX + 20.5;
      const unidadesBoxY = boxY + 4.2;

      if (hasUnitsVal) {
        doc.setFillColor(240, 249, 255);
        doc.rect(unidadesBoxX, unidadesBoxY, subBoxW, subBoxH, 'F');
        doc.setDrawColor(2, 132, 199);
        doc.setLineWidth(0.3);
        doc.rect(unidadesBoxX, unidadesBoxY, subBoxW, subBoxH, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(3, 105, 161);
        doc.text(String(item.unitsToBuy), unidadesBoxX + subBoxW / 2, unidadesBoxY + 6.5, {
          align: 'center',
        });
      } else {
        // Recuadro azul punteado totalmente limpio, transparente y en blanco sin textos
        doc.setFillColor(255, 255, 255);
        doc.rect(unidadesBoxX, unidadesBoxY, subBoxW, subBoxH, 'F');
        doc.setDrawColor(2, 132, 199); // azul / sky-600
        doc.setLineWidth(0.35);
        doc.setLineDashPattern([1.2, 0.8], 0);
        doc.rect(unidadesBoxX, unidadesBoxY, subBoxW, subBoxH, 'S');
        doc.setLineDashPattern([], 0); // reset dash
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(51, 65, 85);
      doc.text('UNIDADES', unidadesBoxX + subBoxW / 2, boxY + 16.8, { align: 'center' });

      currentY += rowHeight;
    });

    // Draw footer on last page
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `depos • Documento de Compras y Abastecimiento • Pág. ${currentPage} de ${totalPages}`,
      105,
      291,
      { align: 'center' }
    );

    return doc.output('datauristring');
  },

  // Multi-device sync merging
  mergeShoppingList(remoteItems: ShoppingListItem[]): ShoppingListItem[] {
    if (!Array.isArray(remoteItems) || remoteItems.length === 0) {
      return this.getShoppingList();
    }
    const local = this.getShoppingList();
    const map = new Map<string, ShoppingListItem>();

    for (const item of local) {
      map.set(item.productId || item.id, item);
    }
    for (const remote of remoteItems) {
      const key = remote.productId || remote.id;
      if (!map.has(key)) {
        map.set(key, remote);
      } else {
        const existing = map.get(key)!;
        map.set(key, {
          ...existing,
          ...remote,
          customNotes: remote.customNotes || existing.customNotes,
          targetQuantity: remote.targetQuantity || existing.targetQuantity,
          bulksToBuy: remote.bulksToBuy !== undefined ? remote.bulksToBuy : existing.bulksToBuy,
          unitsToBuy: remote.unitsToBuy !== undefined ? remote.unitsToBuy : existing.unitsToBuy,
        });
      }
    }
    const merged = Array.from(map.values());
    this.saveShoppingList(merged);
    return merged;
  },

  mergeReplenishmentList(remoteItems: ReplenishmentItem[]): ReplenishmentItem[] {
    if (!Array.isArray(remoteItems) || remoteItems.length === 0) {
      return this.getReplenishmentList();
    }
    const local = this.getReplenishmentList();
    const map = new Map<string, ReplenishmentItem>();

    for (const item of local) {
      map.set(item.productId || item.id, item);
    }
    for (const remote of remoteItems) {
      const key = remote.productId || remote.id;
      if (!map.has(key)) {
        map.set(key, remote);
      } else {
        const existing = map.get(key)!;
        map.set(key, {
          ...existing,
          ...remote,
          status: remote.status || existing.status,
          quantityToAdd: remote.quantityToAdd ?? existing.quantityToAdd,
          unitMode: remote.unitMode || existing.unitMode,
        });
      }
    }
    const merged = Array.from(map.values());
    this.saveReplenishmentList(merged);
    return merged;
  },
};
