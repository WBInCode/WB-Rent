import nodemailer from 'nodemailer';
import { config } from './config.js';
import type { ContactInput, ReservationInput } from './schemas.js';

// Create transporter
const createTransporter = () => {
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

// Send email
const sendEmail = async (to: string, subject: string, html: string) => {
  if (!transporter) {
    logEmail(to, subject, html);
    return { success: true, messageId: 'console-log' };
  }

  try {
    const info = await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error);
    return { success: false, error };
  }
};

// === EMAIL TEMPLATES ===

export const sendContactConfirmation = async (data: ContactInput) => {
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
  const subject = '⏳ Rezerwacja oczekuje na potwierdzenie - WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="border-bottom: 2px solid #b8972a; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b8972a; margin: 0;">WB-Rent</h2>
        <p style="color: #a1a1aa; margin: 5px 0 0;">Wypożyczalnia sprzętu czyszczącego</p>
      </div>
      
      <p>Cześć <strong style="color: #b8972a;">${data.name}</strong>,</p>
      
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
            <td style="padding: 8px 0;">${data.startDate} - ${data.endDate} (${data.days} dni)</td>
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
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">Nowa rezerwacja!</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #333; color: #a1a1aa;">Klient:</td>
          <td style="padding: 8px; border-bottom: 1px solid #333;">${data.name}</td>
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