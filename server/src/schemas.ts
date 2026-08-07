import { z } from 'zod';

// === CONTACT SCHEMA ===
export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Imię musi mieć minimum 2 znaki')
    .max(100, 'Imię może mieć maksymalnie 100 znaków'),
  email: z
    .string()
    .email('Nieprawidłowy adres email')
    .max(255, 'Email może mieć maksymalnie 255 znaków'),
  subject: z
    .string()
    .max(200, 'Temat może mieć maksymalnie 200 znaków')
    .optional(),
  message: z
    .string()
    .min(10, 'Wiadomość musi mieć minimum 10 znaków')
    .max(5000, 'Wiadomość może mieć maksymalnie 5000 znaków'),
  // Honeypot field - should be empty
  website: z.string().max(0).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

// === RESERVATION SCHEMA ===
export const reservationSchema = z.object({
  // Product
  categoryId: z.string().min(1, 'Wybierz kategorię'),
  productId: z.string().min(1, 'Wybierz urządzenie'),
  productName: z.string().min(1, 'Nazwa produktu jest wymagana'),
  productIds: z.array(z.string().min(1))
    .min(1, 'Wybierz co najmniej jedno urządzenie')
    .max(11, 'Możesz dodać maksymalnie 11 urządzeń')
    .refine((ids) => new Set(ids).size === ids.length, 'Każde urządzenie można dodać tylko raz')
    .optional(),

  // Dates
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Nieprawidłowa data rozpoczęcia',
  }),
  endDate: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Nieprawidłowa data zakończenia',
  }).optional().default(''),
  isIndefinite: z.boolean().default(false),
  
  // Times (pickup/return hours)
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Nieprawidłowy format godziny odbioru (HH:MM)',
  }),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Nieprawidłowy format godziny zwrotu (HH:MM)',
  }),
  
  days: z.number().int().positive('Liczba dni musi być większa od 0'),

  // Delivery
  // Dowóz i odbiór to dwa niezależne kursy; `delivery` zostaje dla zgodności
  // ze starszymi klientami i oznacza „oba kursy".
  delivery: z.boolean().default(false),
  deliveryOut: z.boolean().optional(),
  deliveryBack: z.boolean().optional(),
  city: z.string().max(100, 'Miasto może mieć maksymalnie 100 znaków').optional(),
  postalCode: z.string().max(10, 'Kod pocztowy może mieć maksymalnie 10 znaków').optional(),
  address: z.string().max(500, 'Adres może mieć maksymalnie 500 znaków').optional(),
  weekendPickup: z.boolean().default(false),

  // Płatne dodatki (worek, środek czyszczący). Przeglądarka przysyła sam wybór —
  // cenę ustala serwer z katalogu, więc nie da się jej podmienić w żądaniu.
  addons: z.array(z.object({
    id: z.string().trim().min(1).max(60),
    quantity: z.number().int().min(1).max(50),
  })).max(20, 'Możesz zamówić maksymalnie 20 dodatków').default([]),

  // Customer
  firstName: z
    .string()
    .min(2, 'Imię musi mieć minimum 2 znaki')
    .max(100, 'Imię może mieć maksymalnie 100 znaków'),
  lastName: z
    .string()
    .min(2, 'Nazwisko musi mieć minimum 2 znaki')
    .max(100, 'Nazwisko może mieć maksymalnie 100 znaków'),
  email: z
    .string()
    .email('Nieprawidłowy adres email')
    .max(255, 'Email może mieć maksymalnie 255 znaków'),
  phone: z
    .string()
    .min(9, 'Numer telefonu musi mieć minimum 9 znaków')
    .max(20, 'Numer telefonu może mieć maksymalnie 20 znaków')
    .regex(/^[+]?[\d\s-]+$/, 'Nieprawidłowy format numeru telefonu'),
  company: z
    .string()
    .max(200, 'Nazwa firmy może mieć maksymalnie 200 znaków')
    .optional(),

  // Invoice
  wantsInvoice: z.boolean().default(false),
  invoiceNip: z
    .string()
    .max(20, 'NIP może mieć maksymalnie 20 znaków')
    .optional(),
  invoiceCompany: z
    .string()
    .max(200, 'Nazwa firmy może mieć maksymalnie 200 znaków')
    .optional(),
  invoiceAddress: z
    .string()
    .max(500, 'Adres firmy może mieć maksymalnie 500 znaków')
    .optional(),

  // Additional
  notes: z.string().max(2000, 'Notatki mogą mieć maksymalnie 2000 znaków').optional(),

  // Discount
  couponCode: z
    .string()
    .trim()
    .max(32, 'Kod kuponu może mieć maksymalnie 32 znaki')
    .regex(/^[A-Za-z0-9-]*$/, 'Kod kuponu zawiera niedozwolone znaki')
    .transform((value) => value.toUpperCase())
    .optional(),

  // Staff-only pricing. Honoured exclusively for requests carrying a valid
  // admin token - see POST /api/reservations.
  staffPricing: z.object({
    priceOverride: z.number().min(0, 'Cena nie może być ujemna').max(100000).optional(),
    discountAmount: z.number().min(0, 'Rabat nie może być ujemny').max(100000).optional(),
    note: z.string().trim().max(300, 'Uzasadnienie może mieć maksymalnie 300 znaków').default(''),
    setBy: z.string().trim().max(150).default(''),
  }).optional(),

  // Price
  totalPrice: z.number().positive('Cena musi być większa od 0'),
}).refine(
  (data) => {
    if (data.isIndefinite) return true;
    if (!data.endDate) return false;
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
  },
  {
    message: 'Data zakończenia musi być późniejsza lub równa dacie rozpoczęcia',
    path: ['endDate'],
  }
).refine(
  (data) => {
    if (data.delivery && (!data.city || data.city.trim().length < 2)) {
      return false;
    }
    return true;
  },
  {
    message: 'Podaj miasto dostawy',
    path: ['city'],
  }
).refine(
  (data) => {
    if (data.delivery && (!data.address || data.address.trim().length < 5)) {
      return false;
    }
    return true;
  },
  {
    message: 'Podaj adres dostawy',
    path: ['address'],
  }
);

