// === PRODUCT CATALOG - Single Source of Truth (server-side) ===
// Used by routes.ts (pricing/validation), admin.ts and scheduler.ts (display names).
// Keep in sync with frontend/src/data/products.ts

export interface ServerProduct {
  name: string;
  image: string;
  pricePerDay: number;
  priceNextDay: number;
  priceWeekend: number;
  categoryId: string;
  /** Offer details - seeded into the DB, editable in the admin panel afterwards. */
  description?: string;
  features?: string[];
  includedAccessories?: string[];
  optionalAccessories?: string[];
  accessoryPrice?: number;
}

export interface ProductCatalogRow {
  id: string;
  name: string;
  category_id: string;
  price_per_day: number;
  price_next_day: number;
  price_weekend: number;
}

export const products: Record<string, ServerProduct> = {
  'puzzi-10-1': {
    name: 'Odkurzacz Piorący Kärcher Puzzi 10/1', image: '/products/puzzi-10-1.jpg',
    pricePerDay: 45, priceNextDay: 45, priceWeekend: 150, categoryId: 'odkurzacze-piorace',
    description: 'Profesjonalny odkurzacz piorący do tapicerki, dywanów i wykładzin',
    features: ['Pranie tapicerki', 'Dywany i wykładziny', 'Zbiornik 10L'],
    includedAccessories: ['2x 100g środek czyszczący Kärcher RM 760'],
    optionalAccessories: ['środek czyszczący Kärcher RM 780'],
    accessoryPrice: 10,
  },
  'puzzi-8-1': {
    name: 'Odkurzacz Piorący Kärcher Puzzi 8/1 Anniversary', image: '/products/puzzi-8-1.jpg',
    pricePerDay: 40, priceNextDay: 40, priceWeekend: 130, categoryId: 'odkurzacze-piorace',
    description: 'Kompaktowy odkurzacz piorący idealny do mniejszych powierzchni',
    features: ['Pranie tapicerki', 'Kompaktowy', 'Zbiornik 8L'],
    includedAccessories: ['2x 100g środek czyszczący Kärcher RM 760'],
    optionalAccessories: ['środek czyszczący Kärcher RM 780'],
    accessoryPrice: 10,
  },
  'nt-22-1': {
    name: 'Odkurzacz Przemysłowy Kärcher NT 22/1 AP L', image: '/products/nt-22-1.jpg',
    pricePerDay: 60, priceNextDay: 45, priceWeekend: 110, categoryId: 'odkurzacze-przemyslowe',
    description: 'Mocny odkurzacz przemysłowy do pracy na sucho i mokro',
    features: ['Sucho/mokro', '22L zbiornik', 'Filtr AP'],
    includedAccessories: ['worek do odkurzacza'],
    optionalAccessories: ['Worki do odkurzacza'],
    accessoryPrice: 15,
  },
  'nt-30-1': {
    name: 'Odkurzacz Przemysłowy Kärcher NT 30/1 Tact Te L', image: '/products/nt-30-1.jpg',
    pricePerDay: 80, priceNextDay: 60, priceWeekend: 140, categoryId: 'odkurzacze-przemyslowe',
    description: 'Profesjonalny odkurzacz z automatycznym czyszczeniem filtra',
    features: ['System Tact', '30L zbiornik', 'Auto-czyszczenie filtra'],
    includedAccessories: ['worek do odkurzacza'],
    optionalAccessories: ['Worki do odkurzacza'],
    accessoryPrice: 20,
  },
  'ad-4-premium': {
    name: 'Odkurzacz Kominkowy Kärcher AD 4 Premium', image: '/products/ad-4-premium.jpg',
    pricePerDay: 40, priceNextDay: 40, priceWeekend: 90, categoryId: 'odkurzacze-przemyslowe',
    description: 'Specjalistyczny odkurzacz do popiołu z kominków i grilli',
    features: ['Do popiołu', 'Filtr metalowy', 'Zbiornik 17L'],
  },
  'ozonmed-pro-10g': {
    name: 'Ozonator powietrza Ozonmed Pro 10G', image: '/products/ozonmed-pro-10g.jpg',
    pricePerDay: 25, priceNextDay: 25, priceWeekend: 60, categoryId: 'ozonatory',
    description: 'Profesjonalny generator ozonu do dezynfekcji i usuwania zapachów',
    features: ['10g ozonu/h', 'Timer', 'Do 100m²'],
  },
  'af-100-h13': {
    name: 'Oczyszczacz Powietrza Kärcher AF 100 H13', image: '/products/af-100-h13.jpg',
    pricePerDay: 60, priceNextDay: 60, priceWeekend: 130, categoryId: 'ozonatory',
    description: 'Zaawansowany oczyszczacz powietrza z filtrem HEPA H13',
    features: ['Filtr HEPA H13', 'Cichy tryb', 'Do 100m²'],
  },
  'dmuchawa-ab-20': {
    name: 'Dmuchawa Kärcher AB 20 Ec', image: '/products/dmuchawa-ab-20.jpg',
    pricePerDay: 30, priceNextDay: 30, priceWeekend: 70, categoryId: 'pozostale',
    description: 'Akumulatorowa dmuchawa do liści i zanieczyszczeń',
    features: ['Akumulatorowa', 'Lekka', 'Wydajna'],
  },
  'sg-4-4': {
    name: 'Parownica Kärcher SG 4/4', image: '/products/sg-4-4.jpg',
    pricePerDay: 65, priceNextDay: 65, priceWeekend: 140, categoryId: 'pozostale',
    description: 'Profesjonalna parownica do czyszczenia i dezynfekcji',
    features: ['Para 4 bar', 'Zbiornik 4L', 'Zestaw dysz'],
  },
  'es-1-7-bp': {
    name: 'System do dezynfekcji Kärcher ES 1/7 Bp Pack', image: '/products/es-1-7-bp.jpg',
    pricePerDay: 25, priceNextDay: 25, priceWeekend: 60, categoryId: 'pozostale',
    description: 'Przenośny system do dezynfekcji powierzchni',
    features: ['Akumulatorowy', 'Plecakowy', 'Do 7L'],
    includedAccessories: ['2x 20ml Środek do dezynfekcji RM 735'],
    optionalAccessories: ['Środek do dezynfekcji RM 735'],
    accessoryPrice: 3,
  },
  'wvp-10-adv': {
    name: 'Myjka Do Okien Kärcher WVP 10 Adv', image: '/products/wvp-10-adv.jpg',
    pricePerDay: 30, priceNextDay: 30, priceWeekend: 70, categoryId: 'pozostale',
    description: 'Profesjonalna myjka do okien z funkcją spryskiwania',
    features: ['Akumulatorowa', 'Spryskiwacz', 'Bez smug'],
    includedAccessories: ['2x 20ml środek do szyb Kärcher RM 503'],
    optionalAccessories: ['środek do szyb Kärcher RM 503 (20ml)'],
  },
};

