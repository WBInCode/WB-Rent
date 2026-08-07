import cron from 'node-cron';
import { queries } from './db.js';
import { getProductName } from './products.js';
import { sendPickupReminderEmail, sendReturnReminderEmail } from './email.js';
import { resendSignedContractEmail } from './contracts/service.js';
import { reconcilePendingPayments } from './payments/routes.js';
import { paymentsEnabled } from './payments/index.js';

const reservationProductNames = (reservation: any) => {
  const productIds = Array.isArray(reservation.items) && reservation.items.length > 0
    ? reservation.items.map((item: any) => String(item.product_id))
    : [String(reservation.product_id)];
  return productIds.map(getProductName).join(', ');
};

/**
 * Umowa czekająca na wydanie, którego nie było.
 *
 * Przy obsłudze przy ladzie mail z umową jest wstrzymywany, żeby pojechał
 * razem z protokołem wydania. Gdyby klient jednak nie odebrał sprzętu,
 * podpisany dokument musi do niego trafić mimo wszystko.
 */
async function wyslijZalegleUmowy() {
  try {
    const zalegle = await queries.getStaleDeferredContracts(2);
    for (const umowa of zalegle) {
      try {
        const wynik = await resendSignedContractEmail(umowa.id);
        if (wynik.delivered) {
          console.log(`📧 Zaległa umowa ${wynik.contractNumber} wysłana do ${wynik.email}`);
        }
      } catch (err) {
        console.error(`❌ Nie udało się wysłać zaległej umowy ${umowa.id}:`, err);
      }
    }
  } catch (error) {
    console.error('❌ Błąd wysyłki zaległych umów:', error);
  }
}

/**
 * Nieopłacone aneksy po terminie.
 *
 * Umowa (§5 ust. 3): brak zapłaty w terminie oznacza brak skutecznego
 * przedłużenia. Aneks zostaje w bazie jako „niewiążący", żeby z historii dało
 * się odczytać, że przedłużenie było próbowane — a sprzęt wraca do puli.
 */
async function wygasNieoplaconeAneksy() {
  try {
    const wygasle = await queries.expireStaleExtensions();
    for (const aneks of wygasle) {
      if (aneks.payment_session_id) {
        await queries.updatePaymentStatus({
          sessionId: aneks.payment_session_id,
          status: 'cancelled',
        }).catch((err) => console.error('Anulowanie płatności aneksu:', err));
      }
      console.log(`📄 Aneks ${aneks.id} wygasł bez zapłaty — sprzęt zwolniony`);
    }
  } catch (error) {
    console.error('❌ Błąd wygaszania aneksów:', error);
  }
}

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

  cron.schedule('30 * * * *', () => {
    wyslijZalegleUmowy();
  }, {
    timezone: 'Europe/Warsaw'
  });

  // Blokada sprzętu przy przedłużeniu trwa godzinę, więc sprawdzamy co 5 minut.
  cron.schedule('*/5 * * * *', () => {
    wygasNieoplaconeAneksy();
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

  console.log('📅 Scheduler initialized - reminders daily at 9:00 AM, deferred contracts hourly, extension holds and payment reconciliation every 5 min');
}

export { sendDailyReminders, wyslijZalegleUmowy, wygasNieoplaconeAneksy };