export type ReservationInput = z.infer<typeof reservationSchema>;

export const productInventorySchema = z.object({
  id: z.string()
    .trim()
    .min(2, 'ID produktu musi mieć co najmniej 2 znaki')
    .max(80, 'ID produktu może mieć maksymalnie 80 znaków')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ID może zawierać małe litery, cyfry i myślniki'),
  name: z.string().trim().min(3, 'Podaj nazwę produktu').max(200),
  description: z.string().trim().max(1000).default(''),
  categoryId: z.string().trim().min(1, 'Wybierz kategorię').max(80),
  image: z.string().trim().max(500).refine(
    (url) => url.startsWith('/') || /^https?:\/\//i.test(url),
    'Zdjęcie musi być ścieżką lokalną lub adresem HTTP(S)'
  ).default('/favicon.svg'),
  images: z.array(z.string().trim().min(1).max(500).refine(
    (url) => url.startsWith('/') || /^https?:\/\//i.test(url),
    'Zdjęcie musi być ścieżką lokalną lub adresem HTTP(S)'
  ))
    .min(1, 'Produkt musi mieć co najmniej jedno zdjęcie')
    .max(12, 'Możesz dodać maksymalnie 12 zdjęć')
    .refine((images) => new Set(images).size === images.length, 'Każde zdjęcie może wystąpić tylko raz')
    .optional(),
  pricePerDay: z.number().min(0, 'Cena nie może być ujemna').max(100000),
  priceNextDay: z.number().min(0, 'Cena nie może być ujemna').max(100000),
  priceWeekend: z.number().min(0, 'Cena nie może być ujemna').max(100000),
  totalQuantity: z.number().int().min(0).max(10000),
  serviceQuantity: z.number().int().min(0).max(10000),
  conditionStatus: z.enum(['good', 'attention', 'service', 'damaged']),
  inventoryNotes: z.string().trim().max(2000).default(''),
  features: z.array(z.string().trim().min(1).max(120))
    .max(12, 'Możesz dodać maksymalnie 12 cech')
    .default([]),
  includedAccessories: z.array(z.string().trim().min(1).max(160))
    .max(12, 'Możesz dodać maksymalnie 12 pozycji')
    .default([]),
  // Każdy dodatek ma własną cenę — worek i środek czyszczący nie kosztują tyle
  // samo. Zapis tekstowy przyjmujemy dla starszych zapisów w bazie.
  optionalAccessories: z.array(z.union([
    z.string().trim().min(1).max(160),
    z.object({
      nazwa: z.string().trim().min(1).max(160),
      cena: z.number().min(0, 'Cena nie może być ujemna').max(100000).default(0),
    }),
  ]))
    .max(12, 'Możesz dodać maksymalnie 12 pozycji')
    .default([]),
  accessoryPrice: z.number().min(0, 'Cena nie może być ujemna').max(100000).default(0),
  isActive: z.boolean(),
}).refine((data) => data.serviceQuantity <= data.totalQuantity, {
  message: 'Liczba sztuk w serwisie nie może przekraczać stanu całkowitego',
  path: ['serviceQuantity'],
}).transform((data) => {
  const images = data.images?.length ? data.images : [data.image];
  return { ...data, image: images[0], images };
});

