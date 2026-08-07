import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from './config.js';
import { unsubscribeToken } from './auth.js';
import { rozpiszKoszty, zloty, type RozpisKosztow } from './costs.js';
import { opiszTermin, opiszMiejsca } from './rental-details.js';
import type { ContactInput, ReservationInput } from './schemas.js';

// Initialize Resend if API key is provided
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Create SMTP transporter (fallback)
const createTransporter = () => {
  // If Resend is configured, skip SMTP
  if (resend) {
    console.log('📧 Email: Using Resend API');
    return null;
  }
  
  // If no SMTP configured, use console logging
  if (!config.smtp.host) {
    console.log('📧 Email: Using console logging (no SMTP configured)');
    return null;
  }

  console.log(`📧 Email: SMTP configured (${config.smtp.host}:${config.smtp.port})`);
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    // Local relays and mail catchers accept mail without credentials.
    auth: config.smtp.user && config.smtp.pass
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
};

const transporter = createTransporter();

// Log email to console (dev mode)
const logEmail = (to: string, subject: string, html: string) => {
  console.log('\n📧 ═══════════════════════════════════════');
  console.log(`📧 TO: ${to}`);
  console.log(`📧 SUBJECT: ${subject}`);
  console.log('📧 ═══════════════════════════════════════');
  console.log(html.replace(/<[^>]*>/g, '')); // Strip HTML for console
  console.log('📧 ═══════════════════════════════════════\n');
};

// === HTML ESCAPING (anti-injection) ===
// User-provided strings MUST be escaped before interpolation into HTML templates.
const esc = (value: string | null | undefined): string => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/** Returns a shallow copy with the given string fields HTML-escaped. */
const escFields = <T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T => {
  const copy: Record<string, unknown> = { ...obj };
  for (const f of fields) {
    if (typeof copy[f as string] === 'string') {
      copy[f as string] = esc(copy[f as string] as string);
    }
  }
  return copy as T;
};

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailSendResult {
  success: boolean;
  delivered: boolean;
  transport: 'resend' | 'smtp' | 'console';
  messageId?: string;
  error?: unknown;
}

/**
 * Wersja tekstowa wiadomosci.
 *
 * Mail bez alternatywy text/plain to jeden z najsilniejszych sygnalow spamu w
 * filtrach (SpamAssassin: MIME_HTML_ONLY). Wynajmujemy sprzet, wiec kazda
 * wiadomosc musi dotrzec - dlatego kazdy mail idzie jako multipart.
 */
const tekstZHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, url, tekst) => {
      const czysty = String(tekst).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return czysty && !String(url).includes(czysty) ? `${czysty}: ${url}` : String(url);
    })
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>\s*<td[^>]*>/gi, ': ')
    .replace(/<hr[^>]*>/gi, '\n----------------------------------------\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Send email (tries Resend first, then SMTP, then console)
const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  attachments: EmailAttachment[] = []
): Promise<EmailSendResult> => {
  const fromEmail = process.env.RESEND_FROM || config.smtp.from || 'WB-Rent <noreply@wb-rent.pl>';
  const text = tekstZHtml(html);

  // Try Resend first
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject,
        html,
        text,
        attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
        })),
      });
      
      if (error) {
        console.error('❌ Resend error:', error);
        return { success: false, delivered: false, transport: 'resend', error };
      }
      
      console.log(`📧 Email sent via Resend to ${to}`);
      return { success: true, delivered: true, transport: 'resend', messageId: data?.id };
    } catch (error) {
      console.error('❌ Resend error:', error);
      return { success: false, delivered: false, transport: 'resend', error };
    }
  }
  
  // Try SMTP
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: config.smtp.from,
        to,
        subject,
        html,
        text,
        attachments,
      });
      console.log(`📧 Email sent via SMTP to ${to}`);
      return { success: true, delivered: true, transport: 'smtp', messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email send error:', error);
      return { success: false, delivered: false, transport: 'smtp', error };
    }
  }
  
  // Fallback to console
  logEmail(to, subject, html);
  console.warn(`📧 Email NOT delivered to ${to}: no SMTP/Resend transport configured`);
  return {
    success: false,
    delivered: false,
    transport: 'console',
    messageId: 'console-preview',
    error: new Error('Email transport is not configured'),
  };
};

// === EMAIL TEMPLATES ===

/**
 * Rozpis kosztow w mailu - te same pozycje co w panelu, umowie i strefie klienta.
 * Klient musi widziec, z czego sklada sie suma, a nie samo "SUMA: 120 zł".
 */
