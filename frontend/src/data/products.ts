import { getProductCatalog } from '@/services/api';

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

const dodatek = (nazwa: string, cena: number): ProductAddon => ({ id: addonId(nazwa), nazwa, cena });

/**
 * Dodatki sprowadzone do jednej postaci. Serwer potrafi jeszcze zwrócić starszy
 * zapis — samą nazwę, z jedną ceną wspólną dla całego sprzętu.
 */
export const normalizeAddons = (surowe: unknown, cenaZapasowa = 0): ProductAddon[] => {
  if (!Array.isArray(surowe)) return [];
  const wynik: ProductAddon[] = [];
  for (const pozycja of surowe) {
    const zTekstu = typeof pozycja === 'string';
    const nazwa = (zTekstu ? pozycja : String((pozycja as ProductAddon)?.nazwa ?? '')).trim();
    if (!nazwa) continue;
    const surowaCena = Number(zTekstu ? cenaZapasowa : (pozycja as ProductAddon)?.cena);
    const id = addonId(nazwa);
    if (!id || wynik.some((istniejacy) => istniejacy.id === id)) continue;
    wynik.push({
      id,
      nazwa,
      cena: Number.isFinite(surowaCena) && surowaCena > 0 ? Math.round(surowaCena * 100) / 100 : 0,
    });
  }
  return wynik;
};

// WB-Rent - Real product data based on actual pricing
export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  images?: string[]; // Gallery images (optional, falls back to single image)
  pricePerDay: number;
  priceNextDay: number;
  priceWeekend: number;
  includedAccessories: string[];
  optionalAccessories: ProductAddon[];
  accessoryPrice?: number;
  transportPrice: number;
  weekendPickupFee: number;
  features: string[];
  available: boolean;
  totalQuantity?: number;
  availableToday?: number;
}

