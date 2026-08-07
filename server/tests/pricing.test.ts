import { describe, it, expect } from 'vitest';
import { products, getProductName, calculateFullyBookedRanges, calculateProductRentalPrice, calculateRentalItemsPrice, DELIVERY_FEE, WEEKEND_PICKUP_FEE } from '../src/products.js';
import { productInventorySchema, reservationSchema } from '../src/schemas.js';

// Same pricing logic as POST /api/reservations in routes.ts
function computePrice(opts: {
  productId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  delivery: boolean;
  weekendPickup: boolean;
}) {
  const product = products[opts.productId];
  if (!product) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const dateDiff = Math.round((Date.parse(opts.endDate) - Date.parse(opts.startDate)) / msPerDay);
  const [sh, sm] = opts.startTime.split(':').map(Number);
  const [eh, em] = opts.endTime.split(':').map(Number);
  const extraDay = eh * 60 + em > sh * 60 + sm ? 1 : 0;
  const days = Math.max(1, dateDiff + extraDay);
  const pickupDay = new Date(`${opts.startDate}T12:00:00`).getDay();
  const basePrice = calculateProductRentalPrice(opts.productId, days, pickupDay === 5 && days === 3)!;
  const deliveryFee = opts.delivery ? DELIVERY_FEE : 0;
  const weekendPickupFee = opts.weekendPickup ? WEEKEND_PICKUP_FEE : 0;
  return { days, basePrice, deliveryFee, weekendPickupFee, totalPrice: basePrice + deliveryFee + weekendPickupFee };
}

const reservationInput = {
  categoryId: 'odkurzacze-piorace',
  productId: 'puzzi-10-1',
  productName: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
  startDate: '2026-08-01',
  endDate: '2026-08-02',
  startTime: '09:00',
  endTime: '09:00',
  days: 1,
  delivery: false,
  weekendPickup: false,
  firstName: 'Jan',
  lastName: 'Testowy',
  email: 'jan@example.com',
  phone: '600100200',
  wantsInvoice: false,
  totalPrice: 45,
};

describe('okres wynajmu', () => {
  it('pozwala pominąć datę zwrotu tylko dla wynajmu bezterminowego', () => {
    expect(reservationSchema.safeParse({
      ...reservationInput,
      endDate: '',
      isIndefinite: true,
    }).success).toBe(true);

    expect(reservationSchema.safeParse({
      ...reservationInput,
      endDate: '',
      isIndefinite: false,
    }).success).toBe(false);
  });

  it('odrzuca powtórzone urządzenie na jednej rezerwacji', () => {
    expect(reservationSchema.safeParse({
      ...reservationInput,
      productIds: ['puzzi-10-1', 'puzzi-10-1'],
    }).success).toBe(false);
  });
});

describe('wycena wielu urządzeń', () => {
  it('sumuje pozycje, pozostawiając opłaty wspólne poza ceną sprzętu', () => {
    const result = calculateRentalItemsPrice(['puzzi-10-1', 'nt-22-1'], 2, false);
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(2);
    expect(result!.items.map((item) => item.itemPrice)).toEqual([90, 105]);
    expect(result!.basePrice).toBe(195);
  });
});

