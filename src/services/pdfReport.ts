import { jsPDF } from 'jspdf';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Product, StockMovement, StoreSettings } from '../types';

export interface ReportOptions {
  includeLowStockOnly?: boolean;
  categoryFilter?: string;
  includeMovements?: boolean;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  userFilter?: string; // 'all' or userId / userName
  userNameLabel?: string;
  movementTypeFilter?: 'all' | 'in' | 'out';
}

export function buildInventoryPDFDoc(
  products: Product[],
  movements: StockMovement[],
  settings: StoreSettings,
  options: ReportOptions = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Header Banner
  doc.setFillColor(18, 22, 30);
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Title & Store Info
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.storeName || 'depos', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 174, 192);
  const dateStr = new Date().toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(`Reporte de Existencias Físicas y Códigos de Barra  •  ${dateStr}`, 14, 20);
  doc.text('Generado Offline • Sincronización Local de Existencias', 14, 26);

  // Physical Inventory Metrics
  const filteredProducts = options.categoryFilter && options.categoryFilter !== 'all'
    ? products.filter((p) => p.category === options.categoryFilter)
    : products;

  const totalItems = filteredProducts.length;
  const totalUnits = filteredProducts.reduce((acc, p) => acc + p.stock, 0);
  const totalBulks = filteredProducts.reduce((acc, p) => {
    const factor = Math.max(1, p.unitsPerBulk || 12);
    return acc + Math.floor(p.stock / factor);
  }, 0);
  const lowStockCount = filteredProducts.filter((p) => p.stock <= p.minStockAlert).length;

  y = 38;

  // KPI Summary Cards (Grid of 4 boxes)
  const boxWidth = (pageWidth - 28 - 9) / 4;
  const kpis = [
    { label: 'Productos', value: `${totalItems}`, sub: 'Artículos registrados' },
    { label: 'Existencias', value: `${totalUnits}`, sub: 'Unidades totales' },
    { label: 'Bultos / Cajas', value: `${totalBulks}`, sub: 'Packs cerrados' },
    { label: 'Stock Bajo', value: `${lowStockCount}`, sub: 'Requieren reposición', alert: lowStockCount > 0 },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (boxWidth + 3);
    doc.setFillColor(kpi.alert ? 254 : 243, kpi.alert ? 242 : 244, kpi.alert ? 242 : 246);
    doc.roundedRect(x, y, boxWidth, 18, 2, 2, 'F');
    doc.setDrawColor(kpi.alert ? 248 : 229, kpi.alert ? 113 : 231, kpi.alert ? 113 : 235);
    doc.roundedRect(x, y, boxWidth, 18, 2, 2, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(kpi.alert ? 185 : 100, kpi.alert ? 28 : 116, kpi.alert ? 28 : 139);
    doc.text(kpi.label, x + 3, y + 5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.alert ? 220 : 15, kpi.alert ? 38 : 23, kpi.alert ? 38 : 42);
    doc.text(kpi.value, x + 3, y + 11.5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 149, 160);
    doc.text(kpi.sub, x + 3, y + 15.5);
  });

  y += 24;

  // Helper for page overflow
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > 280) {
      doc.addPage();
      y = 15;
      return true;
    }
    return false;
  };

  // Section 1: Low stock alerts if any
  const lowStockItems = filteredProducts.filter((p) => p.stock <= p.minStockAlert);
  if (lowStockItems.length > 0) {
    checkPageBreak(30);
    doc.setFillColor(239, 68, 68);
    doc.rect(14, y, 3, 7, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`ALERTA: PRODUCTOS CON STOCK CRÍTICO O BAJO (${lowStockItems.length})`, 20, y + 5);
    y += 10;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Producto', 16, y + 4.2);
    doc.text('Cód. Unidad', 75, y + 4.2);
    doc.text('Stock Actual', 115, y + 4.2);
    doc.text('Mínimo', 145, y + 4.2);
    doc.text('Estado', 170, y + 4.2);
    y += 7;

    lowStockItems.forEach((item, index) => {
      checkPageBreak(7);
      if (index % 2 === 1) {
        doc.setFillColor(254, 242, 242);
        doc.rect(14, y - 1, pageWidth - 28, 6, 'F');
      }

      const isCritical = item.stock <= Math.floor(item.minStockAlert / 2);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(item.name.substring(0, 32), 16, y + 3.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(item.barcodeUnit || item.barcode, 75, y + 3.2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isCritical ? 220 : 202, isCritical ? 38 : 138, 4);
      doc.text(`${item.stock} ${item.unit || 'uds'}`, 115, y + 3.2);

      doc.setTextColor(100, 116, 139);
      doc.text(`${item.minStockAlert} ${item.unit || 'uds'}`, 145, y + 3.2);

      doc.setTextColor(isCritical ? 220 : 202, isCritical ? 38 : 138, 4);
      doc.text(isCritical ? 'URGENTE' : 'Reponer', 170, y + 3.2);

      y += 6;
    });

    y += 6;
  }

  // Section 2: Complete Inventory Catalog with dual barcodes
  checkPageBreak(30);
  doc.setFillColor(13, 148, 136);
  doc.rect(14, y, 3, 7, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('DETALLE COMPLETO DE EXISTENCIAS Y EMPAQUES', 20, y + 5);
  y += 10;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Producto', 16, y + 4.2);
  doc.text('Cód. Unidad', 70, y + 4.2);
  doc.text('Cód. Bulto', 105, y + 4.2);
  doc.text('Empaque', 138, y + 4.2);
  doc.text('Stock', 165, y + 4.2);
  doc.text('Bultos Est.', 182, y + 4.2);
  y += 7;

  filteredProducts.forEach((item, index) => {
    checkPageBreak(6.5);
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, pageWidth - 28, 5.5, 'F');
    }

    const factor = Math.max(1, item.unitsPerBulk || 12);
    const bulks = Math.floor(item.stock / factor);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(item.name.substring(0, 28), 16, y + 3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(13, 148, 136);
    doc.text((item.barcodeUnit || item.barcode).substring(0, 15), 70, y + 3);

    doc.setTextColor(217, 119, 6);
    doc.text(item.barcodeBulk ? item.barcodeBulk.substring(0, 15) : '-', 105, y + 3);

    doc.setTextColor(100, 116, 139);
    doc.text(item.bulkUnitName ? item.bulkUnitName.substring(0, 14) : `x${factor}`, 138, y + 3);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.stock <= item.minStockAlert ? 220 : 30, item.stock <= item.minStockAlert ? 38 : 41, 59);
    doc.text(`${item.stock}`, 165, y + 3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${bulks} cj`, 182, y + 3);

    y += 5.5;
  });

  // Section 3: Recent Audited Movements
  if (options.includeMovements !== false) {
    // 1. Filtrar movimientos por fecha, usuario y tipo
    let auditedMovements = [...movements];

    if (options.startDate) {
      const startMs = new Date(`${options.startDate}T00:00:00`).getTime();
      auditedMovements = auditedMovements.filter((m) => new Date(m.timestamp).getTime() >= startMs);
    }
    if (options.endDate) {
      const endMs = new Date(`${options.endDate}T23:59:59.999`).getTime();
      auditedMovements = auditedMovements.filter((m) => new Date(m.timestamp).getTime() <= endMs);
    }

    if (options.userFilter && options.userFilter !== 'all') {
      const filterKey = options.userFilter.toLowerCase();
      auditedMovements = auditedMovements.filter(
        (m) =>
          (m.userId && m.userId.toLowerCase() === filterKey) ||
          (m.userName && m.userName.toLowerCase().includes(filterKey))
      );
    }

    if (options.movementTypeFilter && options.movementTypeFilter !== 'all') {
      auditedMovements = auditedMovements.filter((m) => m.type === options.movementTypeFilter);
    }

    y += 6;
    checkPageBreak(30);
    doc.setFillColor(16, 185, 129);
    doc.rect(14, y, 3, 7, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`REGISTRO DE MOVIMIENTOS AUDITADOS (${auditedMovements.length})`, 20, y + 5);
    y += 8;

    // Subtítulo con resumen de filtros activos
    const dateRangeStr =
      options.startDate || options.endDate
        ? `${options.startDate || 'Inicio'} hasta ${options.endDate || 'Hoy'}`
        : 'Historial completo';
    const userStr = options.userNameLabel || (options.userFilter && options.userFilter !== 'all' ? options.userFilter : 'Todos los usuarios');
    const typeStr =
      options.movementTypeFilter === 'in'
        ? 'Solo Entradas'
        : options.movementTypeFilter === 'out'
        ? 'Solo Salidas'
        : 'Entradas y Salidas';

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Auditoría: Fechas: ${dateRangeStr}  •  Operario: ${userStr}  •  Tipo: ${typeStr}`, 14, y + 3.5);
    y += 6;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Fecha / Hora', 16, y + 4.2);
    doc.text('Operario', 48, y + 4.2);
    doc.text('Tipo', 80, y + 4.2);
    doc.text('Producto', 102, y + 4.2);
    doc.text('Cantidad', 154, y + 4.2);
    doc.text('Balance Stock', 174, y + 4.2);
    y += 7;

    if (auditedMovements.length === 0) {
      checkPageBreak(12);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageWidth - 28, 10, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(140, 149, 160);
      doc.text('No se encontraron movimientos registrados que coincidan con los filtros seleccionados.', 18, y + 6);
      y += 12;
    } else {
      // Mostrar movimientos auditados (hasta 150 para optimizar peso)
      const listToRender = auditedMovements.slice(0, 150);
      listToRender.forEach((m, idx) => {
        checkPageBreak(6);
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y - 1, pageWidth - 28, 5.5, 'F');
        }

        const dateShort = new Date(m.timestamp).toLocaleString('es-ES', {
          dateStyle: 'short',
          timeStyle: 'short',
        });

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(dateShort, 16, y + 3);

        const opName = (m.userName || 'Sistema').substring(0, 16);
        doc.text(opName, 48, y + 3);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(m.type === 'in' ? 16 : 225, m.type === 'in' ? 185 : 29, m.type === 'in' ? 129 : 72);
        doc.text(m.type === 'in' ? 'ENTRADA' : 'SALIDA', 80, y + 3);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(m.productName.substring(0, 24), 102, y + 3);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(m.type === 'in' ? 16 : 225, m.type === 'in' ? 185 : 29, m.type === 'in' ? 129 : 72);
        doc.text(`${m.type === 'in' ? '+' : '-'}${m.quantity} uds`, 154, y + 3);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${m.previousStock} -> ${m.newStock}`, 174, y + 3);

        y += 5.5;
      });

      if (auditedMovements.length > 150) {
        checkPageBreak(8);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(140, 149, 160);
        doc.text(`... y ${auditedMovements.length - 150} movimiento(s) adicionales en el periodo auditado.`, 16, y + 4);
        y += 6;
      }
    }
  }

  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 160, 175);
    doc.text(
      `Página ${i} de ${totalPages}  •  ${settings.storeName || 'depos'}  •  Sistema de Control de Existencias`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  return doc;
}

export function generateInventoryPDF(
  products: Product[],
  movements: StockMovement[],
  settings: StoreSettings,
  options: ReportOptions = {}
): void {
  const doc = buildInventoryPDFDoc(products, movements, settings, options);
  const cleanStoreName = (settings.storeName || 'inventario')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanStoreName}_existencias_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export async function shareInventoryPDFNative(
  products: Product[],
  movements: StockMovement[],
  settings: StoreSettings,
  options: ReportOptions = {}
): Promise<{ success: boolean; method: string }> {
  const doc = buildInventoryPDFDoc(products, movements, settings, options);
  const cleanStoreName = (settings.storeName || 'inventario')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanStoreName}_existencias_${new Date().toISOString().slice(0, 10)}.pdf`;
  const title = settings.storeName || 'Balance de Existencias';

  // 1. Native Capacitor Environment (@capacitor/share + @capacitor/filesystem)
  if (Capacitor.isNativePlatform()) {
    try {
      const dataUri = doc.output('datauristring');
      const base64Data = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title,
        text: `Reporte de Existencias (PDF) - ${title}`,
        files: [savedFile.uri],
        url: savedFile.uri,
        dialogTitle: 'Compartir Reporte de Existencias (PDF)',
      });

      return { success: true, method: 'capacitor_native' };
    } catch (err: any) {
      console.warn('Native Capacitor share error, checking cancellation or fallback:', err);
      const msg = err?.message || String(err);
      if (
        msg.includes('canceled') ||
        msg.includes('cancelled') ||
        msg.includes('abort') ||
        msg.includes('dismissed')
      ) {
        return { success: true, method: 'cancelled_by_user' };
      }
    }
  }

  // 2. Web Share API fallback if supported
  try {
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [pdfFile] })
    ) {
      await navigator.share({
        files: [pdfFile],
        title,
        text: `Reporte de Existencias (PDF) - ${title}`,
      });
      return { success: true, method: 'web_share' };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: true, method: 'cancelled_by_user' };
    }
  }

  // 3. Fallback: Direct vector download
  doc.save(filename);
  return { success: true, method: 'download_fallback' };
}
