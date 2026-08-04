import cron from 'node-cron';
import { queries } from './db.js';
import { getProductName } from './products.js';
import { sendPickupReminderEmail, sendReturnReminderEmail } from './email.js';
import { reconcilePendingPayments } from './payments/routes.js';
import { paymentsEnabled } from './payments/index.js';

const reservationProductNames = (reservation: any) => {
  const productIds = Array.isArray(reservation.items) && reservation.items.length > 0
    ? reservation.items.map((item: any) => String(item.product_id))
    : [String(reservation.product_id)];
  return productIds.map(getProductName).join(', ');
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
          productName: reservationProductNames(reservation),
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
          productName: reservationProductNames(reservation),
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

  // Siatka bezpieczenstwa na zgubione powiadomienia z bramki platnosci.
  cron.schedule('*/5 * * * *', async () => {
    if (!paymentsEnabled()) return;
    try {
      const zmienione = await reconcilePendingPayments();
      if (zmienione > 0) console.log(`💳 Uzgodniono ${zmienione} platnosci z bramka`);
    } catch (error) {
      console.error('Blad uzgadniania platnosci:', error);
    }
  });

  console.log('📅 Scheduler initialized - reminders daily at 9:00 AM, payment reconciliation every 5 min');
}

export { sendDailyReminders };