// Helper to get all images for a product (gallery or fallback to single image)
export function getProductImages(product: Product): string[] {
  if (product.images && product.images.length > 0) {
    return product.images;
  }
  return [product.image];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const categories: Category[] = [
  {
    id: 'odkurzacze-piorace',
    name: 'Odkurzacze piorące',
    description: 'Profesjonalne odkurzacze do prania tapicerki, dywanów i wykładzin',
    icon: 'sparkles',
  },
  {
    id: 'odkurzacze-przemyslowe',
    name: 'Odkurzacze przemysłowe',
    description: 'Wydajne odkurzacze do zastosowań przemysłowych i budowlanych',
    icon: 'wind',
  },
  {
    id: 'ozonatory',
    name: 'Ozonatory i oczyszczacze',
    description: 'Generatory ozonu i oczyszczacze powietrza do dezynfekcji',
    icon: 'cloud',
  },
  {
    id: 'pozostale',
    name: 'Pozostały sprzęt',
    description: 'Parownice, myjki do okien i inny sprzęt czyszczący',
    icon: 'wrench',
  },
];

export const products: Product[] = [
  // Odkurzacze piorące
  {
    id: 'puzzi-10-1',
    name: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
    description: 'Profesjonalny odkurzacz piorący do tapicerki, dywanów i wykładzin',
    categoryId: 'odkurzacze-piorace',
    image: '/products/puzzi-10-1.jpg',
    pricePerDay: 45,
    priceNextDay: 45,
    priceWeekend: 150,
    includedAccessories: ['2x 100g środek czyszczący Kärcher RM 760'],
    optionalAccessories: [dodatek('środek czyszczący Kärcher RM 780', 10)],
    accessoryPrice: 10,
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Pranie tapicerki', 'Dywany i wykładziny', 'Zbiornik 10L'],
    available: true,
  },
  {
    id: 'puzzi-8-1',
    name: 'Odkurzacz Piorący Kärcher Puzzi 8/1 Anniversary',
    description: 'Kompaktowy odkurzacz piorący idealny do mniejszych powierzchni',
    categoryId: 'odkurzacze-piorace',
    image: '/products/puzzi-8-1.jpg',
    pricePerDay: 40,
    priceNextDay: 40,
    priceWeekend: 130,
    includedAccessories: ['2x 100g środek czyszczący Kärcher RM 760'],
    optionalAccessories: [dodatek('środek czyszczący Kärcher RM 780', 10)],
    accessoryPrice: 10,
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Pranie tapicerki', 'Kompaktowy', 'Zbiornik 8L'],
    available: true,
  },
  // Odkurzacze przemysłowe
  {
    id: 'nt-22-1',
    name: 'Odkurzacz Przemysłowy Kärcher NT 22/1 AP L',
    description: 'Mocny odkurzacz przemysłowy do pracy na sucho i mokro',
    categoryId: 'odkurzacze-przemyslowe',
    image: '/products/nt-22-1.jpg',
    pricePerDay: 60,
    priceNextDay: 45,
    priceWeekend: 110,
    includedAccessories: ['worek do odkurzacza'],
    optionalAccessories: [dodatek('Worki do odkurzacza', 15)],
    accessoryPrice: 15,
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Sucho/mokro', '22L zbiornik', 'Filtr AP'],
    available: true,
  },
  {
    id: 'nt-30-1',
    name: 'Odkurzacz Przemysłowy Kärcher NT 30/1 Tact Te L',
    description: 'Profesjonalny odkurzacz z automatycznym czyszczeniem filtra',
    categoryId: 'odkurzacze-przemyslowe',
    image: '/products/nt-30-1.jpg',
    pricePerDay: 80,
    priceNextDay: 60,
    priceWeekend: 140,
    includedAccessories: ['worek do odkurzacza'],
    optionalAccessories: [dodatek('Worki do odkurzacza', 20)],
    accessoryPrice: 20,
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['System Tact', '30L zbiornik', 'Auto-czyszczenie filtra'],
    available: true,
  },
  {
    id: 'ad-4-premium',
    name: 'Odkurzacz Kominkowy Kärcher AD 4 Premium',
    description: 'Specjalistyczny odkurzacz do popiołu z kominków i grilli',
    categoryId: 'odkurzacze-przemyslowe',
    image: '/products/ad-4-premium.jpg',
    pricePerDay: 40,
    priceNextDay: 40,
    priceWeekend: 90,
    includedAccessories: [],
    optionalAccessories: [],
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Do popiołu', 'Filtr metalowy', 'Zbiornik 17L'],
    available: true,
  },
  // Ozonatory i oczyszczacze
  {
    id: 'ozonmed-pro-10g',
    name: 'Ozonator powietrza Ozonmed Pro 10G',
    description: 'Profesjonalny generator ozonu do dezynfekcji i usuwania zapachów',
    categoryId: 'ozonatory',
    image: '/products/ozonmed-pro-10g.jpg',
    pricePerDay: 25,
    priceNextDay: 25,
    priceWeekend: 60,
    includedAccessories: [],
    optionalAccessories: [],
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['10g ozonu/h', 'Timer', 'Do 100m²'],
    available: true,
  },
  {
    id: 'af-100-h13',
    name: 'Oczyszczacz Powietrza Kärcher AF 100 H13',
    description: 'Zaawansowany oczyszczacz powietrza z filtrem HEPA H13',
    categoryId: 'ozonatory',
    image: '/products/af-100-h13.jpg',
    pricePerDay: 60,
    priceNextDay: 60,
    priceWeekend: 130,
    includedAccessories: [],
    optionalAccessories: [],
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Filtr HEPA H13', 'Cichy tryb', 'Do 100m²'],
    available: true,
  },
  // Pozostały sprzęt
  {
    id: 'dmuchawa-ab-20',
    name: 'Dmuchawa Kärcher AB 20 Ec',
    description: 'Akumulatorowa dmuchawa do liści i zanieczyszczeń',
    categoryId: 'pozostale',
    image: '/products/dmuchawa-ab-20.jpg',
    pricePerDay: 30,
    priceNextDay: 30,
    priceWeekend: 70,
    includedAccessories: [],
    optionalAccessories: [],
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Akumulatorowa', 'Lekka', 'Wydajna'],
    available: true,
  },
  {
    id: 'sg-4-4',
    name: 'Parownica Kärcher SG 4/4',
    description: 'Profesjonalna parownica do czyszczenia i dezynfekcji',
    categoryId: 'pozostale',
    image: '/products/sg-4-4.jpg',
    pricePerDay: 65,
    priceNextDay: 65,
    priceWeekend: 140,
    includedAccessories: [],
    optionalAccessories: [],
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Para 4 bar', 'Zbiornik 4L', 'Zestaw dysz'],
    available: true,
  },
  {
    id: 'es-1-7-bp',
    name: 'System do dezynfekcji Kärcher ES 1/7 Bp Pack',
    description: 'Przenośny system do dezynfekcji powierzchni',
    categoryId: 'pozostale',
    image: '/products/es-1-7-bp.jpg',
    pricePerDay: 25,
    priceNextDay: 25,
    priceWeekend: 60,
    includedAccessories: ['2x 20ml Środek do dezynfekcji RM 735'],
    optionalAccessories: [dodatek('Środek do dezynfekcji RM 735', 3)],
    accessoryPrice: 3,
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Akumulatorowy', 'Plecakowy', 'Do 7L'],
    available: true,
  },
  {
    id: 'wvp-10-adv',
    name: 'Myjka Do Okien Kärcher WVP 10 Adv',
    description: 'Profesjonalna myjka do okien z funkcją spryskiwania',
    categoryId: 'pozostale',
    image: '/products/wvp-10-adv.jpg',
    pricePerDay: 30,
    priceNextDay: 30,
    priceWeekend: 70,
    includedAccessories: ['2x 20ml środek do szyb Kärcher RM 503'],
    optionalAccessories: [dodatek('środek do szyb Kärcher RM 503 (20ml)', 0)],
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Akumulatorowa', 'Spryskiwacz', 'Bez smug'],
    available: true,
  },
];

export const DELIVERY_FEE = 20; // PLN - transport każdą stronę
export const WEEKEND_PICKUP_FEE = 30; // PLN - odbiór w sobotę lub niedzielę

// Bez pobranego katalogu znamy tylko wgraną na sztywno listę, która nie zna
// stanów magazynowych - wtedy nie wolno deklarować dostępności sprzętu.
let catalogLoaded = false;
export const isCatalogLoaded = () => catalogLoaded;

export async function loadProductCatalog(): Promise<void> {
  const response = await getProductCatalog();
  if (!response.success || !response.data?.products?.length) return;

  const hydrated = response.data.products.map((row) => {
    const fallback = products.find((product) => product.id === row.id);
    return {
      id: row.id,
      name: row.name,
      description: row.description || fallback?.description || '',
      categoryId: row.categoryId,
      image: row.image && row.image !== '/favicon.svg'
        ? row.image
        : fallback?.image || '/favicon.svg',
      images: row.images?.length
        ? row.images
        : fallback?.images?.length
          ? fallback.images
          : [fallback?.image || row.image],
      pricePerDay: row.pricePerDay,
      priceNextDay: row.priceNextDay,
      priceWeekend: row.priceWeekend,
      includedAccessories: row.includedAccessories?.length
        ? row.includedAccessories
        : fallback?.includedAccessories || [],
      optionalAccessories: normalizeAddons(
        row.optionalAccessories?.length ? row.optionalAccessories : fallback?.optionalAccessories,
        row.accessoryPrice || fallback?.accessoryPrice || 0
      ),
      accessoryPrice: row.accessoryPrice || fallback?.accessoryPrice,
      transportPrice: fallback?.transportPrice ?? DELIVERY_FEE,
      weekendPickupFee: fallback?.weekendPickupFee ?? WEEKEND_PICKUP_FEE,
      features: row.features?.length ? row.features : fallback?.features || [],
      available: row.available,
      totalQuantity: row.totalQuantity,
      availableToday: row.availableToday,
    } satisfies Product;
  });

  products.splice(0, products.length, ...hydrated);
  catalogLoaded = true;
}

// Helper functions
export function getProductsByCategory(categoryId: string): Product[] {
  return products.filter((p) => p.categoryId === categoryId);
}

export function getProductById(productId: string): Product | undefined {
  return products.find((p) => p.id === productId);
}

export function getCategoryById(categoryId: string): Category | undefined {
  return categories.find((c) => c.id === categoryId);
}

export function calculateRentalCost(
  productId: string,
  days: number,
  withDelivery: boolean | { dowoz: boolean; odbior: boolean },
  isWeekend: boolean = false,
  /** Ile zdarzeń wypada w weekend — wydanie i zwrot liczą się osobno (§12 umowy). */
  weekendPickup: boolean | number = false
): { 
  basePrice: number; 
  deliveryFee: number; 
  weekendPickupFee: number;
  total: number 
} | null {
  const product = getProductById(productId);
  if (!product) return null;

  let basePrice: number;
  
  if (isWeekend && days === 3) {
    // Weekend pricing (Pt-Pon)
    basePrice = product.priceWeekend;
  } else if (days === 1) {
    basePrice = product.pricePerDay;
  } else {
    // First day + next days pricing
    basePrice = product.pricePerDay + (product.priceNextDay * (days - 1));
  }

  // Dowóz i odbiór to dwa niezależne kursy, każdy płatny osobno.
  const kursy = typeof withDelivery === 'boolean'
    ? (withDelivery ? 2 : 0)
    : (withDelivery.dowoz ? 1 : 0) + (withDelivery.odbior ? 1 : 0);
  const deliveryFee = kursy * DELIVERY_FEE;
  const zdarzeniaWeekendowe = typeof weekendPickup === 'boolean' ? (weekendPickup ? 1 : 0) : weekendPickup;
  const pickupFee = zdarzeniaWeekendowe * WEEKEND_PICKUP_FEE;
  const total = basePrice + deliveryFee + pickupFee;

  return { basePrice, deliveryFee, weekendPickupFee: pickupFee, total };
}

export interface PricedAddon extends ProductAddon {
  productId: string;
  ilosc: number;
  suma: number;
}

/** Dodatki, które da się zamówić — pozycja bez ceny nie jest na sprzedaż. */
export function availableAddons(produkty: Product[]): Array<{ produkt: Product; dodatki: ProductAddon[] }> {
  return produkty
    .map((produkt) => ({ produkt, dodatki: produkt.optionalAccessories.filter((pozycja) => pozycja.cena > 0) }))
    .filter((wpis) => wpis.dodatki.length > 0);
}

/** Podgląd kwoty za dodatki; wiążącą sumę i tak przelicza serwer z katalogu. */
export function priceAddons(
  produkty: Product[],
  ilosci: Record<string, number>
): { items: PricedAddon[]; fee: number } {
  const items: PricedAddon[] = [];
  for (const { produkt, dodatki } of availableAddons(produkty)) {
    for (const dodatekProduktu of dodatki) {
      const ilosc = Math.floor(ilosci[dodatekProduktu.id] || 0);
      if (ilosc <= 0 || items.some((item) => item.id === dodatekProduktu.id)) continue;
      items.push({
        ...dodatekProduktu,
        productId: produkt.id,
        ilosc,
        suma: Math.round(dodatekProduktu.cena * ilosc * 100) / 100,
      });
    }
  }
  return { items, fee: Math.round(items.reduce((suma, item) => suma + item.suma, 0) * 100) / 100 };
}