export type ProductInventoryInput = z.infer<typeof productInventorySchema>;

// === NEWSLETTER SUBSCRIBER SCHEMA ===
export const newsletterSubscribeSchema = z.object({
  email: z
    .string()
    .email('Nieprawidłowy adres email')
    .max(255, 'Email może mieć maksymalnie 255 znaków'),
  name: z
    .string()
    .max(100, 'Imię może mieć maksymalnie 100 znaków')
    .optional(),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;

// === NEWSLETTER POST SCHEMA ===
export const newsletterPostSchema = z.object({
  title: z
    .string()
    .min(3, 'Tytuł musi mieć minimum 3 znaki')
    .max(200, 'Tytuł może mieć maksymalnie 200 znaków'),
  content: z
    .string()
    .min(10, 'Treść musi mieć minimum 10 znaków')
    .max(10000, 'Treść może mieć maksymalnie 10000 znaków'),
  status: z.enum(['draft', 'sent']).default('draft'),
});

export type NewsletterPostInput = z.infer<typeof newsletterPostSchema>;

// === PRODUCT NOTIFICATION SCHEMA ===
export const productNotificationSchema = z.object({
  productId: z.string().min(1, 'ID produktu jest wymagane'),
  email: z
    .string()
    .email('Nieprawidłowy adres email')
    .max(255, 'Email może mieć maksymalnie 255 znaków'),
});

export type ProductNotificationInput = z.infer<typeof productNotificationSchema>;

// === DOCUMENT ARCHIVE SCHEMAS ===
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data musi być w formacie RRRR-MM-DD')
  .optional()
  .nullable()
  .transform((value) => value || null);

const documentCategories = ['contract', 'invoice', 'protocol', 'identity', 'insurance', 'service', 'other'] as const;

export const documentMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Tytuł musi mieć minimum 2 znaki')
    .max(200, 'Tytuł może mieć maksymalnie 200 znaków'),
  category: z.enum(documentCategories).default('other'),
  reservationId: z.coerce.number().int().positive().optional().nullable()
    .transform((value) => value ?? null),
  customerEmail: z
    .string()
    .trim()
    .max(255, 'Email może mieć maksymalnie 255 znaków')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Nieprawidłowy adres email')
    .default(''),
  documentDate: optionalDate,
  notes: z.string().trim().max(2000, 'Notatka może mieć maksymalnie 2000 znaków').default(''),
});

export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;

// === DISCOUNT SCHEMA ===
export const discountSchema = z.object({
  name: z.string().trim().min(2, 'Nazwa musi mieć minimum 2 znaki').max(120, 'Nazwa może mieć maksymalnie 120 znaków'),
  description: z.string().trim().max(500, 'Opis może mieć maksymalnie 500 znaków').default(''),
  discountType: z.enum(['percent', 'amount']),
  value: z.number().positive('Wartość rabatu musi być większa od 0'),
  scope: z.enum(['all', 'category', 'product']).default('all'),
  scopeValue: z.string().trim().max(80).default(''),
  minDays: z.number().int().min(1, 'Minimalna liczba dni to 1').max(365).default(1),
  minTotal: z.number().min(0, 'Minimalna kwota nie może być ujemna').default(0),
  startsOn: optionalDate,
  endsOn: optionalDate,
  isActive: z.boolean().default(true),
})
  .refine((data) => data.discountType !== 'percent' || data.value <= 100, {
    message: 'Rabat procentowy nie może przekraczać 100%',
    path: ['value'],
  })
  .refine((data) => data.scope === 'all' || data.scopeValue.length > 0, {
    message: 'Wskaż kategorię lub produkt, którego dotyczy rabat',
    path: ['scopeValue'],
  })
  .refine((data) => !data.startsOn || !data.endsOn || data.endsOn >= data.startsOn, {
    message: 'Data zakończenia musi być późniejsza niż data rozpoczęcia',
    path: ['endsOn'],
  });

