import { jsPDF } from 'jspdf';
import { Product, StockMovement, StoreSettings } from '../types';

export interface ReportOptions {
  includeLowStockOnly?: boolean;
  categoryFilter?: string;
  includeMovements?: boolean;
}

export function generateInventoryPDF(
  products: Product[],
  movements: StockMovement[],
  settings: StoreSettings,
  options: ReportOptions = {}
): void {
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

  // Section 3: Recent Movements
  if (options.includeMovements !== false && movements.length > 0) {
    y += 6;
    checkPageBreak(30);
    doc.setFillColor(16, 185, 129);
    doc.rect(14, y, 3, 7, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`REGISTRO DE MOVIMIENTOS RECIENTES (${Math.min(movements.length, 25)})`, 20, y + 5);
    y += 10;

    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Fecha', 16, y + 4.2);
    doc.text('Tipo', 50, y + 4.2);
    doc.text('Producto', 75, y + 4.2);
    doc.text('Presentación', 130, y + 4.2);
    doc.text('Cantidad', 158, y + 4.2);
    doc.text('Balance Stock', 178, y + 4.2);
    y += 7;

    movements.slice(0, 25).forEach((m, idx) => {
      checkPageBreak(6);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 1, pageWidth - 28, 5.5, 'F');
      }

      const dateShort = new Date(m.timestamp).toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(dateShort, 16, y + 3);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(m.type === 'in' ? 16 : 225, m.type === 'in' ? 185 : 29, m.type === 'in' ? 129 : 72);
      doc.text(m.type === 'in' ? 'ENTRADA' : 'SALIDA', 50, y + 3);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(m.productName.substring(0, 28), 75, y + 3);

      doc.setTextColor(100, 116, 139);
      const isBulk = m.format === 'bulk' || m.unitType === 'bulk';
      doc.text(isBulk ? `Bulto (${m.bulkQuantity || 1} cj)` : 'Unidades', 130, y + 3);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(m.type === 'in' ? 16 : 225, m.type === 'in' ? 185 : 29, m.type === 'in' ? 129 : 72);
      doc.text(`${m.type === 'in' ? '+' : '-'}${m.quantity} uds`, 158, y + 3);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${m.previousStock} -> ${m.newStock}`, 178, y + 3);

      y += 5.5;
    });
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

  // Trigger browser download
  const cleanStoreName = (settings.storeName || 'inventario')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanStoreName}_existencias_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