export const blokKosztow = (rozpis: RozpisKosztow, naglowek = 'Podsumowanie kosztów'): string => {
  const wiersz = (etykieta: string, opis: string | undefined, kwota: number) => `
    <tr>
      <td style="padding: 7px 0; color: #d4d4d8; border-bottom: 1px solid #2a2a2a;">
        ${esc(etykieta)}${opis ? `<br><span style="color: #a1a1aa; font-size: 12px;">${esc(opis)}</span>` : ''}
      </td>
      <td style="padding: 7px 0; text-align: right; white-space: nowrap; border-bottom: 1px solid #2a2a2a; color: ${kwota < 0 ? '#4ade80' : '#ffffff'};">
        ${esc(zloty(kwota))}
      </td>
    </tr>`;

  return `
    <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h4 style="color: #b8972a; margin: 0 0 12px 0;">${esc(naglowek)}</h4>
      <table style="width: 100%; color: #ffffff; border-collapse: collapse;">
        ${rozpis.pozycje.map((p) => wiersz(p.etykieta, p.opis, p.kwota)).join('')}
        ${rozpis.korektaReczna ? wiersz(rozpis.korektaReczna.powod, 'korekta ceny', rozpis.korektaReczna.kwota) : ''}
        <tr>
          <td style="padding: 12px 0 0; font-weight: bold; font-size: 17px;">Razem do zapłaty</td>
          <td style="padding: 12px 0 0; text-align: right; font-weight: bold; font-size: 17px; color: #b8972a; white-space: nowrap;">${esc(zloty(rozpis.suma))}</td>
        </tr>
      </table>
      ${rozpis.kaucja > 0 ? `
      <p style="color: #a1a1aa; font-size: 12px; margin: 12px 0 0;">
        Dodatkowo kaucja zwrotna ${esc(zloty(rozpis.kaucja))} — zwracamy ją po oddaniu sprzętu bez uszkodzeń.
      </p>` : ''}
    </div>`;
};

/** Termin i miejsca - z dniem tygodnia i pelnym adresem, bez zgadywania. */
export const blokTerminu = (rezerwacja: {
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  start_time?: string | null;
  startTime?: string | null;
  end_time?: string | null;
  endTime?: string | null;
  delivery?: number | boolean | null;
  address?: string | null;
  city?: string | null;
}): string => {
  const odbior = opiszTermin(rezerwacja.start_date ?? rezerwacja.startDate, rezerwacja.start_time ?? rezerwacja.startTime);
  const zwrot = opiszTermin(rezerwacja.end_date ?? rezerwacja.endDate, rezerwacja.end_time ?? rezerwacja.endTime);
  const miejsca = opiszMiejsca(rezerwacja);

  const sekcja = (tytul: string, termin: typeof odbior, miejsce: { tryb: string; adres: string }) => `
    <td style="vertical-align: top; padding: 0 8px 0 0; width: 50%;">
      <p style="margin: 0 0 4px; color: #b8972a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${esc(tytul)}</p>
      <p style="margin: 0 0 2px; color: #ffffff; font-size: 15px; font-weight: bold;">
        ${termin ? esc(`${termin.dzienTygodnia}, ${termin.dataSlownie}`) : 'do ustalenia'}
      </p>
      ${termin?.godzina ? `<p style="margin: 0 0 8px; color: #ffffff;">godz. ${esc(termin.godzina)}</p>` : '<div style="height: 8px;"></div>'}
      <p style="margin: 0; color: #a1a1aa; font-size: 12px;">${esc(miejsce.tryb)}</p>
      <p style="margin: 2px 0 0; color: #d4d4d8; font-size: 13px;">${esc(miejsce.adres)}</p>
    </td>`;

  return `
    <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          ${sekcja('Odbiór sprzętu', odbior, miejsca.odbior)}
          ${sekcja('Zwrot sprzętu', zwrot, miejsca.zwrot)}
        </tr>
      </table>
    </div>`;
};

export const sendContactConfirmation = async (data: ContactInput) => {
  data = escFields(data, ['name', 'message', 'subject']);
  const subject = 'Potwierdzenie wiadomości - WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">Dziękujemy za kontakt!</h2>
      <p>Cześć <strong>${data.name}</strong>,</p>
      <p>Otrzymaliśmy Twoją wiadomość i odpowiemy najszybciej jak to możliwe.</p>
      
      <div style="background: #1a1a1a; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #a1a1aa;">Twoja wiadomość:</p>
        <p style="margin: 10px 0 0; white-space: pre-wrap;">${data.message}</p>
      </div>
      
      <p style="color: #71717a; font-size: 14px;">
        Pozdrawiamy,<br>
        Zespół WB-Rent
      </p>
    </div>
  `;

  return sendEmail(data.email, subject, html);
};

export const sendContactNotification = async (data: ContactInput) => {
  const subject = `Nowa wiadomość kontaktowa: ${data.subject || 'Brak tematu'}`;
  data = escFields(data, ['name', 'email', 'message', 'subject']);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">Nowa wiadomość kontaktowa</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Imię:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Email:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Temat:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.subject || '-'}</td>
        </tr>
      </table>
      
      <div style="background: #1a1a1a; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #a1a1aa;">Wiadomość:</p>
        <p style="margin: 10px 0 0; white-space: pre-wrap;">${data.message}</p>
      </div>
    </div>
  `;

  return sendEmail(config.adminEmail, subject, html);
};