export const syncProductCatalog = (rows: ProductCatalogRow[]) => {
  for (const row of rows) {
    products[row.id] = {
      // Keep the seeded offer details - the sync rows only carry pricing.
      ...products[row.id],
      name: row.name,
      image: products[row.id]?.image || '/favicon.svg',
      categoryId: row.category_id,
      pricePerDay: Number(row.price_per_day),
      priceNextDay: Number(row.price_next_day),
      priceWeekend: Number(row.price_weekend),
    };
  }
};

export interface ProductReservationRange {
  startDate: string;
  endDate: string | null;
}

export const calculateFullyBookedRanges = (
  ranges: ProductReservationRange[],
  rentableQuantity: number
): Array<{ startDate: string; endDate: string; status: 'fully_booked' }> => {
  if (rentableQuantity <= 0) {
    return [{ startDate: '0001-01-01', endDate: '9999-12-31', status: 'fully_booked' }];
  }
  if (ranges.length < rentableQuantity) return [];

  const infinity = '9999-12-31';
  const boundaries = [...new Set(ranges.flatMap((range) => [range.startDate, range.endDate || infinity]))].sort();
  const saturated: Array<{ startDate: string; endDate: string; status: 'fully_booked' }> = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startDate = boundaries[index];
    const endDate = boundaries[index + 1];
    const reservedQuantity = ranges.filter((range) =>
      range.startDate < endDate && (range.endDate === null || range.endDate > startDate)
    ).length;
    if (reservedQuantity < rentableQuantity) continue;

    const previous = saturated.at(-1);
    if (previous?.endDate === startDate) {
      previous.endDate = endDate;
    } else {
      saturated.push({ startDate, endDate, status: 'fully_booked' });
    }
  }

  return saturated;
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

export const calculateRentalItemsPrice = (
  productIds: string[],
  days: number,
  weekendPackage: boolean
) => {
  const items = productIds.map((productId) => {
    const product = products[productId];
    if (!product) return null;
    return {
      productId,
      categoryId: product.categoryId,
      productName: product.name,
      itemPrice: calculateProductRentalPrice(productId, days, weekendPackage) as number,
    };
  });
  if (items.some((item) => item === null)) return null;
  const validItems = items.filter((item): item is NonNullable<typeof item> => item !== null);
  return {
    items: validItems,
    basePrice: validItems.reduce((sum, item) => sum + item.itemPrice, 0),
  };
};

/**
 * Stawki zgodne z §12 umowy: obie są liczone „każdorazowo", czyli od kursu
 * i od zdarzenia, a nie raz na najem. Dowóz i odbiór to dwa osobne kursy,
 * więc komplet kosztuje 2 × 20 zł — tyle samo co dotychczasowy ryczałt.
 */
export const DELIVERY_LEG_FEE = 20;
export const WEEKEND_SERVICE_FEE = 30;

