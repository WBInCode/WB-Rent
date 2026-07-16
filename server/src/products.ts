// === PRODUCT CATALOG - Single Source of Truth (server-side) ===
// Used by routes.ts (pricing/validation), admin.ts and scheduler.ts (display names).
// Keep in sync with frontend/src/data/products.ts

export interface ServerProduct {
  name: string;
  pricePerDay: number;
  priceNextDay: number;
  priceWeekend: number;
  categoryId: string;
}

export const products: Record<string, ServerProduct> = {
  'puzzi-10-1': { name: 'Odkurzacz Piorący Kärcher Puzzi 10/1', pricePerDay: 45, priceNextDay: 45, priceWeekend: 150, categoryId: 'odkurzacze-piorace' },
  'puzzi-8-1': { name: 'Odkurzacz Piorący Kärcher Puzzi 8/1 Anniversary', pricePerDay: 40, priceNextDay: 40, priceWeekend: 130, categoryId: 'odkurzacze-piorace' },
  'nt-22-1': { name: 'Odkurzacz Przemysłowy Kärcher NT 22/1 AP L', pricePerDay: 60, priceNextDay: 45, priceWeekend: 110, categoryId: 'odkurzacze-przemyslowe' },
  'nt-30-1': { name: 'Odkurzacz Przemysłowy Kärcher NT 30/1 Tact Te L', pricePerDay: 80, priceNextDay: 60, priceWeekend: 140, categoryId: 'odkurzacze-przemyslowe' },
  'ad-4-premium': { name: 'Odkurzacz Kominkowy Kärcher AD 4 Premium', pricePerDay: 40, priceNextDay: 40, priceWeekend: 90, categoryId: 'odkurzacze-przemyslowe' },
  'ozonmed-pro-10g': { name: 'Ozonator powietrza Ozonmed Pro 10G', pricePerDay: 25, priceNextDay: 25, priceWeekend: 60, categoryId: 'ozonatory' },
  'af-100-h13': { name: 'Oczyszczacz Powietrza Kärcher AF 100 H13', pricePerDay: 60, priceNextDay: 60, priceWeekend: 130, categoryId: 'ozonatory' },
  'dmuchawa-ab-20': { name: 'Dmuchawa Kärcher AB 20 Ec', pricePerDay: 30, priceNextDay: 30, priceWeekend: 70, categoryId: 'pozostale' },
  'sg-4-4': { name: 'Parownica Kärcher SG 4/4', pricePerDay: 65, priceNextDay: 65, priceWeekend: 140, categoryId: 'pozostale' },
  'es-1-7-bp': { name: 'System do dezynfekcji Kärcher ES 1/7 Bp Pack', pricePerDay: 25, priceNextDay: 25, priceWeekend: 60, categoryId: 'pozostale' },
  'wvp-10-adv': { name: 'Myjka Do Okien Kärcher WVP 10 Adv', pricePerDay: 30, priceNextDay: 30, priceWeekend: 70, categoryId: 'pozostale' },
};

/** Display name for a product id (falls back to the raw id). */
export const getProductName = (productId: string): string =>
  products[productId]?.name || productId;

export const calculateProductRentalPrice = (
  productId: string,
  days: number,
  weekendPackage: boolean
): number | null => {
  const product = products[productId];
  if (!product) return null;
  if (weekendPackage && days <= 3) return product.priceWeekend;
  return product.pricePerDay + product.priceNextDay * Math.max(0, days - 1);
};

// 20 zł each way, matching the public calculator (+40 zł total)
export const DELIVERY_FEE = 40;
export const WEEKEND_PICKUP_FEE = 30;