export const sendReservationConfirmation = async (
  data: ReservationInput & { 
    days: number; 
    basePrice: number; 
    deliveryFee: number; 
    weekendFee?: number;
    discountAmount?: number;
    discountLabel?: string;
    discountCode?: string | null;
    totalPrice: number;
    productName: string;
  }
) => {
  data = escFields(data, ['firstName', 'lastName', 'productName', 'city', 'address', 'company', 'notes']);
  const rozpis = rozpiszKoszty({
    days: data.days,
    base_price: data.basePrice,
    delivery_fee: data.deliveryFee,
    weekend_fee: data.weekendFee ?? 0,
    total_price: data.totalPrice,
    discount_amount: data.discountAmount ?? 0,
    discount_label: data.discountLabel ?? null,
    discount_code: data.discountCode ?? null,
  });
  const subject = 'Rezerwacja przyjęta — czeka na potwierdzenie | WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${data.firstName}</strong>,</p>
      
      <div style="background: #422006; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #f59e0b; margin: 0 0 10px 0;">Twoja rezerwacja oczekuje na akceptację</h3>
        <p style="margin: 0; color: #fef3c7;">Dziękujemy za złożenie rezerwacji. Sprawdzimy dostępność sprzętu i potwierdzimy rezerwację w ciągu 24 godzin.</p>
      </div>

      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 10px 0;">Zarezerwowany sprzęt</h4>
        <p style="margin: 0; font-size: 15px;">${data.productName}</p>
      </div>

      ${blokTerminu(data)}

      ${blokKosztow(rozpis)}
      
      <p style="color: #a1a1aa; font-size: 14px;">
        Otrzymasz osobny e-mail z potwierdzeniem lub alternatywną propozycją terminu.
      </p>
      
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 20px;">
        Pytania? Zadzwoń: <strong style="color: #ffffff;">570 038 828</strong>
      </p>
      
      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
      </div>
    </div>
  `;

  return sendEmail(data.email, subject, html);
};

export const sendReservationNotification = async (
  data: ReservationInput & { 
    days: number; 
    basePrice: number; 
    deliveryFee: number; 
    totalPrice: number;
    productName: string;
  }
) => {
  const subject = `Nowa rezerwacja: ${data.productName} (${data.startDate})`;
  data = escFields(data, ['firstName', 'lastName', 'email', 'phone', 'company', 'productName', 'city', 'address', 'notes']);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">Nowa rezerwacja!</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Klient:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.firstName} ${data.lastName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Email:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Telefon:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.phone}</td>
        </tr>
        ${data.company ? `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Firma:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.company}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Urządzenie:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.productName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Termin:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.startDate} - ${data.endDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Godziny:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">Odbiór: ${data.startTime || '09:00'} | Zwrot: ${data.endTime || '09:00'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Wartość:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333; font-weight: bold; color: #f59e0b;">${data.totalPrice} PLN</td>
        </tr>
      </table>
      
      ${data.notes ? `
      <div style="background: #1a1a1a; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #a1a1aa;">Notatki:</p>
        <p style="margin: 10px 0 0;">${data.notes}</p>
      </div>
      ` : ''}
    </div>
  `;

  return sendEmail(config.adminEmail, subject, html);
};

// === ADMIN REPLY TO CONTACT ===

export const sendContactReply = async (
  customerEmail: string,
  customerName: string,
  originalSubject: string | null,
  replyMessage: string
) => {
  const subject = `Re: ${originalSubject || 'Twoje zapytanie'} - WB-Rent`;
  customerName = esc(customerName);
  replyMessage = esc(replyMessage);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${customerName}</strong>,</p>
      
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #b8972a;">
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${replyMessage}</p>
      </div>
      
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 30px;">
        Jeśli masz dodatkowe pytania, odpowiedz na tego maila lub zadzwoń pod numer: <strong style="color: #ffffff;">570 038 828</strong>
      </p>
      
      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <a href="https://wb-rent.pl" style="color: #b8972a;">www.wb-rent.pl</a>
        </p>
      </div>
    </div>
  `;

  return sendEmail(customerEmail, subject, html);
};
// === RESERVATION STATUS CHANGE EMAILS ===

