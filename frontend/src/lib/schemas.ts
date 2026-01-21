import { z } from 'zod';

// Reservation form schema
export const reservationSchema = z.object({
  // Product selection
  categoryId: z.string().min(1, 'Wybierz kategorię'),
  productId: z.string().min(1, 'Wybierz produkt'),
  
  // Dates
  startDate: z.string().min(1, 'Wybierz datę rozpoczęcia'),
  endDate: z.string().min(1, 'Wybierz datę zakończenia'),
  
  // Times
  startTime: z.string().min(1, 'Wybierz godzinę odbioru'),
  endTime: z.string().min(1, 'Wybierz godzinę zwrotu'),
  
  // Delivery
  delivery: z.boolean(),
  city: z.string().optional(),
  address: z.string().optional(),
  weekendPickup: z.boolean(),
  
  // Contact
  firstName: z.string().min(2, 'Imię musi mieć min. 2 znaki'),
  lastName: z.string().min(2, 'Nazwisko musi mieć min. 2 znaki'),
  email: z.string().email('Podaj prawidłowy adres email'),
  phone: z.string()
    .min(9, 'Numer telefonu musi mieć min. 9 cyfr')
    .regex(/^[0-9+\s-]+$/, 'Nieprawidłowy format numeru telefonu'),
  company: z.string().optional(),
  
  // Additional
  notes: z.string().optional(),
  acceptTerms: z.literal(true, {
    message: 'Musisz zaakceptować regulamin',
  }),
  acceptRodo: z.literal(true, {
    message: 'Musisz wyrazić zgodę na przetwarzanie danych',
  }),
}).refine((data) => {
  // Validate delivery address if delivery is selected
  if (data.delivery) {
    return data.city && data.city.length >= 2 && data.address && data.address.length >= 5;
  }
  return true;
}, {
  message: 'Podaj miasto i adres dostawy',
  path: ['address'],
}).refine((data) => {
  // Validate date range
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Data zakończenia musi być po dacie rozpoczęcia',
  path: ['endDate'],
});

export type ReservationFormData = z.infer<typeof reservationSchema>;

// Contact form schema
export const contactSchema = z.object({
  name: z.string().min(2, 'Imię musi mieć min. 2 znaki'),
  email: z.string().email('Podaj prawidłowy adres email'),
  subject: z.string().optional(),
  message: z.string().min(10, 'Wiadomość musi mieć min. 10 znaków'),
  honeypot: z.string().max(0, 'Bot detected'), // Anti-spam
});

export type ContactFormData = z.infer<typeof contactSchema>;
