import { Product, StockMovement } from '../types';

export interface DailyControlStatus {
  isPendingVerification: boolean;
  hoursSinceLastMovement: number;
  lastMovementTime: Date;
  lastVerifiedAt?: Date;
  liberatedUntil?: Date;
  stockDesc: string;
  nextEvaluationTime: Date;
}

/**
 * Calculates the exact moment until which a product is liberated after being verified with "Góndola OK".
 * As required: "al presionarlo, el empleado confirma que revisó el estante, la alerta de ese producto específico
 * se oculta inmediatamente de la pantalla y el contador de inactividad se limpia, quedando liberado hasta las 19:00 hs del día siguiente."
 */
export function getLiberatedUntilTime(verifiedAtDate: Date): Date {
  const vYear = verifiedAtDate.getFullYear();
  const vMonth = verifiedAtDate.getMonth();
  const vDay = verifiedAtDate.getDate();

  // 19:00:00 hs of the day after verification
  return new Date(vYear, vMonth, vDay + 1, 19, 0, 0, 0);
}

/**
 * Returns the upcoming 19:00 hs trigger based on local device clock.
 */
export function getNext19hs(): Date {
  const now = new Date();
  const today19 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0, 0);

  if (now.getTime() < today19.getTime()) {
    return today19;
  }
  return new Date(today19.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Evaluates whether a product requires daily gondola verification:
 * 1. Stock must be greater than zero (stock > 0).
 * 2. No real Entry ('in') or Exit ('out') registered in the last 24 hours.
 * 3. Not currently liberated by a "Góndola OK" verification (liberated until 19:00 hs of the day following verification).
 */
export function checkProductDailyGondola(
  product: Product,
  movements: StockMovement[]
): DailyControlStatus {
  const now = new Date();
  const next19hs = getNext19hs();
  const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;

  // Format stock description in deposit (bulks and units)
  const unitsPerBulk = Math.max(1, product.unitsPerBulk || 12);
  const bulks = Math.floor(product.stock / unitsPerBulk);
  const loose = product.stock % unitsPerBulk;

  let stockDesc = '';
  if (product.stock >= unitsPerBulk) {
    const bName = bulks === 1 ? 'bulto' : 'bultos';
    if (loose > 0) {
      stockDesc = `${bulks} ${bName} (${product.stock} uds)`;
    } else {
      stockDesc = `${bulks} ${bName}`;
    }
  } else {
    stockDesc = `${product.stock} ${product.stock === 1 ? 'unidad' : 'unidades'}`;
  }

  // If no stock in deposit, no verification required
  if (product.stock <= 0) {
    return {
      isPendingVerification: false,
      hoursSinceLastMovement: 0,
      lastMovementTime: new Date(),
      stockDesc,
      nextEvaluationTime: next19hs,
    };
  }

  // Find latest "Góndola OK" verification timestamp from product property or movement history
  let latestVerificationTime = 0;
  if (product.lastVerifiedAt) {
    const vt = new Date(product.lastVerifiedAt).getTime();
    if (vt > latestVerificationTime) {
      latestVerificationTime = vt;
    }
  }

  const verifMovements = movements.filter(
    (m) => m.productId === product.id && m.reason === 'verificacion'
  );
  for (const vm of verifMovements) {
    const vt = new Date(vm.timestamp).getTime();
    if (vt > latestVerificationTime) {
      latestVerificationTime = vt;
    }
  }

  // Check if product is currently liberated by "Góndola OK"
  let isLiberated = false;
  let liberatedUntil: Date | undefined;

  if (latestVerificationTime > 0) {
    liberatedUntil = getLiberatedUntilTime(new Date(latestVerificationTime));
    if (now.getTime() < liberatedUntil.getTime()) {
      isLiberated = true;
    }
  }

  // Filter real movements (compra, venta, devolucion, ajuste, merma with quantity > 0)
  const realMovements = movements.filter(
    (m) => m.productId === product.id && m.reason !== 'verificacion' && m.quantity > 0
  );

  let latestRealMovementTime = 0;
  for (const m of realMovements) {
    const t = new Date(m.timestamp).getTime();
    if (t > latestRealMovementTime) {
      latestRealMovementTime = t;
    }
  }

  // Fallback if no real movements recorded in local history yet
  if (latestRealMovementTime === 0) {
    if (product.addedAt) {
      latestRealMovementTime = new Date(product.addedAt).getTime();
    } else if (product.lastUpdated) {
      latestRealMovementTime = new Date(product.lastUpdated).getTime();
    } else {
      latestRealMovementTime = now.getTime() - 48 * 60 * 60 * 1000;
    }
  }

  // Condition 1: Real movement in the last 24 hours?
  const hadMovementInLast24Hs = latestRealMovementTime >= twentyFourHoursAgo;

  // Condition 2: Is it pending verification?
  // Requires verification if:
  // - stock > 0
  // - No real movements in the last 24hs
  // - Not currently liberated by "Góndola OK" (until 19:00 hs next day)
  const isPendingVerification = !hadMovementInLast24Hs && !isLiberated;

  const hoursSinceLastMovement = Math.max(
    24,
    Math.floor((now.getTime() - latestRealMovementTime) / (1000 * 60 * 60))
  );

  return {
    isPendingVerification,
    hoursSinceLastMovement,
    lastMovementTime: new Date(latestRealMovementTime),
    lastVerifiedAt: latestVerificationTime > 0 ? new Date(latestVerificationTime) : undefined,
    liberatedUntil,
    stockDesc,
    nextEvaluationTime: liberatedUntil && isLiberated ? liberatedUntil : next19hs,
  };
}
