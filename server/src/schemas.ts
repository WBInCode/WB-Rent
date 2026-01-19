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

  // Dates
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Nieprawidłowa data rozpoczęcia',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Nieprawidłowa data zakończenia',
  }),
  days: z.number().int().positive('Liczba dni musi być większa od 0'),

  // Delivery
  delivery: z.boolean().default(false),
  city: z.string().max(100, 'Miasto może mieć maksymalnie 100 znaków').optional(),
  address: z.string().max(500, 'Adres może mieć maksymalnie 500 znaków').optional(),
  weekendPickup: z.boolean().default(false),

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

  // Additional
  notes: z.string().max(2000, 'Notatki mogą mieć maksymalnie 2000 znaków').optional(),

  // Price
  totalPrice: z.number().positive('Cena musi być większa od 0'),
}).refine(
  (data) => {
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