/** Zgodne nazwy dla kodu, który jeszcze nie rozróżnia kursów. */
export const DELIVERY_FEE = DELIVERY_LEG_FEE * 2;
export const WEEKEND_PICKUP_FEE = WEEKEND_SERVICE_FEE;

/**
 * Płatny dodatek do sprzętu: worek, środek czyszczący, płyn do dezynfekcji.
 * To sprzedaż towaru zużywalnego, a nie najem, więc cena jest jednorazowa —
 * nie mnoży się przez doby i nie obejmuje jej rabat na najem.
 */
export interface ProductAddon {
  id: string;
  nazwa: string;
  cena: number;
}

/** NFD nie rozkłada „ł", więc ten jeden znak trzeba podmienić ręcznie. */
const bezOgonkow = (tekst: string): string =>
  tekst.replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Lista dodatków nie ma własnych kluczy w bazie — identyfikator liczymy z nazwy. */
export const addonId = (nazwa: string): string =>
  bezOgonkow(nazwa).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const zaokraglij = (kwota: number) => Math.round(kwota * 100) / 100;

/**
 * Dodatki sprowadzone do jednej postaci. W bazie leżą dwa kształty: starsze
 * wpisy to same nazwy z jedną ceną wspólną dla całego sprzętu, nowsze mają
 * cenę przy każdej pozycji.
 */
export const normalizeAddons = (surowe: unknown, cenaZapasowa = 0): ProductAddon[] => {
  if (!Array.isArray(surowe)) return [];
  const wynik: ProductAddon[] = [];
  for (const pozycja of surowe) {
    const zTekstu = typeof pozycja === 'string';
    const nazwa = (zTekstu ? pozycja : String((pozycja as any)?.nazwa ?? '')).trim();
    if (!nazwa) continue;
    const surowaCena = Number(zTekstu ? cenaZapasowa : (pozycja as any)?.cena);
    const id = addonId(nazwa);
    if (!id || wynik.some((istniejacy) => istniejacy.id === id)) continue;
    wynik.push({
      id,
      nazwa,
      cena: Number.isFinite(surowaCena) && surowaCena > 0 ? zaokraglij(surowaCena) : 0,
    });
  }
  return wynik;
};

export interface AddonSelection {
  id: string;
  quantity: number;
}

export interface PricedAddon {
  productId: string;
  id: string;
  nazwa: string;
  cena: number;
  ilosc: number;
  suma: number;
}

/** Sprzęt i jego dodatki — tyle wystarczy do wyceny zamówionych pozycji. */
export interface AddonCatalogEntry {
  productId: string;
  dodatki: ProductAddon[];
}

/**
 * Wycena dodatków wyłącznie z katalogu — cena przysłana przez przeglądarkę
 * nigdy nie decyduje o kwocie. Pozycja bez ceny nie jest na sprzedaż, więc
 * jej zamówienie jest błędem, a nie cichym zerem.
 */
export const priceAddons = (
  katalog: AddonCatalogEntry[],
  wybor: AddonSelection[]
): { items: PricedAddon[]; fee: number } | { error: string } => {
  const items: PricedAddon[] = [];
  for (const pozycja of wybor) {
    const ilosc = Math.floor(Number(pozycja.quantity) || 0);
    if (ilosc <= 0) continue;
    const wpis = katalog.find((sprzet) => sprzet.dodatki.some((dodatek) => dodatek.id === pozycja.id));
    const dodatek = wpis?.dodatki.find((kandydat) => kandydat.id === pozycja.id);
    if (!wpis || !dodatek) return { error: 'Wybrany dodatek nie jest dostępny do tego sprzętu' };
    if (!(dodatek.cena > 0)) return { error: `Dodatek „${dodatek.nazwa}" nie ma jeszcze ustalonej ceny` };
    const istniejacy = items.find((item) => item.id === dodatek.id);
    if (istniejacy) {
      istniejacy.ilosc += ilosc;
      istniejacy.suma = zaokraglij(istniejacy.cena * istniejacy.ilosc);
      continue;
    }
    items.push({
      productId: wpis.productId,
      id: dodatek.id,
      nazwa: dodatek.nazwa,
      cena: dodatek.cena,
      ilosc,
      suma: zaokraglij(dodatek.cena * ilosc),
    });
  }
  return { items, fee: zaokraglij(items.reduce((suma, item) => suma + item.suma, 0)) };
};

/** Wszystkie urzadzenia rezerwacji - pozycje zestawu albo pojedynczy produkt. */
export const reservationProductIds = (reservation: any): string[] => {
  if (Array.isArray(reservation?.items) && reservation.items.length > 0) {
    return reservation.items.map((item: any) => String(item.product_id));
  }
  return reservation?.product_id ? [String(reservation.product_id)] : [];
};

export const reservationProductNames = (reservation: any): string =>
  reservationProductIds(reservation).map(getProductName).join(', ');
