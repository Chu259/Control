import { Product } from '../types';

export interface StockAlertStatus {
  isLow: boolean;
  isLowUnit: boolean;
  isLowBulk: boolean;
  isCritical: boolean;
  currentUnits: number;
  currentBulks: number;
  minUnitAlert: number;
  minBulkAlert: number;
  alertLabel: string;
}

export function checkStockAlert(product: Product, defaultMinStock: number = 5): StockAlertStatus {
  const currentUnits = product.stock || 0;
  const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
  const currentBulks = Math.floor(currentUnits / unitsPerBulk);

  const minUnitAlert =
    product.minStockAlertUnit !== undefined
      ? product.minStockAlertUnit
      : product.minStockAlert !== undefined
      ? product.minStockAlert
      : defaultMinStock;

  const minBulkAlert = product.minStockAlertBulk !== undefined ? product.minStockAlertBulk : 1;

  const isLowUnit = currentUnits <= minUnitAlert;
  const isLowBulk = minBulkAlert > 0 && currentBulks <= minBulkAlert;
  const isLow = isLowUnit || isLowBulk;

  const isCritical =
    currentUnits <= Math.floor(minUnitAlert / 2) || (minBulkAlert > 0 && currentBulks === 0);

  let alertLabel = 'Stock Normal';
  if (isLowUnit && isLowBulk) {
    alertLabel = 'Bajo en Uds y Bultos';
  } else if (isLowUnit) {
    alertLabel = `Bajo en Uds (≤ ${minUnitAlert})`;
  } else if (isLowBulk) {
    alertLabel = `Bajo en Bultos (≤ ${minBulkAlert} cj)`;
  }

  return {
    isLow,
    isLowUnit,
    isLowBulk,
    isCritical,
    currentUnits,
    currentBulks,
    minUnitAlert,
    minBulkAlert,
    alertLabel,
  };
}
