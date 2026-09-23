import { Product, ShoppingListItem, ReplenishmentItem } from '../types';

const SHOPPING_STORAGE_KEY = 'inventario_shopping_list_v1';
const REPLENISHMENT_STORAGE_KEY = 'inventario_replenishment_list_v1';

export const ShoppingService = {
  // Shopping list management
  getShoppingList(): ShoppingListItem[] {
    try {
      const data = localStorage.getItem(SHOPPING_STORAGE_KEY);
      if (!data) return [];
      const parsed: ShoppingListItem[] = JSON.parse(data);
      const allowedIds = new Set(['prod-1789964939522', 'prod-1789957711181']);
      const filtered = parsed.filter((item) => allowedIds.has(item.productId));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(filtered));
      }
      return filtered;
    } catch {
      return [];
    }
  },

  saveShoppingList(items: ShoppingListItem[]): void {
    localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(items));
  },

  addToShoppingList(productId: string, customNotes?: string): ShoppingListItem[] {
    const list = this.getShoppingList();
    if (!list.some((item) => item.productId === productId)) {
      list.push({
        id: `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        customNotes,
        addedAt: new Date().toISOString(),
      });
      this.saveShoppingList(list);
    }
    return list;
  },

  removeFromShoppingList(productId: string): ShoppingListItem[] {
    const list = this.getShoppingList().filter((item) => item.productId !== productId);
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
      const allowedIds = new Set(['prod-1789964939522', 'prod-1789957711181']);
      const filtered = parsed.filter((item) => allowedIds.has(item.productId));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(REPLENISHMENT_STORAGE_KEY, JSON.stringify(filtered));
      }
      return filtered;
    } catch {
      return [];
    }
  },

  saveReplenishmentList(items: ReplenishmentItem[]): void {
    localStorage.setItem(REPLENISHMENT_STORAGE_KEY, JSON.stringify(items));
  },

  addToReplenishmentList(productId: string, locationNotes?: string, suggestedUnits?: number): ReplenishmentItem[] {
    const list = this.getReplenishmentList();
    if (!list.some((item) => item.productId === productId)) {
      list.push({
        id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        status: 'pending',
        locationNotes,
        suggestedUnits,
        addedAt: new Date().toISOString(),
      });
      this.saveReplenishmentList(list);
    }
    return list;
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

      // Col 5: RECUADRO VACÍO PARA ANOTAR MANUALMENTE LAS CANTIDADES A COMPRAR
      const boxX = 940;
      const boxY = currentY + 12;
      const boxW = 210;
      const boxH = 80;

      // Outer blank box
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Blank line header
      ctx.fillStyle = '#0369A1';
      ctx.font = 'bold 11px "Segoe UI", Roboto, sans-serif';
      ctx.fillText('CANTIDAD A PEDIR:', boxX + 12, boxY + 18);

      // Blank handwriting boxes (COMPLETAMENTE VACÍOS PARA ANOTAR A MANO)
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      // Cuadro vacío para Bultos
      ctx.strokeRect(boxX + 14, boxY + 24, 68, 34);
      // Cuadro vacío para Unidades
      ctx.strokeRect(boxX + 98, boxY + 24, 68, 34);
      ctx.setLineDash([]); // Reset dash

      // Las palabras BULTOS y UNIDADES debajo del cuadro vacío
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

    // Automatically trigger download
    const cleanStore = (storeName || 'tienda').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const fileName = `lista_compras_${cleanStore}_${new Date().toISOString().slice(0, 10)}.jpg`;

    const downloadLink = document.createElement('a');
    downloadLink.href = jpgDataUrl;
    downloadLink.download = fileName;
    downloadLink.click();

    return jpgDataUrl;
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