describe('ilość i dostępność magazynowa', () => {
  it('jedna rezerwacja nie blokuje terminu, gdy produkt ma dwie sztuki', () => {
    expect(calculateFullyBookedRanges([
      { startDate: '2026-08-01', endDate: '2026-08-05' },
    ], 2)).toEqual([]);
  });

  it('blokuje tylko część terminu, w której zajęte są wszystkie sztuki', () => {
    expect(calculateFullyBookedRanges([
      { startDate: '2026-08-01', endDate: '2026-08-05' },
      { startDate: '2026-08-03', endDate: '2026-08-08' },
    ], 2)).toEqual([
      { startDate: '2026-08-03', endDate: '2026-08-05', status: 'fully_booked' },
    ]);
  });

  it('brak sprawnych sztuk blokuje cały kalendarz', () => {
    expect(calculateFullyBookedRanges([], 0)).toEqual([
      { startDate: '0001-01-01', endDate: '9999-12-31', status: 'fully_booked' },
    ]);
  });

  it('odrzuca stan serwisowy większy od stanu całkowitego', () => {
    const product = {
      id: 'nowy-produkt', name: 'Nowy produkt', description: '', categoryId: 'pozostale', image: '/favicon.svg',
      pricePerDay: 10, priceNextDay: 10, priceWeekend: 20,
      totalQuantity: 1, serviceQuantity: 2, inventoryNotes: '', isActive: true,
    };
    expect(productInventorySchema.safeParse(product).success).toBe(false);
    expect(productInventorySchema.safeParse({ ...product, serviceQuantity: 1 }).success).toBe(true);
  });

  it('serwis i sztuki wyłączone z użytku razem nie mogą przekroczyć stanu', () => {
    const product = {
      id: 'nowy-produkt', name: 'Nowy produkt', description: '', categoryId: 'pozostale', image: '/favicon.svg',
      pricePerDay: 10, priceNextDay: 10, priceWeekend: 20,
      totalQuantity: 3, serviceQuantity: 2, withdrawnQuantity: 2, inventoryNotes: '', isActive: true,
    };
    expect(productInventorySchema.safeParse(product).success).toBe(false);
    expect(productInventorySchema.safeParse({ ...product, withdrawnQuantity: 1 }).success).toBe(true);
  });

  it('brak pola o sztukach wyłączonych znaczy zero, a nie błąd', () => {
    const wynik = productInventorySchema.parse({
      id: 'nowy-produkt', name: 'Nowy produkt', description: '', categoryId: 'pozostale', image: '/favicon.svg',
      pricePerDay: 10, priceNextDay: 10, priceWeekend: 20,
      totalQuantity: 2, serviceQuantity: 0, inventoryNotes: '', isActive: true,
    });
    expect(wynik.withdrawnQuantity).toBe(0);
  });

  it('zachowuje starsze pojedyncze zdjęcie jako pierwszą pozycję galerii', () => {
    const result = productInventorySchema.parse({
      id: 'produkt-ze-zdjeciem', name: 'Produkt ze zdjęciem', description: '', categoryId: 'pozostale',
      image: '/products/obecne-zdjecie.jpg', pricePerDay: 10, priceNextDay: 10, priceWeekend: 20,
      totalQuantity: 1, serviceQuantity: 0, conditionStatus: 'good', inventoryNotes: '', isActive: true,
    });
    expect(result.images).toEqual(['/products/obecne-zdjecie.jpg']);
    expect(result.image).toBe('/products/obecne-zdjecie.jpg');
  });

  it('zachowuje kolejność galerii i synchronizuje zdjęcie główne', () => {
    const result = productInventorySchema.parse({
      id: 'produkt-z-galeria', name: 'Produkt z galerią', description: '', categoryId: 'pozostale',
      image: '/products/stare.jpg',
      images: ['/products/glowne.jpg', '/products/bok.jpg', '/products/tyl.jpg'],
      pricePerDay: 10, priceNextDay: 10, priceWeekend: 20,
      totalQuantity: 1, serviceQuantity: 0, conditionStatus: 'good', inventoryNotes: '', isActive: true,
    });
    expect(result.images).toEqual(['/products/glowne.jpg', '/products/bok.jpg', '/products/tyl.jpg']);
    expect(result.image).toBe('/products/glowne.jpg');
  });

  it('odrzuca duplikaty oraz niebezpieczne adresy galerii', () => {
    const base = {
      id: 'produkt-z-bledem', name: 'Produkt z błędem', description: '', categoryId: 'pozostale',
      image: '/products/glowne.jpg', pricePerDay: 10, priceNextDay: 10, priceWeekend: 20,
      totalQuantity: 1, serviceQuantity: 0, conditionStatus: 'good', inventoryNotes: '', isActive: true,
    };
    expect(productInventorySchema.safeParse({ ...base, images: ['/a.jpg', '/a.jpg'] }).success).toBe(false);
    expect(productInventorySchema.safeParse({ ...base, images: ['javascript:alert(1)'] }).success).toBe(false);
  });
});

describe('katalog produktów (SSOT)', () => {
  it('zawiera 11 produktów', () => {
    expect(Object.keys(products)).toHaveLength(11);
  });

  it('każdy produkt ma nazwę, cenę > 0 i kategorię', () => {
    for (const [id, p] of Object.entries(products)) {
      expect(p.name, id).toBeTruthy();
      expect(p.pricePerDay, id).toBeGreaterThan(0);
      expect(p.priceNextDay, id).toBeGreaterThan(0);
      expect(p.priceWeekend, id).toBeGreaterThan(0);
      expect(p.categoryId, id).toBeTruthy();
    }
  });

  it('getProductName zwraca nazwę lub surowe id', () => {
    expect(getProductName('puzzi-10-1')).toContain('Puzzi 10/1');
    expect(getProductName('nie-istnieje')).toBe('nie-istnieje');
  });
});

