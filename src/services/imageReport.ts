import { Product, StockMovement, StoreSettings } from '../types';

export interface ReportOptions {
  includeLowStockOnly?: boolean;
  categoryFilter?: string;
  includeMovements?: boolean;
}

export interface GeneratedReportImage {
  dataUrl: string;
  blob: Blob;
  filename: string;
  file: File;
}

/**
 * Draws a rounded rectangle on a canvas context
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill = true,
  stroke = false
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/**
 * Generates a high-resolution, crisp JPG report of store inventory and stock balances
 */
export async function generateInventoryJPG(
  products: Product[],
  movements: StockMovement[],
  settings: StoreSettings,
  options: ReportOptions = {}
): Promise<GeneratedReportImage> {
  const filteredProducts = products.filter((p) => {
    if (options.categoryFilter && options.categoryFilter !== 'all' && p.category !== options.categoryFilter) {
      return false;
    }
    if (options.includeLowStockOnly && p.stock > (p.minStockAlertUnit || p.minStockAlert || 5)) {
      return false;
    }
    return true;
  });

  const filteredMovements = (options.includeMovements ? movements.slice(0, 15) : []);

  // Filter calculations
  const totalItems = filteredProducts.length;
  const totalUnits = filteredProducts.reduce((acc, p) => acc + p.stock, 0);
  const totalBulks = filteredProducts.reduce((acc, p) => {
    const factor = Math.max(1, p.unitsPerBulk || 12);
    return acc + Math.floor(p.stock / factor);
  }, 0);
  const lowStockCount = filteredProducts.filter((p) => {
    const min = p.minStockAlertUnit || p.minStockAlert || 5;
    return p.stock <= min;
  }).length;

  // Dimensions
  const canvasWidth = 1200;
  const headerHeight = 160;
  const kpiSectionHeight = 130;
  const filterBannerHeight = 50;
  const tableHeaderHeight = 44;
  const rowHeight = 48;
  const tableHeight = Math.max(1, filteredProducts.length) * rowHeight + tableHeaderHeight;
  const movementsSectionHeight = filteredMovements.length > 0 ? 70 + filteredMovements.length * 40 : 0;
  const footerHeight = 100;
  const padding = 40;

  const totalHeight = headerHeight + kpiSectionHeight + filterBannerHeight + tableHeight + movementsSectionHeight + footerHeight + padding * 2;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo inicializar el motor de renderizado de imagen');
  }

  // 1. Background (Crisp clean white paper for pristine mobile reading and printing)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // 2. Header Banner
  let currentY = padding;
  ctx.fillStyle = '#0f172a'; // Deep slate
  roundRect(ctx, padding, currentY, canvasWidth - padding * 2, 120, 16, true, false);

  // Store title & Subtitle
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(settings.storeName || 'depos', padding + 30, currentY + 48);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const nowStr = new Date().toLocaleString('es-ES', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });
  ctx.fillText(`Balance General y Control Físico de Existencias • ${nowStr}`, padding + 30, currentY + 78);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('REPORTE OFICIAL EN FORMATO DE ALTA DEFINICIÓN (JPG)', padding + 30, currentY + 100);

  currentY += 140;

  // 3. KPI Cards (4 columns)
  const availableWidth = canvasWidth - padding * 2;
  const cardGap = 16;
  const cardWidth = (availableWidth - cardGap * 3) / 4;
  const cardHeight = 96;

  const kpis = [
    { label: 'PRODUCTOS', val: `${totalItems}`, sub: 'Artículos en listado', bg: '#f8fafc', border: '#e2e8f0', color: '#0f172a' },
    { label: 'EXISTENCIAS TOTALES', val: `${totalUnits}`, sub: 'Unidades sueltas', bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
    { label: 'BULTOS ESTIMADOS', val: `${totalBulks}`, sub: 'Cajas / Packs cerrados', bg: '#f0f9ff', border: '#bae6fd', color: '#0369a1' },
    {
      label: 'STOCK CRÍTICO / BAJO',
      val: `${lowStockCount}`,
      sub: lowStockCount > 0 ? 'Requieren reposición' : 'Sin alertas críticas',
      bg: lowStockCount > 0 ? '#fef2f2' : '#f8fafc',
      border: lowStockCount > 0 ? '#fecaca' : '#e2e8f0',
      color: lowStockCount > 0 ? '#b91c1c' : '#0f172a',
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = padding + idx * (cardWidth + cardGap);
    ctx.fillStyle = kpi.bg;
    ctx.strokeStyle = kpi.border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, cardX, currentY, cardWidth, cardHeight, 12, true, true);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(kpi.label, cardX + 16, currentY + 26);

    ctx.fillStyle = kpi.color;
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(kpi.val, cardX + 16, currentY + 62);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'normal 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(kpi.sub, cardX + 16, currentY + 82);
  });

  currentY += cardHeight + 20;

  // 4. Filter note banner
  ctx.fillStyle = '#f1f5f9';
  roundRect(ctx, padding, currentY, availableWidth, 34, 8, true, false);
  ctx.fillStyle = '#475569';
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const filterCatName = options.categoryFilter && options.categoryFilter !== 'all' ? options.categoryFilter.toUpperCase() : 'TODAS LAS CATEGORÍAS';
  const filterLowText = options.includeLowStockOnly ? ' • [SOLO ARTÍCULOS CON STOCK BAJO]' : '';
  ctx.fillText(`FILTRO APLICADO: ${filterCatName}${filterLowText} • TOTAL: ${filteredProducts.length} REGISTROS`, padding + 16, currentY + 22);

  currentY += 46;

  // 5. Product Table Header
  const colX = {
    product: padding + 16,
    barcodes: padding + 380,
    bulks: padding + 630,
    stock: padding + 800,
    min: padding + 930,
    status: padding + 1040,
  };

  ctx.fillStyle = '#1e293b';
  roundRect(ctx, padding, currentY, availableWidth, tableHeaderHeight, 8, true, false);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PRODUCTO / CATEGORÍA', colX.product, currentY + 27);
  ctx.fillText('CÓD. UNIDAD / BULTO', colX.barcodes, currentY + 27);
  ctx.fillText('BULTOS EST.', colX.bulks, currentY + 27);
  ctx.fillText('STOCK ACT.', colX.stock, currentY + 27);
  ctx.fillText('MÍN.', colX.min, currentY + 27);
  ctx.fillText('ESTADO', colX.status, currentY + 27);

  currentY += tableHeaderHeight + 4;

  // 6. Product Rows
  if (filteredProducts.length === 0) {
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, padding, currentY, availableWidth, 60, 8, true, false);
    ctx.fillStyle = '#64748b';
    ctx.font = 'normal 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('No hay productos que coincidan con los filtros seleccionados.', padding + 30, currentY + 35);
    currentY += 68;
  } else {
    filteredProducts.forEach((prod, idx) => {
      const isAlt = idx % 2 === 1;
      const rowY = currentY;

      // Row background
      ctx.fillStyle = isAlt ? '#f8fafc' : '#ffffff';
      roundRect(ctx, padding, rowY, availableWidth, rowHeight, 4, true, false);

      // Bottom separator
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(padding, rowY + rowHeight - 1, availableWidth, 1);

      // Product Name & category
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const truncatedName = prod.name.length > 36 ? prod.name.slice(0, 34) + '...' : prod.name;
      ctx.fillText(truncatedName, colX.product, rowY + 22);

      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(prod.category.toUpperCase(), colX.product, rowY + 38);

      // Barcodes (Unit & Bulk)
      ctx.fillStyle = '#1e293b';
      ctx.font = '600 12px monospace';
      const uCode = prod.barcodeUnit || prod.barcode || 'S/C';
      ctx.fillText(`U: ${uCode}`, colX.barcodes, rowY + 21);

      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 11px monospace';
      const bCode = prod.barcodeBulk ? `B: ${prod.barcodeBulk}` : 'B: -';
      ctx.fillText(bCode, colX.barcodes, rowY + 37);

      // Estimated Bulks
      const unitsPerBulk = Math.max(1, prod.unitsPerBulk || 12);
      const bCount = Math.floor(prod.stock / unitsPerBulk);
      const rem = prod.stock % unitsPerBulk;
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${bCount} bultos`, colX.bulks, rowY + 22);
      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`(+${rem} uds)`, colX.bulks, rowY + 36);

      // Stock
      const minStock = prod.minStockAlertUnit || prod.minStockAlert || 5;
      const isLow = prod.stock <= minStock;
      ctx.fillStyle = isLow ? '#dc2626' : '#0f172a';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${prod.stock} ${prod.unit || 'uds'}`, colX.stock, rowY + 28);

      // Min Alert
      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${minStock}`, colX.min, rowY + 28);

      // Status Badge
      const badgeX = colX.status;
      const badgeY = rowY + 12;
      const badgeWidth = 90;
      const badgeHeight = 24;

      if (isLow) {
        ctx.fillStyle = '#fee2e2';
        ctx.strokeStyle = '#fca5a5';
        roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 6, true, true);
        ctx.fillStyle = '#991b1b';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('⚠️ REPONER', badgeX + 12, badgeY + 16);
      } else {
        ctx.fillStyle = '#dcfce7';
        ctx.strokeStyle = '#86efac';
        roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 6, true, true);
        ctx.fillStyle = '#166534';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('✓ NORMAL', badgeX + 16, badgeY + 16);
      }

      currentY += rowHeight;
    });
  }

  currentY += 24;

  // 7. Recent Movements Table (if requested)
  if (filteredMovements.length > 0) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('HISTORIAL RECIENTE DE MOVIMIENTOS Y REPOSICIONES', padding, currentY + 10);
    currentY += 28;

    // Movement header
    ctx.fillStyle = '#334155';
    roundRect(ctx, padding, currentY, availableWidth, 36, 6, true, false);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('FECHA Y HORA', padding + 16, currentY + 22);
    ctx.fillText('PRODUCTO', padding + 230, currentY + 22);
    ctx.fillText('TIPO / MOTIVO', padding + 560, currentY + 22);
    ctx.fillText('CANTIDAD', padding + 820, currentY + 22);
    ctx.fillText('USUARIO', padding + 980, currentY + 22);

    currentY += 40;

    filteredMovements.forEach((m, idx) => {
      const isAlt = idx % 2 === 1;
      ctx.fillStyle = isAlt ? '#f8fafc' : '#ffffff';
      roundRect(ctx, padding, currentY, availableWidth, 38, 4, true, false);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(padding, currentY + 37, availableWidth, 1);

      // Date
      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 11px monospace';
      const mDate = new Date(m.timestamp).toLocaleString('es-ES', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      ctx.fillText(mDate, padding + 16, currentY + 23);

      // Prod name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const mName = m.productName.length > 32 ? m.productName.slice(0, 30) + '...' : m.productName;
      ctx.fillText(mName, padding + 230, currentY + 23);

      // Type & Reason
      const isIn = m.type === 'in';
      ctx.fillStyle = isIn ? '#15803d' : '#b91c1c';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(isIn ? 'ENTRADA' : 'SALIDA', padding + 560, currentY + 23);

      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`(${m.reason})`, padding + 630, currentY + 23);

      // Quantity
      ctx.fillStyle = isIn ? '#15803d' : '#b91c1c';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${isIn ? '+' : '-'}${m.quantity} uds`, padding + 820, currentY + 23);

      // User
      ctx.fillStyle = '#475569';
      ctx.font = 'normal 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(m.userName || 'Personal', padding + 980, currentY + 23);

      currentY += 40;
    });

    currentY += 20;
  }

  // 8. Footer
  ctx.fillStyle = '#f1f5f9';
  roundRect(ctx, padding, currentY, availableWidth, 70, 10, true, false);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${settings.storeName || 'depos'} • Sistema Integral de Control Físico`, padding + 24, currentY + 28);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'normal 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Este documento gráfico representa el conteo físico de existencias generado localmente y optimizado para descarga o impresión.', padding + 24, currentY + 48);

  // Convert to JPG Blob & Data URL
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        resolve(b || new Blob([], { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  });

  const cleanStoreName = (settings.storeName || 'inventario')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanStoreName}_reporte_${new Date().toISOString().slice(0, 10)}.jpg`;
  const file = new File([blob], filename, { type: 'image/jpeg' });

  return {
    dataUrl,
    blob,
    filename,
    file,
  };
}

/**
 * Robust download & save trigger compatible with Android browsers, WebView, and desktop
 */
export function downloadImageFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Web Share API for saving directly to Android Gallery or sending via WhatsApp / Drive
 */
export async function shareImageFile(file: File, title: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: `Reporte de Inventario y Existencias - ${title}`,
      });
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
      return false;
    }
  }
  return false;
}
