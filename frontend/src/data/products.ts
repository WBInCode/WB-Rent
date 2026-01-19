// Demo product data for the application
export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  pricePerDay: number;
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
    id: 'ozonatory',
    name: 'Ozonatory',
    description: 'Profesjonalne generatory ozonu do dezynfekcji i usuwania zapachów',
    icon: 'wind',
  },
  {
    id: 'sprzet-czyszczacy',
    name: 'Sprzęt czyszczący',
    description: 'Wydajne urządzenia do kompleksowego czyszczenia',
    icon: 'sparkles',
  },
];

export const products: Product[] = [
  // Ozonatory
  {
    id: 'ozonator-20g',
    name: 'Ozonator profesjonalny 20g/h',
    description: 'Wydajny generator ozonu do dezynfekcji pomieszczeń',
    categoryId: 'ozonatory',
    pricePerDay: 120,
    features: ['20g ozonu/h', 'Timer cyfrowy', 'Do 200m²'],
    available: true,
  },
  {
    id: 'ozonator-10g',
    name: 'Ozonator kompaktowy 10g/h',
    description: 'Kompaktowy ozonator do mniejszych pomieszczeń',
    categoryId: 'ozonatory',
    pricePerDay: 80,
    features: ['10g ozonu/h', 'Przenośny', 'Do 100m²'],
    available: true,
  },
  // Sprzęt czyszczący
  {
    id: 'myjka-200bar',
    name: 'Myjka ciśnieniowa 200 bar',
    description: 'Profesjonalna myjka wysokociśnieniowa',
    categoryId: 'sprzet-czyszczacy',
    pricePerDay: 150,
    features: ['200 bar', '3000W', 'Zestaw dysz'],
    available: true,
  },
  {
    id: 'odkurzacz-przemyslowy',
    name: 'Odkurzacz przemysłowy',
    description: 'Mocny odkurzacz do zastosowań przemysłowych',
    categoryId: 'sprzet-czyszczacy',
    pricePerDay: 100,
    features: ['2400W', 'Zbiornik 30L', 'Filtr HEPA'],
    available: false,
  },
  {
    id: 'odkurzacz-pioracy',
    name: 'Odkurzacz piorący',
    description: 'Odkurzacz z funkcją prania tapicerki',
    categoryId: 'sprzet-czyszczacy',
    pricePerDay: 120,
    features: ['Pranie tapicerki', 'Zbiornik 8L', 'Dysze specjalne'],
    available: true,
  },
  {
    id: 'polerka-ekstraktor',
    name: 'Polerka / Ekstraktor',
    description: 'Wielofunkcyjne urządzenie do polerowania i ekstrakcji',
    categoryId: 'sprzet-czyszczacy',
    pricePerDay: 100,
    features: ['Polerowanie', 'Ekstrakcja', 'Regulacja obrotów'],
    available: true,
  },
];

export const DELIVERY_FEE = 50; // PLN

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
  withDelivery: boolean
): { basePrice: number; deliveryFee: number; total: number } | null {
  const product = getProductById(productId);
  if (!product) return null;

  const basePrice = product.pricePerDay * days;
  const deliveryFee = withDelivery ? DELIVERY_FEE : 0;
  const total = basePrice + deliveryFee;

  return { basePrice, deliveryFee, total };
}