export type DiscountInput = z.infer<typeof discountSchema>;

// === COUPON SCHEMAS ===
export const couponCreateSchema = z.object({
  discountType: z.enum(['percent', 'amount']),
  value: z.number().positive('Wartość kuponu musi być większa od 0'),
  customerEmail: z
    .string()
    .trim()
    .max(255)
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Nieprawidłowy adres email')
    .default(''),
  customerName: z.string().trim().max(150).default(''),
  minTotal: z.number().min(0).default(0),
  validDays: z.number().int().min(1, 'Kupon musi być ważny minimum 1 dzień').max(730).default(180),
  issuedForReservationId: z.number().int().positive().optional().nullable()
    .transform((value) => value ?? null),
  note: z.string().trim().max(500).default(''),
  sendEmail: z.boolean().default(false),
})
  .refine((data) => data.discountType !== 'percent' || data.value <= 100, {
    message: 'Rabat procentowy nie może przekraczać 100%',
    path: ['value'],
  })
  .refine((data) => !data.sendEmail || data.customerEmail.length > 0, {
    message: 'Podaj adres email, aby wysłać kupon',
    path: ['customerEmail'],
  });

export type CouponCreateInput = z.infer<typeof couponCreateSchema>;

export const couponValidateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'Kod kuponu jest za krótki')
    .max(32, 'Kod kuponu jest za długi')
    .regex(/^[A-Za-z0-9-]+$/, 'Kod kuponu zawiera niedozwolone znaki')
    .transform((value) => value.toUpperCase()),
  basePrice: z.number().min(0).default(0),
});

export type CouponValidateInput = z.infer<typeof couponValidateSchema>;

// === BUSINESS SETTINGS SCHEMA ===
// `prefault` (not `default`) so an absent group is filled in *before* parsing,
// letting every nested field apply its own default.
export const businessSettingsSchema = z.object({
  company: z.object({
    name: z.string().trim().max(150).default(''),
    nip: z.string().trim().max(20).default(''),
    regon: z.string().trim().max(20).default(''),
    address: z.string().trim().max(200).default(''),
    postalCode: z.string().trim().max(10).default(''),
    city: z.string().trim().max(100).default(''),
    bankAccount: z.string().trim().max(40).default(''),
  }).prefault({}),
  contact: z.object({
    phone: z.string().trim().max(30).default(''),
    email: z.string().trim().max(255).default(''),
    openingHours: z.string().trim().max(200).default(''),
    mapUrl: z.string().trim().max(500).default(''),
  }).prefault({}),
  rental: z.object({
    deliveryFee: z.number().min(0).max(10000).default(40),
    weekendPickupFee: z.number().min(0).max(10000).default(30),
    freeDeliveryFrom: z.number().min(0).max(100000).default(0),
    depositDefault: z.number().min(0).max(100000).default(0),
    minRentalDays: z.number().int().min(1).max(365).default(1),
    maxRentalDays: z.number().int().min(1).max(365).default(90),
    maxDeliveryKm: z.number().int().min(0).max(1000).default(50),
  }).prefault({}),
  coupons: z.object({
    defaultValidDays: z.number().int().min(1).max(730).default(180),
    defaultType: z.enum(['percent', 'amount']).default('percent'),
    defaultValue: z.number().positive().max(10000).default(10),
    autoIssueOnReturn: z.boolean().default(false),
    termsText: z.string().trim().max(1000).default(''),
  }).prefault({}),
  notifications: z.object({
    notifyOnReservation: z.boolean().default(true),
    notifyOnContractSigned: z.boolean().default(true),
    pickupReminderHours: z.number().int().min(1).max(168).default(24),
    returnReminderHours: z.number().int().min(1).max(168).default(24),
  }).prefault({}),
  documents: z.object({
    retentionMonths: z.number().int().min(1).max(240).default(60),
  }).prefault({}),
});

export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
