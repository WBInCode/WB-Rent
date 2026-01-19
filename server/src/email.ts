import nodemailer from 'nodemailer';
import { config } from './config.js';
import type { ContactInput, ReservationInput } from './schemas.js';

// Create transporter
const createTransporter = () => {
  // If no SMTP configured, use console logging in dev mode
  if (!config.smtp.host || config.isDev) {
    console.log('📧 Email: Using console logging (no SMTP configured)');
    return null;
  }

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
  const subject = 'Potwierdzenie rezerwacji - WB-Rent';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">Rezerwacja przyjęta!</h2>
      <p>Cześć <strong>${data.name}</strong>,</p>
      <p>Dziękujemy za rezerwację. Skontaktujemy się z Tobą w ciągu 24h w celu potwierdzenia szczegółów.</p>
      
      <div style="background: #1a1a1a; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #f59e0b; margin-top: 0;">Szczegóły rezerwacji</h3>
        
        <table style="width: 100%; border-collapse: collapse; color: #fff;">
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
            <td style="padding: 8px 0; color: #a1a1aa;">Dostawa:</td>
            <td style="padding: 8px 0;">${data.address}</td>
          </tr>
          ` : ''}
        </table>
        
        <hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
        
        <table style="width: 100%; border-collapse: collapse; color: #fff;">
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
            <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #f59e0b;">${data.totalPrice} PLN</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #71717a; font-size: 14px;">
        W razie pytań zadzwoń: +48 22 555 01 23<br><br>
        Pozdrawiamy,<br>
        Zespół WB-Rent
      </p>
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