export const sendReservationStatusEmail = async (
  reservation: {
    email: string;
    name: string;
    productName: string;
    startDate: string;
    endDate: string;
    isIndefinite?: boolean;
    totalPrice: number;
  },
  status: 'confirmed' | 'rejected'
) => {
  const isConfirmed = status === 'confirmed';
  reservation = escFields(reservation, ['name', 'productName']);
  
  const subject = isConfirmed 
    ? 'Rezerwacja potwierdzona | WB-Rent'
    : 'Rezerwacja nie może zostać zrealizowana | WB-Rent';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid ${isConfirmed ? '#22c55e' : '#ef4444'}; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${reservation.name}</strong>,</p>
      
      ${isConfirmed ? `
        <div style="background: #14532d; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
          <h3 style="color: #22c55e; margin: 0 0 10px 0;">🎉 Twoja rezerwacja została potwierdzona!</h3>
          <p style="margin: 0; color: #bbf7d0;">Możesz odebrać sprzęt w umówionym terminie.</p>
        </div>
      ` : `
        <div style="background: #450a0a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="color: #ef4444; margin: 0 0 10px 0;">Niestety nie możemy zrealizować rezerwacji</h3>
          <p style="margin: 0; color: #fecaca;">Przepraszamy za utrudnienia. Skontaktuj się z nami, aby znaleźć alternatywny termin.</p>
        </div>
      `}
      
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 15px 0;">Szczegóły rezerwacji:</h4>
        <table style="width: 100%; color: #ffffff;">
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Urządzenie:</td>
            <td style="padding: 8px 0;">${reservation.productName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Termin:</td>
            <td style="padding: 8px 0;">${reservation.startDate} - ${reservation.endDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Wartość:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #b8972a;">${reservation.totalPrice} PLN</td>
          </tr>
        </table>
      </div>
      
      ${isConfirmed ? `
        <p style="color: #a1a1aa; font-size: 14px;">
          <strong>Przypomnienie:</strong> Prosimy o punktualne odebranie sprzętu. 
          Wymagany będzie dowód osobisty oraz kaucja.
        </p>
      ` : ''}
      
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 20px;">
        Pytania? Zadzwoń: <strong style="color: #ffffff;">570 038 828</strong>
      </p>
      
      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
      </div>
    </div>
  `;

  return sendEmail(reservation.email, subject, html);
};


export const sendRentalTermChangedEmail = async (reservation: {
  email: string;
  name: string;
  productName: string;
  endDate: string;
  totalPrice: number;
  priceDelta: number;
  note: string;
}) => {
  reservation = escFields(reservation, ['name', 'productName', 'endDate', 'note']);
  const subject = 'Zmiana okresu wynajmu - WB-Rent';
  const priceChange = reservation.priceDelta > 0
    ? `<p style="color: #fbbf24; margin: 8px 0 0;">Dopłata za zmianę: <strong>${reservation.priceDelta.toFixed(2)} PLN</strong></p>`
    : '';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <h2 style="color: #b8972a; margin-top: 0;">WB-Rent</h2>
      <p>Cześć <strong style="color: #b8972a;">${reservation.name}</strong>,</p>
      <p>Okres wynajmu urządzenia <strong>${reservation.productName}</strong> został zmieniony.</p>
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #a1a1aa; margin: 0;">Aktualny termin zwrotu</p>
        <p style="font-size: 20px; font-weight: bold; color: #b8972a; margin: 6px 0 0;">${reservation.endDate}</p>
        <p style="color: #a1a1aa; margin: 14px 0 0;">Aktualna wartość wynajmu: <strong style="color: #ffffff;">${reservation.totalPrice.toFixed(2)} PLN</strong></p>
        ${priceChange}
      </div>
      <p style="color: #a1a1aa; font-size: 14px;">Uzgodnienie: ${reservation.note}</p>
      <p style="color: #71717a; font-size: 12px; margin-top: 24px;">Ta wiadomość potwierdza zmianę w formie dokumentowej. Pytania: 570 038 828.</p>
    </div>
  `;
  return sendEmail(reservation.email, subject, html);
};


// === REMINDER EMAILS ===
export const sendPickupReminderEmail = async (
  reservation: {
    email: string;
    name: string;
    productName: string;
    startDate: string;
    endDate: string;
  }
) => {
  reservation = escFields(reservation, ['name', 'productName']);
  const subject = 'Przypomnienie: jutro odbiór sprzętu | WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${reservation.name}</strong>,</p>
      
      <div style="background: #422006; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #f59e0b; margin: 0 0 10px 0;">⏰ Przypomnienie o odbiorze!</h3>
        <p style="margin: 0; color: #fef3c7;">Twoja rezerwacja rozpoczyna się <strong>jutro (${reservation.startDate})</strong>.</p>
      </div>
      
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 15px 0;">Szczegóły:</h4>
        <table style="width: 100%; color: #ffffff;">
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Urządzenie:</td>
            <td style="padding: 8px 0;">${reservation.productName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Data odbioru:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #22c55e;">${reservation.startDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Data zwrotu:</td>
            <td style="padding: 8px 0;">${reservation.endDate}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #a1a1aa; font-size: 14px;">
        <strong>Pamiętaj:</strong> Zabierz ze sobą dowód osobisty oraz środki na kaucję.
      </p>
      
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 20px;">
        Pytania? Zadzwoń: <strong style="color: #ffffff;">570 038 828</strong>
      </p>
      
      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
      </div>
    </div>
  `;

  return sendEmail(reservation.email, subject, html);
};

export const sendReturnReminderEmail = async (
  reservation: {
    email: string;
    name: string;
    productName: string;
    startDate: string;
    endDate: string;
  }
) => {
  reservation = escFields(reservation, ['name', 'productName']);
  const subject = 'Przypomnienie: jutro zwrot sprzętu | WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #ef4444; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${reservation.name}</strong>,</p>
      
      <div style="background: #450a0a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <h3 style="color: #ef4444; margin: 0 0 10px 0;">⏰ Przypomnienie o zwrocie!</h3>
        <p style="margin: 0; color: #fecaca;">Termin zwrotu sprzętu upływa <strong>jutro (${reservation.endDate})</strong>.</p>
      </div>
      
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 15px 0;">Szczegóły:</h4>
        <table style="width: 100%; color: #ffffff;">
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Urządzenie:</td>
            <td style="padding: 8px 0;">${reservation.productName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Data zwrotu:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #ef4444;">${reservation.endDate}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #422006; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #fef3c7; font-size: 14px;">
          ⚠️ <strong>Uwaga:</strong> Opóźnienie w zwrocie może wiązać się z dodatkowymi opłatami. 
          Jeśli potrzebujesz przedłużyć wynajem, skontaktuj się z nami jak najszybciej.
        </p>
      </div>
      
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 20px;">
        Pytania? Zadzwoń: <strong style="color: #ffffff;">570 038 828</strong>
      </p>
      
      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
      </div>
    </div>
  `;

  return sendEmail(reservation.email, subject, html);
};

// === NEWSLETTER EMAIL ===
export const sendNewsletterEmail = async (
  data: {
    email: string;
    name: string | null;
    title: string;
    content: string;
  }
) => {
  const subject = `${data.title} | WB-Rent`;
  // Escape name/title; content is admin-authored (plain text converted to paragraphs)
  data = escFields(data, ['name', 'title']);
  const greeting = data.name ? `Cześć <strong style="color: #b8972a;">${data.name}</strong>,` : 'Cześć,';
  
  // Convert newlines to paragraphs for content
  const formattedContent = esc(data.content)
    .split('\n\n')
    .map(p => `<p style="margin: 15px 0; line-height: 1.6;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Nowości i aktualności</p>
      </div>
      
      <p>${greeting}</p>
      
      <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); padding: 25px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #b8972a;">
        <h3 style="color: #b8972a; margin: 0 0 15px 0; font-size: 20px;">${data.title}</h3>
        <div style="color: #e5e5e5;">
          ${formattedContent}
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${config.siteUrl}" style="display: inline-block; background: linear-gradient(135deg, #b8972a 0%, #8b7420 100%); color: #000000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Odwiedź naszą stronę
        </a>
      </div>
      
      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
        <p style="color: #525252; font-size: 10px; margin-top: 15px;">
          Otrzymujesz tę wiadomość, ponieważ zapisałeś się do newslettera WB-Rent.<br>
          <a href="${config.apiUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(data.email)}&token=${unsubscribeToken(data.email)}" style="color: #525252; text-decoration: underline;">Kliknij tutaj, aby wypisać się z newslettera</a>
        </p>
      </div>
    </div>
  `;

  return sendEmail(data.email, subject, html);
};

// === PRODUCT AVAILABILITY NOTIFICATION ===
export const sendProductAvailabilityNotification = async (
  email: string,
  productName: string,
  productId: string
) => {
  const subject = `${productName} jest już dostępny | WB-Rent`;
  productName = esc(productName);
  productId = encodeURIComponent(productId);
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Powiadomienie o dostępności</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #22c55e20 0%, #16a34a20 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          <span style="font-size: 40px;">✅</span>
        </div>
        <h3 style="color: #22c55e; margin: 0 0 10px 0; font-size: 24px;">Produkt dostępny!</h3>
        <p style="color: #e5e5e5; margin: 0;">Sprzęt, na który czekałeś, jest już wolny:</p>
      </div>
      
      <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); padding: 25px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #22c55e; text-align: center;">
        <h4 style="color: #b8972a; margin: 0 0 10px 0; font-size: 20px;">${productName}</h4>
        <p style="color: #a1a1aa; margin: 0;">Zarezerwuj teraz zanim ktoś Cię ubiegnie!</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${config.siteUrl}/produkt/${productId}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Zarezerwuj teraz
        </a>
      </div>
      
      <p style="color: #a1a1aa; text-align: center; margin: 20px 0;">
        lub zadzwoń: <a href="tel:+48570038552" style="color: #b8972a; text-decoration: none;">+48 570 038 552</a>
      </p>
      
      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
        <p style="color: #525252; font-size: 10px; margin-top: 15px;">
          Otrzymujesz tę wiadomość, ponieważ zapisałeś się na powiadomienie o dostępności tego produktu.
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

// === CUSTOMER MAGIC LINK ("moje rezerwacje") ===
export const sendMyReservationsLink = async (email: string, link: string) => {
  const subject = 'Twoje rezerwacje — link dostępu | WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Dostęp do Twoich rezerwacji</p>
      </div>

      <p>Cześć,</p>
      <p style="color: #e5e5e5;">
        Otrzymaliśmy prośbę o dostęp do listy Twoich rezerwacji.
        Kliknij poniższy przycisk — link jest ważny przez <strong style="color: #b8972a;">24 godziny</strong>.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #b8972a 0%, #8b7420 100%); color: #000000; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Zobacz moje rezerwacje
        </a>
      </div>

      <p style="color: #71717a; font-size: 13px;">
        Jeśli to nie Ty prosiłeś o ten link, zignoruj tę wiadomość — nikt nie uzyska dostępu bez niego.
      </p>

      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

// === PAYMENT LINK (resent from the admin panel) ===
export const sendPaymentLinkEmail = async (
  email: string,
  customerName: string,
  reservationId: number,
  amount: number,
  link: string
) => {
  const safeName = esc(customerName);
  const kwota = `${amount.toFixed(2).replace('.', ',')} zł`;
  const subject = `Płatność za rezerwację #${reservationId} - WB-Rent`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Link do płatności</p>
      </div>

      <p>Cześć <strong style="color: #b8972a;">${safeName}</strong>,</p>
      <p style="color: #e5e5e5; line-height: 1.6;">
        Przesyłamy link do opłacenia rezerwacji <strong>#${reservationId}</strong>.
      </p>

      <div style="background: #1a1a1a; padding: 18px; border-radius: 8px; margin: 22px 0; border-left: 4px solid #b8972a;">
        <p style="margin: 0; color: #a1a1aa; font-size: 13px;">Do zapłaty</p>
        <p style="margin: 4px 0 0; color: #b8972a; font-size: 26px; font-weight: bold;">${kwota}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #b8972a 0%, #8b7420 100%); color: #000000; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Zapłać ${kwota}
        </a>
      </div>

      <p style="color: #71717a; font-size: 13px;">
        Jeśli rezerwacja została już opłacona, zignoruj tę wiadomość — link przestanie wtedy działać.
      </p>

      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

// === SIGNED RENTAL CONTRACT ===
export const sendSignedContractEmail = async (
  email: string,
  customerName: string,
  contractNumber: string,
  pdf: Buffer,
  extraAttachments: EmailAttachment[] = []
) => {
  const safeName = esc(customerName);
  const safeNumber = esc(contractNumber);
  const subject = `Podpisana umowa najmu ${contractNumber} - WB-Rent`;
  const attachmentList = extraAttachments.length > 0
    ? `<ul style="color: #e5e5e5; line-height: 1.7; padding-left: 18px;">
         <li>Umowa najmu ${safeNumber} (PDF)</li>
         ${extraAttachments.map((file) => `<li>${esc(file.filename.replace(/\.pdf$/i, ''))}</li>`).join('')}
       </ul>`
    : '';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Podpisana umowa najmu</p>
      </div>
      <p>Cześć <strong style="color: #b8972a;">${safeName}</strong>,</p>
      <p style="color: #e5e5e5; line-height: 1.6;">
        Dziękujemy za podpisanie umowy <strong>${safeNumber}</strong>.
        W załączniku przesyłamy komplet dokumentów do tego najmu:
      </p>
      ${attachmentList}
      <div style="background: #1a1a1a; padding: 18px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22c55e;">
        <p style="margin: 0; color: #bbf7d0;">✓ Umowa została podpisana i zapisana w systemie WB-Rent.</p>
      </div>
      <p style="color: #e5e5e5; line-height: 1.6; font-size: 14px;">
        Przed pierwszym uruchomieniem zapoznaj się z instrukcją obsługi — korzystanie ze sprzętu
        niezgodnie z instrukcją obciąża Najemcę kosztami naprawy.
      </p>
      <p style="color: #71717a; font-size: 13px;">
        Zachowaj te dokumenty do zakończenia najmu. W razie pytań skontaktuj się z nami: 570 038 828.
      </p>
    </div>
  `;

  return sendEmail(email, subject, html, [
    {
      filename: `umowa-${contractNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
      content: pdf,
      contentType: 'application/pdf',
    },
    ...extraAttachments,
  ]);
};

// === PROTOKÓŁ WYDANIA (Załącznik nr 1) ===
/**
 * Jedyny mail wysylany przy wydaniu sprzetu.
 *
 * Wczesniej szly dwie osobne wiadomosci - "sprzet wydany" i "protokol w
 * zalaczniku" - o tym samym zdarzeniu. Dwa maile pod rzad to prosta droga do
 * folderu spam, a dla klienta zadna z nich nie byla kompletna: brakowalo
 * linku do platnosci i do przedluzenia najmu.
 */
export const sendHandoverProtocolEmail = async (
  email: string,
  customerName: string,
  protocolNumber: string,
  pdf: Buffer,
  kontekst?: {
    productName?: string;
    zwrot?: { data: string | null; godzina: string | null };
    miejsceZwrotu?: { tryb: string; adres: string };
    doZaplaty?: number;
    linkPlatnosci?: string | null;
    linkPrzedluzenia?: string | null;
    bezterminowo?: boolean;
  }
) => {
  const safeName = esc(customerName);
  const safeNumber = esc(protocolNumber);
  const subject = `Sprzęt wydany — protokół ${protocolNumber} | WB-Rent`;
  const zwrot = kontekst?.zwrot ? opiszTermin(kontekst.zwrot.data, kontekst.zwrot.godzina) : null;

  const przycisk = (url: string, etykieta: string, glowny: boolean) => `
    <a href="${esc(url)}" style="display: inline-block; padding: 13px 26px; margin: 0 8px 10px 0;
       background: ${glowny ? '#b8972a' : 'transparent'}; color: ${glowny ? '#0a0a0a' : '#b8972a'};
       border: 1px solid #b8972a; border-radius: 8px; text-decoration: none; font-weight: bold;">
      ${esc(etykieta)}
    </a>`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>

      <p>Cześć <strong style="color: #b8972a;">${safeName}</strong>,</p>

      <div style="background: #14532d; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
        <h3 style="color: #4ade80; margin: 0 0 10px 0;">Dziękujemy za zaufanie</h3>
        <p style="margin: 0; color: #bbf7d0; line-height: 1.6;">
          Sprzęt jest już u Ciebie. Dziękujemy za skorzystanie z naszych usług — cieszymy się,
          że wybór padł na WB-Rent, i życzymy sprawnej pracy.
        </p>
      </div>

      ${kontekst?.productName ? `
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 8px 0;">Wydany sprzęt</h4>
        <p style="margin: 0; font-size: 15px;">${esc(kontekst.productName)}</p>
      </div>` : ''}

      ${kontekst?.bezterminowo
        ? `<div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
             <p style="margin: 0 0 4px; color: #b8972a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Okres najmu</p>
             <p style="margin: 0; font-size: 15px;">Najem bezterminowy — trwa do odwołania.</p>
           </div>`
        : zwrot ? `
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 4px; color: #b8972a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Zwrot sprzętu</p>
        <p style="margin: 0 0 2px; font-size: 16px; font-weight: bold;">${esc(`${zwrot.dzienTygodnia}, ${zwrot.dataSlownie}`)}</p>
        ${zwrot.godzina ? `<p style="margin: 0 0 8px;">godz. ${esc(zwrot.godzina)}</p>` : ''}
        ${kontekst?.miejsceZwrotu ? `
        <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 12px;">${esc(kontekst.miejsceZwrotu.tryb)}</p>
        <p style="margin: 2px 0 0; color: #d4d4d8; font-size: 13px;">${esc(kontekst.miejsceZwrotu.adres)}</p>` : ''}
      </div>` : ''}

      ${kontekst?.linkPlatnosci && (kontekst.doZaplaty ?? 0) > 0 ? `
      <div style="background: #422006; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h4 style="color: #fbbf24; margin: 0 0 8px 0;">Pozostała płatność</h4>
        <p style="margin: 0 0 14px; color: #fef3c7;">
          Do zapłaty <strong>${esc(zloty(kontekst.doZaplaty ?? 0))}</strong>. Możesz opłacić online:
        </p>
        ${przycisk(kontekst.linkPlatnosci, 'Zapłać online', true)}
      </div>` : ''}

      ${kontekst?.linkPrzedluzenia ? `
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 8px 0;">Potrzebujesz sprzętu dłużej?</h4>
        <p style="margin: 0 0 14px; color: #d4d4d8; line-height: 1.6;">
          Najem możesz przedłużyć przed upływem terminu zwrotu — bez dodatkowych formalności.
        </p>
        ${przycisk(kontekst.linkPrzedluzenia, 'Przedłuż najem', false)}
      </div>` : ''}

      <p style="color: #e5e5e5; line-height: 1.6;">
        W załączniku znajdziesz podpisany protokół wydania <strong>${safeNumber}</strong>.
        Zachowaj go do końca najmu — przy zwrocie porównamy z nim stan sprzętu.
      </p>

      <p style="color: #a1a1aa; font-size: 14px; margin-top: 20px;">
        Pytania? Zadzwoń: <strong style="color: #ffffff;">570 038 828</strong>
      </p>

      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html, [
    {
      filename: `protokol-wydania-${protocolNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
      content: pdf,
      contentType: 'application/pdf',
    },
  ]);
};

// === PROTOKÓŁ ZWROTU (Załącznik nr 2) ===
/**
 * Jedyny mail wysylany przy zwrocie sprzetu.
 *
 * Wczesniej szly dwie wiadomosci: jedna dziekowala za zwrot, druga podawala
 * kwoty bez slowa o tym, czy i jak je zaplacic. Teraz jest jedna, ktora mowi
 * wprost: ile, za co, do kiedy i gdzie kliknac.
 */
export const sendReturnProtocolEmail = async (
  email: string,
  customerName: string,
  protocolNumber: string,
  pdf: Buffer,
  rozliczenie: {
    chargesTotal: number;
    deposit: number;
    balance: number;
    hasPendingValuation: boolean;
    charges: Array<{ label: string; amount: number | null }>;
    /** Link do platnosci online - gdy najem nie zostal oplacony gotowka na miejscu. */
    linkPlatnosci?: string | null;
    zaplaconoNaMiejscu?: boolean;
  }
) => {
  const safeName = esc(customerName);
  const safeNumber = esc(protocolNumber);
  const kwota = (value: number) => zloty(value);
  const subject = `Zwrot przyjęty i rozliczony — protokół ${protocolNumber} | WB-Rent`;

  const pozycje = rozliczenie.charges.length > 0
    ? `<div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
         <h4 style="color: #b8972a; margin: 0 0 12px 0;">Rozliczenie najmu</h4>
         <table style="width: 100%; border-collapse: collapse;">
           ${rozliczenie.charges.map((pozycja) => `
             <tr>
               <td style="padding: 7px 0; color: #e5e5e5; border-bottom: 1px solid #2a2a2a;">${esc(pozycja.label)}</td>
               <td style="padding: 7px 0; color: #ffffff; text-align: right; white-space: nowrap; border-bottom: 1px solid #2a2a2a;">
                 ${pozycja.amount === null ? 'do wyceny' : esc(kwota(pozycja.amount))}
               </td>
             </tr>`).join('')}
           <tr>
             <td style="padding: 7px 0; color: #a1a1aa; border-bottom: 1px solid #2a2a2a;">Wpłacona kaucja</td>
             <td style="padding: 7px 0; color: #4ade80; text-align: right; white-space: nowrap; border-bottom: 1px solid #2a2a2a;">− ${esc(kwota(rozliczenie.deposit))}</td>
           </tr>
         </table>
       </div>`
    : '';

  const doZaplaty = rozliczenie.balance > 0;
  const przycisk = rozliczenie.linkPlatnosci && doZaplaty
    ? `<a href="${esc(rozliczenie.linkPlatnosci)}" style="display: inline-block; padding: 14px 30px; margin-top: 14px;
         background: #b8972a; color: #0a0a0a; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
         Zapłać ${esc(kwota(rozliczenie.balance))} online
       </a>`
    : '';

  const podsumowanie = doZaplaty
    ? `<div style="background: #422006; padding: 22px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
         <h3 style="color: #fbbf24; margin: 0 0 8px 0; font-size: 18px;">Do zapłaty: ${esc(kwota(rozliczenie.balance))}</h3>
         <p style="margin: 0; color: #fef3c7; line-height: 1.6;">
           ${rozliczenie.zaplaconoNaMiejscu
             ? 'Kwota została uregulowana gotówką przy zwrocie — nie musisz nic robić. Poniższe wyliczenie ma charakter informacyjny.'
             : `Tę kwotę należy uiścić w terminie <strong>7 dni</strong> od otrzymania dokumentu sprzedaży.
                Jeśli nie zapłaciłeś gotówką przy zwrocie, skorzystaj z przycisku poniżej.`}
         </p>
         ${rozliczenie.zaplaconoNaMiejscu ? '' : przycisk}
       </div>`
    : rozliczenie.balance < 0
      ? `<div style="background: #14532d; padding: 22px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
           <h3 style="color: #4ade80; margin: 0 0 8px 0; font-size: 18px;">Do zwrotu: ${esc(kwota(Math.abs(rozliczenie.balance)))}</h3>
           <p style="margin: 0; color: #bbf7d0; line-height: 1.6;">
             Niewykorzystaną część kaucji zwrócimy w ciągu 7 dni na rachunek, z którego wpłynęła płatność.
             Nie musisz nic robić.
           </p>
         </div>`
      : `<div style="background: #14532d; padding: 22px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
           <h3 style="color: #4ade80; margin: 0 0 8px 0; font-size: 18px;">Najem rozliczony w całości</h3>
           <p style="margin: 0; color: #bbf7d0; line-height: 1.6;">Nie ma żadnych dopłat ani zwrotów. Sprawa zamknięta.</p>
         </div>`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>

      <p>Cześć <strong style="color: #b8972a;">${safeName}</strong>,</p>

      <p style="color: #e5e5e5; line-height: 1.6;">
        Dziękujemy za zwrot sprzętu i za skorzystanie z naszych usług. Poniżej znajdziesz pełne
        rozliczenie najmu, a w załączniku podpisany protokół zwrotu <strong>${safeNumber}</strong>.
      </p>

      ${pozycje}
      ${podsumowanie}

      ${rozliczenie.hasPendingValuation
        ? `<p style="color: #e5e5e5; line-height: 1.6; font-size: 14px;">
             Pozycje oznaczone jako „do wyceny” wskażemy kwotowo po otrzymaniu faktury z autoryzowanego
             serwisu i prześlemy je osobnym pismem.
           </p>`
        : ''}

      <p style="color: #a1a1aa; font-size: 14px; margin-top: 20px;">
        Pytania do rozliczenia? Zadzwoń: <strong style="color: #ffffff;">570 038 828</strong>
      </p>

      <div style="border-top: 1px solid #333; padding-top: 20px; margin-top: 20px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          Pozdrawiamy,<br>
          Zespół WB-Rent<br>
          <span style="color: #a1a1aa; font-size: 11px;">WB Partners Sp. z o.o. | NIP: 5170455185 | ul. Słowackiego 24/11, 35-060 Rzeszów</span>
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html, [
    {
      filename: `protokol-zwrotu-${protocolNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
      content: pdf,
      contentType: 'application/pdf',
    },
  ]);
};

export const sendCouponEmail = async (
  email: string,
  coupon: {
    code: string;
    customerName: string;
    valueLabel: string;
    minTotal: number;
    expiresOn: string | null;
    termsText: string;
  },
  pdf: Buffer
) => {
  const safeName = esc(coupon.customerName || 'Kliencie');
  const safeCode = esc(coupon.code);
  const safeValue = esc(coupon.valueLabel);
  const safeTerms = esc(
    coupon.termsText
      || 'Kupon jednorazowy, nie łączy się z innymi promocjami i nie podlega wymianie na gotówkę.'
  );
  const conditions = [
    coupon.minTotal > 0
      ? `Minimalna kwota najmu: <strong>${coupon.minTotal.toFixed(2).replace('.', ',')} zł</strong>`
      : null,
    coupon.expiresOn ? `Ważny do: <strong>${esc(coupon.expiresOn)}</strong>` : 'Bez terminu ważności',
  ].filter(Boolean).join(' &nbsp;•&nbsp; ');

  const subject = `Twój kupon rabatowy ${coupon.code} - WB-Rent`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Kupon rabatowy na kolejny najem</p>
      </div>
      <p>Cześć <strong style="color: #b8972a;">${safeName}</strong>,</p>
      <p style="color: #e5e5e5; line-height: 1.6;">
        Dziękujemy za skorzystanie z naszych usług. W podziękowaniu przygotowaliśmy dla Ciebie
        rabat <strong style="color: #b8972a;">${safeValue}</strong> na kolejny najem sprzętu.
      </p>
      <div style="background: #1a1a1a; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center; border: 1px dashed #b8972a;">
        <p style="margin: 0 0 8px; color: #a1a1aa; font-size: 13px;">Twój kod rabatowy</p>
        <p style="margin: 0; color: #ffffff; font-size: 26px; font-weight: bold; letter-spacing: 3px;">${safeCode}</p>
      </div>
      <p style="color: #a1a1aa; font-size: 13px; text-align: center;">${conditions}</p>
      <p style="color: #e5e5e5; line-height: 1.6;">
        Kod wpisz w formularzu rezerwacji na <a href="https://wb-rent.pl" style="color: #b8972a;">wb-rent.pl</a>
        lub podaj go przy telefonicznym zamówieniu. Kupon do druku znajdziesz w załączniku.
      </p>
      <p style="color: #71717a; font-size: 12px; line-height: 1.5;">${safeTerms}</p>
    </div>
  `;

  return sendEmail(email, subject, html, [
    {
      filename: `kupon-${coupon.code.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
      content: pdf,
      contentType: 'application/pdf',
    },
  ]);
};