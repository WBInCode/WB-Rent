import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from './config.js';
import { unsubscribeToken } from './auth.js';
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
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    console.log('📧 Email: Using console logging (no SMTP configured)');
    return null;
  }

  console.log(`📧 Email: SMTP configured (${config.smtp.host})`);
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
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

// Send email (tries Resend first, then SMTP, then console)
const sendEmail = async (to: string, subject: string, html: string, attachments: EmailAttachment[] = []) => {
  const fromEmail = process.env.RESEND_FROM || config.smtp.from || 'WB-Rent <noreply@wb-rent.pl>';
  
  // Try Resend first
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject,
        html,
        attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
        })),
      });
      
      if (error) {
        console.error('❌ Resend error:', error);
        return { success: false, error };
      }
      
      console.log(`📧 Email sent via Resend to ${to}`);
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('❌ Resend error:', error);
      return { success: false, error };
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
        attachments,
      });
      console.log(`📧 Email sent via SMTP to ${to}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email send error:', error);
      return { success: false, error };
    }
  }
  
  // Fallback to console
  logEmail(to, subject, html);
  return { success: true, messageId: 'console-log' };
};

// === EMAIL TEMPLATES ===

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
    totalPrice: number;
    productName: string;
  }
) => {
  data = escFields(data, ['firstName', 'lastName', 'productName', 'city', 'address', 'company', 'notes']);
  const subject = '⏳ Rezerwacja oczekuje na potwierdzenie - WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${data.firstName}</strong>,</p>
      
      <div style="background: #422006; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #f59e0b; margin: 0 0 10px 0;">⏳ Twoja rezerwacja oczekuje na akceptację</h3>
        <p style="margin: 0; color: #fef3c7;">Dziękujemy za złożenie rezerwacji. Sprawdzimy dostępność sprzętu i potwierdzimy rezerwację w ciągu 24h.</p>
      </div>
      
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 15px 0;">Szczegóły rezerwacji:</h4>
        
        <table style="width: 100%; color: #ffffff;">
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Urządzenie:</td>
            <td style="padding: 8px 0;">${data.productName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Termin:</td>
            <td style="padding: 8px 0;">${data.startDate} - ${data.endDate} (${data.days} ${data.days === 1 ? 'doba' : data.days < 5 ? 'doby' : 'dób'})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Godzina odbioru:</td>
            <td style="padding: 8px 0;">${data.startTime || '09:00'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Godzina zwrotu:</td>
            <td style="padding: 8px 0;">${data.endTime || '09:00'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Miasto:</td>
            <td style="padding: 8px 0;">${data.city}</td>
          </tr>
          ${data.delivery ? `
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Dostawa pod adres:</td>
            <td style="padding: 8px 0;">${data.address}</td>
          </tr>
          ` : `
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Odbiór:</td>
            <td style="padding: 8px 0;">Osobisty</td>
          </tr>
          `}
        </table>
        
        <hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
        
        <table style="width: 100%; color: #ffffff;">
          <tr>
            <td style="padding: 4px 0; color: #a1a1aa;">Wynajem (${data.days} dni):</td>
            <td style="padding: 4px 0; text-align: right;">${data.basePrice} PLN</td>
          </tr>
          ${data.deliveryFee > 0 ? `
          <tr>
            <td style="padding: 4px 0; color: #a1a1aa;">Dostawa:</td>
            <td style="padding: 4px 0; text-align: right;">${data.deliveryFee} PLN</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; font-weight: bold; font-size: 18px;">SUMA:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #b8972a;">${data.totalPrice} PLN</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #a1a1aa; font-size: 14px;">
        Otrzymasz osobny email z potwierdzeniem lub alternatywną propozycją terminu.
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
    totalPrice: number;
  },
  status: 'confirmed' | 'rejected'
) => {
  const isConfirmed = status === 'confirmed';
  reservation = escFields(reservation, ['name', 'productName']);
  
  const subject = isConfirmed 
    ? '✅ Rezerwacja potwierdzona - WB-Rent'
    : '❌ Rezerwacja odrzucona - WB-Rent';
  
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

// === PICKED UP EMAIL (sprzęt wydany klientowi) ===
export const sendPickedUpEmail = async (
  reservation: {
    email: string;
    name: string;
    productName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
  }
) => {
  reservation = escFields(reservation, ['name', 'productName']);
  const subject = '📦 Sprzęt został odebrany - WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${reservation.name}</strong>,</p>
      
      <div style="background: #1e3a5f; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
        <h3 style="color: #3b82f6; margin: 0 0 10px 0;">📦 Sprzęt został wydany!</h3>
        <p style="margin: 0; color: #bfdbfe;">Dziękujemy za odbiór. Pamiętaj o terminie zwrotu.</p>
      </div>
      
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 15px 0;">Szczegóły wypożyczenia:</h4>
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
          ⚠️ <strong>Ważne:</strong> Prosimy o zwrot sprzętu w stanie nienaruszonym do dnia ${reservation.endDate}. 
          Opóźnienia mogą wiązać się z dodatkowymi opłatami.
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

// === RETURNED EMAIL (sprzęt zwrócony) ===
export const sendReturnedEmail = async (
  reservation: {
    email: string;
    name: string;
    productName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
  }
) => {
  reservation = escFields(reservation, ['name', 'productName']);
  const subject = '✅ Sprzęt został zwrócony - Dziękujemy! - WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #22c55e; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${reservation.name}</strong>,</p>
      
      <div style="background: #14532d; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
        <h3 style="color: #22c55e; margin: 0 0 10px 0;">🎉 Dziękujemy za zwrot sprzętu!</h3>
        <p style="margin: 0; color: #bbf7d0;">Twoje wypożyczenie zostało pomyślnie zakończone.</p>
      </div>
      
      <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #b8972a; margin: 0 0 15px 0;">Podsumowanie:</h4>
        <table style="width: 100%; color: #ffffff;">
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Urządzenie:</td>
            <td style="padding: 8px 0;">${reservation.productName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Okres wypożyczenia:</td>
            <td style="padding: 8px 0;">${reservation.startDate} - ${reservation.endDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #a1a1aa;">Wartość:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #b8972a;">${reservation.totalPrice} PLN</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #1e3a5f; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; color: #bfdbfe; font-size: 14px;">
          🌟 Dziękujemy za skorzystanie z naszych usług!<br>
          Mamy nadzieję, że sprzęt spełnił Twoje oczekiwania.
        </p>
      </div>
      
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 20px;">
        Potrzebujesz sprzętu ponownie? Zarezerwuj na: <a href="https://wb-rent.pl" style="color: #b8972a;">www.wb-rent.pl</a>
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
  const subject = '⏰ Przypomnienie: Jutro odbiór sprzętu - WB-Rent';
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
  const subject = '⏰ Przypomnienie: Jutro zwrot sprzętu - WB-Rent';
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
  const subject = `📢 ${data.title} - WB-Rent`;
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
  const subject = `🎉 ${productName} jest już dostępny! - WB-Rent`;
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
  const subject = '🔑 Twoje rezerwacje - link dostępu - WB-Rent';
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

// === SIGNED RENTAL CONTRACT ===
export const sendSignedContractEmail = async (
  email: string,
  customerName: string,
  contractNumber: string,
  pdf: Buffer
) => {
  const safeName = esc(customerName);
  const safeNumber = esc(contractNumber);
  const subject = `Podpisana umowa najmu ${contractNumber} - WB-Rent`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Podpisana umowa najmu</p>
      </div>
      <p>Cześć <strong style="color: #b8972a;">${safeName}</strong>,</p>
      <p style="color: #e5e5e5; line-height: 1.6;">
        Dziękujemy za podpisanie umowy <strong>${safeNumber}</strong>.
        Jej niezmienny egzemplarz PDF znajduje się w załączniku do tej wiadomości.
      </p>
      <div style="background: #1a1a1a; padding: 18px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22c55e;">
        <p style="margin: 0; color: #bbf7d0;">✓ Umowa została podpisana i zapisana w systemie WB-Rent.</p>
      </div>
      <p style="color: #71717a; font-size: 13px;">
        Zachowaj ten dokument do zakończenia najmu. W razie pytań skontaktuj się z nami: 570 038 828.
      </p>
    </div>
  `;

  return sendEmail(email, subject, html, [
    {
      filename: `umowa-${contractNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
      content: pdf,
      contentType: 'application/pdf',
    },
  ]);
};