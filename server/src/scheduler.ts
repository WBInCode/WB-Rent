import cron from 'node-cron';
import { queries } from './db.js';
import { sendPickupReminderEmail, sendReturnReminderEmail } from './email.js';

const productNames: Record<string, string> = {
  'puzzi-10-1': 'Odkurzacz Piorący Kärcher Puzzi 10/1',
  'puzzi-8-1': 'Odkurzacz Piorący Kärcher Puzzi 8/1 Anniversary',
  'nt-22-1': 'Odkurzacz Przemysłowy Kärcher NT 22/1 AP L',
  'nt-30-1': 'Odkurzacz Przemysłowy Kärcher NT 30/1 Tact Te L',
  'ad-4-premium': 'Odkurzacz Kominkowy Kärcher AD 4 Premium',
  'ozonmed-pro-10g': 'Ozonator powietrza Ozonmed Pro 10G',
  'af-100-h13': 'Oczyszczacz Powietrza Kärcher AF 100 H13',
  'dmuchawa-ab-20': 'Dmuchawa Kärcher AB 20 Ec',
  'sg-4-4': 'Parownica Kärcher SG 4/4',
  'es-1-7-bp': 'System do dezynfekcji Kärcher ES 1/7 Bp Pack',
  'wvp-10-adv': 'Myjka Do Okien Kärcher WVP 10 Adv',
};

async function sendDailyReminders() {
  console.log('📧 Running daily reminder job...');
  
  try {
    const pickupReminders = await queries.getReservationsForPickupReminder();
    const returnReminders = await queries.getReservationsForReturnReminder();
    
    let sentPickup = 0;
    let sentReturn = 0;
    
    for (const reservation of pickupReminders) {
      try {
        await sendPickupReminderEmail({
          email: reservation.email,
          name: reservation.name,
          productName: productNames[reservation.product_id] || reservation.product_id,
          startDate: reservation.start_date,
          endDate: reservation.end_date,
        });
        sentPickup++;
        console.log(`📧 Pickup reminder sent to ${reservation.email}`);
      } catch (err) {
        console.error(`❌ Failed to send pickup reminder to ${reservation.email}:`, err);
      }
    }
    
    for (const reservation of returnReminders) {
      try {
        await sendReturnReminderEmail({
          email: reservation.email,
          name: reservation.name,
          productName: productNames[reservation.product_id] || reservation.product_id,
          startDate: reservation.start_date,
          endDate: reservation.end_date,
        });
        sentReturn++;
        console.log(`📧 Return reminder sent to ${reservation.email}`);
      } catch (err) {
        console.error(`❌ Failed to send return reminder to ${reservation.email}:`, err);
      }
    }
    
    console.log(`✅ Daily reminders complete: ${sentPickup} pickup, ${sentReturn} return`);
  } catch (error) {
    console.error('❌ Error in daily reminder job:', error);
  }
}

export function initScheduler() {
  cron.schedule('0 9 * * *', () => {
    console.log('⏰ Triggering scheduled reminder job (9:00 AM)');
    sendDailyReminders();
  }, {
    timezone: 'Europe/Warsaw'
  });

  console.log('📅 Scheduler initialized - reminders daily at 9:00 AM');
}

export { sendDailyReminders };
