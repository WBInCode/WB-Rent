// WB-Rent - Real product data based on actual pricing
export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  pricePerDay: number;
  priceNextDay: number;
  priceWeekend: number;
  includedAccessories: string[];
  optionalAccessories: string[];
  accessoryPrice?: number;
  transportPrice: number;
  weekendPickupFee: number;
  features: string[];
  available: boolean;
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
    pricePerDay: 45,
    priceNextDay: 45,
    priceWeekend: 150,
    includedAccessories: ['2x 100g środek czyszczący Kärcher RM 760'],
    optionalAccessories: ['środek czyszczący Kärcher RM 780'],
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
    pricePerDay: 40,
    priceNextDay: 40,
    priceWeekend: 130,
    includedAccessories: ['2x 100g środek czyszczący Kärcher RM 760'],
    optionalAccessories: ['środek czyszczący Kärcher RM 780'],
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
    pricePerDay: 60,
    priceNextDay: 45,
    priceWeekend: 110,
    includedAccessories: ['worek do odkurzacza'],
    optionalAccessories: ['Worki do odkurzacza'],
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
    pricePerDay: 80,
    priceNextDay: 60,
    priceWeekend: 140,
    includedAccessories: ['worek do odkurzacza'],
    optionalAccessories: ['Worki do odkurzacza'],
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
    pricePerDay: 25,
    priceNextDay: 25,
    priceWeekend: 60,
    includedAccessories: ['2x 20ml Środek do dezynfekcji RM 735'],
    optionalAccessories: ['Środek do dezynfekcji RM 735'],
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
    pricePerDay: 30,
    priceNextDay: 30,
    priceWeekend: 70,
    includedAccessories: ['2x 20ml środek do szyb Kärcher RM 503'],
    optionalAccessories: ['środek do szyb Kärcher RM 503 (20ml)'],
    transportPrice: 20,
    weekendPickupFee: 30,
    features: ['Akumulatorowa', 'Spryskiwacz', 'Bez smug'],
    available: true,
  },
];

export const DELIVERY_FEE = 20; // PLN - transport każdą stronę
export const WEEKEND_PICKUP_FEE = 30; // PLN - odbiór w sobotę lub niedzielę

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
  withDelivery: boolean,
  isWeekend: boolean = false,
  weekendPickup: boolean = false
): { 
  basePrice: number; 
  deliveryFee: number; 
  weekendPickupFee: number;
  total: number 
} | null {
  const product = getProductById(productId);
  if (!product) return null;

  let basePrice: number;
  
  if (isWeekend && days <= 3) {
    // Weekend pricing (Pt-Pon)
    basePrice = product.priceWeekend;
  } else if (days === 1) {
    basePrice = product.pricePerDay;
  } else {
    // First day + next days pricing
    basePrice = product.pricePerDay + (product.priceNextDay * (days - 1));
  }

  const deliveryFee = withDelivery ? DELIVERY_FEE * 2 : 0; // Both ways
  const pickupFee = weekendPickup ? WEEKEND_PICKUP_FEE : 0;
  const total = basePrice + deliveryFee + pickupFee;

  return { basePrice, deliveryFee, weekendPickupFee: pickupFee, total };
}
