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
import fs from 'node:fs/promises';
import path from 'node:path';
import { queries } from './db.js';
import { calculateRentalItemsPrice, reservationProductIds, reservationProductNames } from './products.js';
import { createPaymentForReservation } from './payments/routes.js';
import { opiszTermin } from './rental-details.js';
import { config } from './config.js';
import { generateExtensionAnnexPdf } from './contracts/extension-pdf.js';
import { encryptContractData, decryptContractData, sha256 } from './contracts/crypto.js';

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

/**
 * Wywoływane po zaksięgowaniu wpłaty — dopiero teraz aneks wiąże Strony.
 * Aneks nie ma interaktywnego podpisu (§5 ust. 3: wchodzi w życie automatycznie
 * z chwilą wpłaty), więc PDF generuje się od razu, bez ekranu podpisu.
 */
export async function aktywujPrzedluzenie(sessionId: string) {
  const aktywowany = await queries.activateRentalExtension(sessionId);
  if (!aktywowany) return null;

  try {
    const kontrakt = await queries.getContractByReservationId(aktywowany.reservation.id);
    const pdf = await generateExtensionAnnexPdf({
      number: aktywowany.extension.number,
      contractNumber: kontrakt?.contract_number ?? null,
      renterName: aktywowany.reservation.name,
      productNames: reservationProductNames(aktywowany.reservation),
      previousEndDate: String(aktywowany.extension.previous_end_date),
      previousEndTime: String(aktywowany.extension.previous_end_time || '09:00'),
      previousTotal: Number(aktywowany.extension.previous_total),
      newEndDate: String(aktywowany.extension.new_end_date),
      newEndTime: String(aktywowany.extension.new_end_time),
      newTotal: Number(aktywowany.extension.new_total),
      surcharge: Number(aktywowany.extension.surcharge),
      paidAt: new Date(aktywowany.extension.paid_at).toISOString(),
      paymentSessionId: sessionId,
    });
    const pdfHash = sha256(pdf);
    const storageDir = path.resolve(config.contracts.storageDir);
    await fs.mkdir(storageDir, { recursive: true });
    const pdfPath = path.join(storageDir, `aneks-${aktywowany.extension.id}-${pdfHash.slice(0, 16)}.pdf.enc`);
    await fs.writeFile(pdfPath, encryptContractData(pdf), { mode: 0o600 });
    await queries.attachExtensionPdf(aktywowany.extension.id, pdfPath, pdfHash);
    await queries.registerContractDocument({
      title: `Aneks ${aktywowany.extension.number}`,
      reservationId: aktywowany.reservation.id,
      customerEmail: aktywowany.reservation.email || '',
      documentDate: new Date(aktywowany.extension.paid_at).toISOString().slice(0, 10),
      fileName: `aneks-${aktywowany.extension.number.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
      filePath: pdfPath,
      sizeBytes: pdf.length,
      fileHash: pdfHash,
      notes: 'Aneks przedłużenia wygenerowany automatycznie po zaksięgowaniu wpłaty.',
    }).catch((error) => console.error('Register extension document error:', error));

    return { ...aktywowany, pdf: { buffer: pdf, path: pdfPath, hash: pdfHash } };
  } catch (error) {
    // PDF to dowód dodatkowy — aneks juz wiaze Strony przez sama platnosc (§5 ust. 3),
    // wiec blad generowania nie moze cofnac aktywacji, ktora juz przeszla w DB.
    console.error('Nie udało się wygenerować PDF aneksu:', error);
    return { ...aktywowany, pdf: null };
  }
}

/** Pobranie aneksu przez klienta — kontroler wywołujący musi wcześniej zweryfikować, że aneks należy do tej rezerwacji. */
export async function odczytajAneksPdf(reservationId: number, extensionId: number) {
  const aneks = await queries.getExtensionForReservation(reservationId, extensionId);
  if (!aneks || !aneks.pdf_path) return null;
  return {
    buffer: decryptContractData(await fs.readFile(aneks.pdf_path, 'utf8')),
    filename: `aneks-${String(aneks.number).replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
  };
}