describe('wycena rezerwacji (logika serwera)', () => {
  it('1 dzień: te same daty i godziny', () => {
    const r = computePrice({
      productId: 'puzzi-10-1',
      startDate: '2026-08-01', endDate: '2026-08-01',
      startTime: '09:00', endTime: '09:00',
      delivery: false, weekendPickup: false,
    })!;
    expect(r.days).toBe(1);
    expect(r.totalPrice).toBe(45);
  });

  it('2 doby: różnica dat 2 dni, zwrot o tej samej godzinie', () => {
    const r = computePrice({
      productId: 'puzzi-10-1',
      startDate: '2026-08-01', endDate: '2026-08-03',
      startTime: '09:00', endTime: '09:00',
      delivery: false, weekendPickup: false,
    })!;
    expect(r.days).toBe(2);
    expect(r.basePrice).toBe(90);
  });

  it('rozpoczęta doba: zwrot później niż odbiór = +1 dzień', () => {
    const r = computePrice({
      productId: 'puzzi-10-1',
      startDate: '2026-08-01', endDate: '2026-08-03',
      startTime: '09:00', endTime: '10:00',
      delivery: false, weekendPickup: false,
    })!;
    expect(r.days).toBe(3);
    expect(r.basePrice).toBe(135);
  });

  it('zwrot wcześniej niż odbiór nie dodaje doby', () => {
    const r = computePrice({
      productId: 'puzzi-10-1',
      startDate: '2026-08-01', endDate: '2026-08-03',
      startTime: '12:00', endTime: '08:00',
      delivery: false, weekendPickup: false,
    })!;
    expect(r.days).toBe(2);
  });

  it('dostawa dolicza stałą opłatę', () => {
    const r = computePrice({
      productId: 'ozonmed-pro-10g',
      startDate: '2026-08-01', endDate: '2026-08-02',
      startTime: '09:00', endTime: '09:00',
      delivery: true, weekendPickup: false,
    })!;
    expect(r.deliveryFee).toBe(DELIVERY_FEE);
    expect(r.totalPrice).toBe(25 + DELIVERY_FEE);
  });

  it('odbiór weekendowy dolicza opłatę', () => {
    const r = computePrice({
      productId: 'nt-30-1',
      startDate: '2026-08-01', endDate: '2026-08-02',
      startTime: '09:00', endTime: '09:00',
      delivery: false, weekendPickup: true,
    })!;
    expect(r.weekendPickupFee).toBe(WEEKEND_PICKUP_FEE);
    expect(r.totalPrice).toBe(80 + WEEKEND_PICKUP_FEE);
  });

  it('pakiet piątek-poniedziałek stosuje cenę weekendową', () => {
    const r = computePrice({
      productId: 'puzzi-10-1',
      startDate: '2026-08-07', endDate: '2026-08-10', // piątek -> poniedziałek
      startTime: '09:00', endTime: '09:00',
      delivery: false, weekendPickup: false,
    })!;
    expect(r.days).toBe(3);
    expect(r.basePrice).toBe(150);
  });

  it('jedna doba w piątek nie uruchamia pakietu weekendowego', () => {
    const r = computePrice({
      productId: 'puzzi-10-1',
      startDate: '2026-08-07', endDate: '2026-08-07',
      startTime: '09:00', endTime: '09:00',
      delivery: false, weekendPickup: false,
    })!;
    expect(r.days).toBe(1);
    expect(r.basePrice).toBe(45);
  });

  it('kolejna doba używa osobnej stawki produktu', () => {
    const r = computePrice({
      productId: 'nt-30-1',
      startDate: '2026-08-04', endDate: '2026-08-06',
      startTime: '09:00', endTime: '09:00',
      delivery: false, weekendPickup: false,
    })!;
    expect(r.basePrice).toBe(80 + 60);
  });

  it('nieznany produkt zwraca null', () => {
    expect(computePrice({
      productId: 'xxx',
      startDate: '2026-08-01', endDate: '2026-08-02',
      startTime: '09:00', endTime: '09:00',
      delivery: false, weekendPickup: false,
    })).toBeNull();
  });

  it('minimum 1 doba nawet dla odwróconych dat', () => {
    const r = computePrice({
      productId: 'puzzi-10-1',
      startDate: '2026-08-03', endDate: '2026-08-01',
      startTime: '09:00', endTime: '09:00',
      delivery: false, weekendPickup: false,
    })!;
    expect(r.days).toBe(1); // schema odrzuci taki input wcześniej; wycena ma dolny limit
  });
});

// Overlap rule used in checkDateAvailability / createReservationIfAvailable:
// conflict iff existing.start < new.end AND existing.end > new.start
describe('logika nakładania terminów', () => {
  const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
    aStart < bEnd && aEnd > bStart;

  it('rozłączne terminy nie kolidują', () => {
    expect(overlaps('2026-08-01', '2026-08-03', '2026-08-05', '2026-08-07')).toBe(false);
  });

  it('nakładające się terminy kolidują', () => {
    expect(overlaps('2026-08-01', '2026-08-05', '2026-08-04', '2026-08-07')).toBe(true);
  });

  it('termin zawarty w innym koliduje', () => {
    expect(overlaps('2026-08-01', '2026-08-10', '2026-08-04', '2026-08-05')).toBe(true);
  });

  it('stykające się końce pozwalają na zwrot i odbiór tego samego dnia', () => {
    // istniejąca kończy się 03, nowa zaczyna 03 → brak konfliktu (same-day handover)
    expect(overlaps('2026-08-01', '2026-08-03', '2026-08-03', '2026-08-05')).toBe(false);
  });
});
