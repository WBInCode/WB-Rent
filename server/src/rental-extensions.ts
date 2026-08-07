/**
 * Przedłużenie najmu przez klienta.
 *
 * Umowa (§5 ust. 3) mówi wprost: przedłużenie wymaga zgody Wynajmującego
 * i zapłaty z góry przed upływem bieżącego okresu; brak zapłaty w terminie
 * oznacza brak skutecznego przedłużenia. Dlatego aneks powstaje od razu, ale
 * wchodzi w życie dopiero po zaksięgowaniu wpłaty — do tego czasu blokuje
 * jedynie sprzęt, żeby nikt nie zajął opłacanego właśnie terminu.
 */
import { z } from 'zod';
import { queries } from './db.js';
import { calculateRentalItemsPrice, reservationProductIds } from './products.js';
import { createPaymentForReservation } from './payments/routes.js';
import { opiszTermin } from './rental-details.js';

/** Ile klient ma na opłacenie aneksu. Po tym czasie sprzęt wraca do puli. */
export const MINUT_NA_PLATNOSC = 60;

export const extensionRequestSchema = z.object({
  newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Podaj datę w formacie RRRR-MM-DD'),
  newEndTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Podaj godzinę w formacie HH:MM').default('09:00'),
});

export type ExtensionRequest = z.infer<typeof extensionRequestSchema>;

const extensionNumberFor = (reservationId: number, kolejny: number) =>
  `WB-R/${new Date().getFullYear()}/${String(reservationId).padStart(6, '0')}/A${kolejny}`;

export type WycenaPrzedluzenia = {
  nowyTermin: ReturnType<typeof opiszTermin>;
  dni: number;
  dotychczasowaKwota: number;
  nowaKwota: number;
  doplata: number;
};

/** Ile kosztowałoby przedłużenie do wskazanej daty — bez zakładania aneksu. */
export async function wycenPrzedluzenie(
  reservationId: number,
  dane: ExtensionRequest
): Promise<{ ok: true; wycena: WycenaPrzedluzenia } | { ok: false; powod: string }> {
  const rezerwacja = await queries.getReservationById(reservationId);
  if (!rezerwacja) return { ok: false, powod: 'Rezerwacja nie istnieje' };

  if (!['confirmed', 'picked_up'].includes(rezerwacja.status)) {
    return { ok: false, powod: 'Przedłużyć można tylko trwający najem' };
  }
  if (rezerwacja.is_indefinite) {
    return { ok: false, powod: 'Najem bezterminowy trwa do odwołania — nie wymaga przedłużania' };
  }

  const obecnyKoniec = rezerwacja.end_date ? String(rezerwacja.end_date).slice(0, 10) : null;
  if (!obecnyKoniec) return { ok: false, powod: 'Ta rezerwacja nie ma ustalonego terminu zwrotu' };

  const obecnyKoniecMs = Date.parse(`${obecnyKoniec}T${rezerwacja.end_time || '09:00'}`);
  const nowyKoniecMs = Date.parse(`${dane.newEndDate}T${dane.newEndTime}`);
  if (Number.isNaN(nowyKoniecMs)) return { ok: false, powod: 'Nieprawidłowa data zwrotu' };
  if (nowyKoniecMs <= obecnyKoniecMs) {
    return { ok: false, powod: 'Nowy termin musi być późniejszy niż obecny termin zwrotu' };
  }

  const start = String(rezerwacja.start_date).slice(0, 10);
  const roznicaDni = Math.round((Date.parse(dane.newEndDate) - Date.parse(start)) / 86_400_000);
  const [gs, ms] = String(rezerwacja.start_time || '09:00').split(':').map(Number);
  const [gk, mk] = dane.newEndTime.split(':').map(Number);
  const dni = Math.max(1, roznicaDni + (gk * 60 + mk > gs * 60 + ms ? 1 : 0));

  const pickupDay = new Date(`${start}T12:00:00`).getDay();
  const wycena = calculateRentalItemsPrice(reservationProductIds(rezerwacja), dni, pickupDay === 5 && dni === 3);
  if (!wycena) return { ok: false, powod: 'Nie udało się przeliczyć ceny' };

  // Opłaty stałe (dostawa, weekend) już zapłacone — przedłużenie zmienia sam czynsz.
  const oplatyStale = Number(rezerwacja.total_price) - Number(rezerwacja.base_price);
  const nowaKwota = Math.round((wycena.basePrice + oplatyStale) * 100) / 100;
  const doplata = Math.round((nowaKwota - Number(rezerwacja.total_price)) * 100) / 100;

  if (doplata <= 0) return { ok: false, powod: 'Ten termin nie wymaga dopłaty — skontaktuj się z nami' };

  return {
    ok: true,
    wycena: {
      nowyTermin: opiszTermin(dane.newEndDate, dane.newEndTime),
      dni,
      dotychczasowaKwota: Number(rezerwacja.total_price),
      nowaKwota,
      doplata,
    },
  };
}

/**
 * Zakłada aneks i uruchamia płatność. Sprzęt jest zablokowany do czasu zapłaty
 * albo wygaśnięcia terminu — dzięki temu klient nie płaci za termin, który
 * w międzyczasie ktoś zajął.
 */
export async function rozpocznijPrzedluzenie(
  reservationId: number,
  dane: ExtensionRequest,
  customerIp: string
) {
  const wycena = await wycenPrzedluzenie(reservationId, dane);
  if (!wycena.ok) return { ok: false as const, powod: wycena.powod };

  const rezerwacja = await queries.getReservationById(reservationId);
  const dotychczasowe = await queries.getExtensionsForReservation(reservationId);
  const numer = extensionNumberFor(reservationId, dotychczasowe.length + 1);

  const wynik = await queries.createRentalExtension({
    reservationId,
    number: numer,
    newEndDate: dane.newEndDate,
    newEndTime: dane.newEndTime,
    newDays: wycena.wycena.dni,
    newBasePrice: Math.round((wycena.wycena.nowaKwota - (Number(rezerwacja.total_price) - Number(rezerwacja.base_price))) * 100) / 100,
    newTotal: wycena.wycena.nowaKwota,
    surcharge: wycena.wycena.doplata,
    minutNaPlatnosc: MINUT_NA_PLATNOSC,
  });

  if (wynik.blocked) return { ok: false as const, powod: wynik.blocked };
  if (wynik.conflicts) {
    return {
      ok: false as const,
      powod: 'Sprzęt jest już zarezerwowany na ten termin. Wybierz wcześniejszą datę albo zadzwoń: 570 038 828.',
    };
  }

  const platnosc = await createPaymentForReservation(rezerwacja, customerIp, {
    kind: 'settlement',
    amount: wycena.wycena.doplata,
    label: `Przedłużenie najmu do ${dane.newEndDate} (aneks ${numer})`,
  });

  if (!platnosc) {
    return {
      ok: false as const,
      powod: 'Płatności online są chwilowo niedostępne. Zadzwoń: 570 038 828, a przedłużymy najem ręcznie.',
    };
  }

  await queries.attachExtensionPayment(wynik.extension.id, platnosc.sessionId);

  return {
    ok: true as const,
    aneks: { numer, id: wynik.extension.id },
    wycena: wycena.wycena,
    platnosc,
    wygasa: wynik.extension.expires_at,
  };
}

/** Wywoływane po zaksięgowaniu wpłaty — dopiero teraz aneks wiąże Strony. */
export async function aktywujPrzedluzenie(sessionId: string) {
  return queries.activateRentalExtension(sessionId);
}
