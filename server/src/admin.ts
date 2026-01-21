import { Router, type Request, type Response, type NextFunction } from 'express';
import { queries } from './db.js';
import { config } from './config.js';
import { sendContactReply, sendReservationStatusEmail, sendPickedUpEmail, sendReturnedEmail, sendNewsletterEmail, sendProductAvailabilityNotification } from './email.js';
import { newsletterPostSchema } from './schemas.js';

// Product names mapping
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

const router = Router();

// Simple admin authentication middleware
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Brak autoryzacji' });
    return;
  }

  const token = authHeader.split(' ')[1];
  
  if (token !== config.adminToken) {
    res.status(403).json({ success: false, message: 'Nieprawidłowy token' });
    return;
  }

  next();
};

// Login endpoint
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (password === config.adminPassword) {
    res.json({ 
      success: true, 
      token: config.adminToken,
      message: 'Zalogowano pomyślnie'
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Nieprawidłowe hasło' 
    });
  }
});

// Get all reservations
router.get('/reservations', adminAuth, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    
    let reservations;
    if (status && status !== 'all') {
      reservations = await queries.getReservationsByStatus(status);
    } else {
      reservations = await queries.getReservations();
    }

    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Admin reservations error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Update reservation status
router.patch('/reservations/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'picked_up', 'returned', 'completed', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ 
        success: false, 
        message: `Nieprawidłowy status. Dozwolone: ${validStatuses.join(', ')}` 
      });
      return;
    }

    const reservation = await queries.getReservationById(Number(id));
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }
    
    await queries.updateReservationStatus({ id: Number(id), status });
    
    // Send email to customer on confirm/reject
    if (status === 'confirmed' || status === 'rejected') {
      try {
        await sendReservationStatusEmail({
          email: reservation.email,
          name: reservation.name,
          productName: productNames[reservation.product_id] || reservation.product_id,
          startDate: reservation.start_date,
          endDate: reservation.end_date,
          totalPrice: reservation.total_price,
        }, status);
        console.log(`📧 Email sent to ${reservation.email} - reservation ${status}`);
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }
    
    // Send email when equipment is picked up
    if (status === 'picked_up') {
      try {
        await sendPickedUpEmail({
          email: reservation.email,
          name: reservation.name,
          productName: productNames[reservation.product_id] || reservation.product_id,
          startDate: reservation.start_date,
          endDate: reservation.end_date,
          totalPrice: reservation.total_price,
        });
        console.log(`📧 Picked up email sent to ${reservation.email}`);
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }
    
    // Send email when equipment is returned
    if (status === 'returned') {
      try {
        await sendReturnedEmail({
          email: reservation.email,
          name: reservation.name,
          productName: productNames[reservation.product_id] || reservation.product_id,
          startDate: reservation.start_date,
          endDate: reservation.end_date,
          totalPrice: reservation.total_price,
        });
        console.log(`📧 Returned email sent to ${reservation.email}`);
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }

      // Auto-send availability notifications
      try {
        const waitingNotifications = await queries.getWaitingNotificationsForProduct(reservation.product_id);
        const productName = productNames[reservation.product_id] || reservation.product_id;
        
        for (const notification of waitingNotifications) {
          try {
            const result = await sendProductAvailabilityNotification(
              notification.email,
              productName,
              reservation.product_id
            );
            if (result.success) {
              await queries.markNotificationAsSent(notification.id);
              console.log(`📧 Availability notification sent to ${notification.email}`);
            }
          } catch (notifyError) {
            console.error(`Failed to notify ${notification.email}:`, notifyError);
          }
        }
      } catch (notifyError) {
        console.error('Auto-notify error:', notifyError);
      }
    }

    // Auto-send availability notifications when cancelled/rejected
    if (status === 'cancelled' || status === 'rejected') {
      try {
        const waitingNotifications = await queries.getWaitingNotificationsForProduct(reservation.product_id);
        const productName = productNames[reservation.product_id] || reservation.product_id;
        
        for (const notification of waitingNotifications) {
          try {
            const result = await sendProductAvailabilityNotification(
              notification.email,
              productName,
              reservation.product_id
            );
            if (result.success) {
              await queries.markNotificationAsSent(notification.id);
            }
          } catch (notifyError) {
            console.error(`Failed to notify ${notification.email}:`, notifyError);
          }
        }
      } catch (notifyError) {
        console.error('Auto-notify error:', notifyError);
      }
    }
    
    const updated = await queries.getReservationById(Number(id));

    res.json({ 
      success: true, 
      message: `Status zmieniony na: ${status}`,
      data: updated
    });
  } catch (error) {
    console.error('Admin update reservation error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Get single reservation
router.get('/reservations/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reservation = await queries.getReservationById(Number(id));

    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    res.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Admin get reservation error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Get all contacts
router.get('/contacts', adminAuth, async (_req: Request, res: Response) => {
  try {
    const contacts = await queries.getContacts();
    res.json({ success: true, data: contacts });
  } catch (error) {
    console.error('Admin contacts error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Update contact status
router.patch('/contacts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'read', 'replied', 'archived'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ 
        success: false, 
        message: `Nieprawidłowy status. Dozwolone: ${validStatuses.join(', ')}` 
      });
      return;
    }

    await queries.updateContactStatus({ id: Number(id), status });

    res.json({ 
      success: true, 
      message: `Status zmieniony na: ${status}`
    });
  } catch (error) {
    console.error('Admin update contact error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Dashboard stats
router.get('/stats', adminAuth, async (_req: Request, res: Response) => {
  try {
    const reservations = await queries.getReservations();
    const contacts = await queries.getContacts();
    const revenueToday = await queries.getRevenueToday();
    const revenueMonth = await queries.getRevenueThisMonth();
    const revenueTotal = await queries.getRevenueTotal();

    const stats = {
      reservations: {
        total: reservations.length,
        pending: reservations.filter((r: any) => r.status === 'pending').length,
        confirmed: reservations.filter((r: any) => r.status === 'confirmed').length,
        picked_up: reservations.filter((r: any) => r.status === 'picked_up').length,
        returned: reservations.filter((r: any) => r.status === 'returned').length,
        completed: reservations.filter((r: any) => r.status === 'completed').length,
        rejected: reservations.filter((r: any) => r.status === 'rejected').length,
      },
      contacts: {
        total: contacts.length,
        new: contacts.filter((c: any) => c.status === 'new' || !c.status).length,
      },
      revenue: {
        today: revenueToday?.revenue || 0,
        month: revenueMonth?.revenue || 0,
        total: revenueTotal?.revenue || 0,
        pending: reservations
          .filter((r: any) => ['pending', 'confirmed', 'picked_up'].includes(r.status))
          .reduce((sum: number, r: any) => sum + (r.total_price || 0), 0),
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Revenue details
router.get('/revenue', adminAuth, async (_req: Request, res: Response) => {
  try {
    const today = (await queries.getRevenueToday())?.revenue || 0;
    const month = (await queries.getRevenueThisMonth())?.revenue || 0;
    const total = (await queries.getRevenueTotal())?.revenue || 0;
    const byMonth = await queries.getRevenueByMonth();
    
    const reservations = await queries.getReservations();
    const pending = reservations
      .filter((r: any) => ['pending', 'confirmed', 'picked_up'].includes(r.status))
      .reduce((sum: number, r: any) => sum + (r.total_price || 0), 0);
    
    res.json({
      success: true,
      data: { today, month, total, pending, byMonth }
    });
  } catch (error) {
    console.error('Admin revenue error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Delete contact
router.delete('/contacts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contact = await queries.getContactById(Number(id));
    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    await queries.deleteContact(Number(id));
    res.json({ success: true, message: 'Wiadomość usunięta' });
  } catch (error) {
    console.error('Admin delete contact error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Delete multiple contacts
router.post('/contacts/delete-many', adminAuth, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: 'Podaj listę ID do usunięcia' });
      return;
    }

    await queries.deleteContacts(ids.map(Number));

    res.json({ 
      success: true, 
      message: `Usunięto ${ids.length} wiadomości`,
      deleted: ids.length
    });
  } catch (error) {
    console.error('Admin delete contacts error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Get contact with replies
router.get('/contacts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contact = await queries.getContactById(Number(id));

    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    const replies = await queries.getRepliesByContact(Number(id));
    res.json({ success: true, data: { ...contact, replies } });
  } catch (error) {
    console.error('Admin get contact error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Reply to contact
router.post('/contacts/:id/reply', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length < 5) {
      res.status(400).json({ 
        success: false, 
        message: 'Wiadomość musi mieć co najmniej 5 znaków' 
      });
      return;
    }

    const contact = await queries.getContactById(Number(id));
    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    await queries.insertContactReply({
      contactId: Number(id),
      message: message.trim(),
      sentBy: 'admin',
    });

    await queries.updateContactStatus({ id: Number(id), status: 'replied' });

    await sendContactReply(
      contact.email,
      contact.name,
      contact.subject,
      message.trim()
    );

    const replies = await queries.getRepliesByContact(Number(id));

    res.json({ 
      success: true, 
      message: 'Odpowiedź wysłana!',
      data: { replies }
    });
  } catch (error) {
    console.error('Admin reply error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Send reminders
router.post('/send-reminders', adminAuth, async (_req: Request, res: Response) => {
  try {
    const { sendPickupReminderEmail, sendReturnReminderEmail } = await import('./email.js');
    
    const allReservations = await queries.getReservations();
    console.log(`📊 Total reservations: ${allReservations.length}`);
    
    const pickupReminders = await queries.getReservationsForPickupReminder();
    const returnReminders = await queries.getReservationsForReturnReminder();
    
    console.log(`📬 Pickup reminders: ${pickupReminders.length}`);
    console.log(`📬 Return reminders: ${returnReminders.length}`);
    
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
        console.error(`Failed to send pickup reminder to ${reservation.email}:`, err);
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
        console.error(`Failed to send return reminder to ${reservation.email}:`, err);
      }
    }
    
    res.json({
      success: true,
      message: `Wysłano przypomnienia: ${sentPickup} o odbiorze, ${sentReturn} o zwrocie`,
      data: {
        pickupReminders: sentPickup,
        returnReminders: sentReturn,
        debug: {
          totalReservations: allReservations.length,
          foundForPickup: pickupReminders.length,
          foundForReturn: returnReminders.length,
        }
      }
    });
  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Debug reminders
router.get('/debug-reminders', adminAuth, async (_req: Request, res: Response) => {
  try {
    const allReservations = await queries.getReservations();
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      todayDate: todayStr,
      tomorrowDate: tomorrowStr,
      totalReservations: allReservations.length,
      reservations: allReservations.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        product_id: r.product_id,
        status: r.status,
        start_date: r.start_date,
        end_date: r.end_date,
        needsPickupReminder: ['pending', 'confirmed'].includes(r.status) && 
          (r.start_date === todayStr || r.start_date === tomorrowStr),
        needsReturnReminder: r.status === 'picked_up' && r.end_date === tomorrowStr,
      }))
    });
  } catch (error) {
    console.error('Debug reminders error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Test reminder email
router.post('/test-reminder-email', adminAuth, async (req: Request, res: Response) => {
  try {
    const { email, type } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email jest wymagany' });
    }
    
    const { sendPickupReminderEmail, sendReturnReminderEmail } = await import('./email.js');
    
    const testReservation = {
      email,
      name: 'Test User',
      productName: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
      startDate: '2026-01-22',
      endDate: '2026-01-25',
    };
    
    let result;
    if (type === 'return') {
      result = await sendReturnReminderEmail(testReservation);
    } else {
      result = await sendPickupReminderEmail(testReservation);
    }
    
    res.json({
      success: true,
      message: `Wysłano testowy email przypomnienia (${type || 'pickup'}) do ${email}`,
      result
    });
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, message: error.message || 'Błąd serwera' });
  }
});

// === NEWSLETTER ===

router.get('/newsletter/subscribers', adminAuth, async (_req: Request, res: Response) => {
  try {
    const subscribers = await queries.getAllSubscribers();
    const activeCount = (await queries.getActiveSubscribersCount())?.count || 0;

    res.json({
      success: true,
      data: subscribers,
      stats: { activeCount }
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.delete('/newsletter/subscribers/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queries.deleteSubscriber(Number(id));
    res.json({ success: true, message: 'Subskrybent usunięty' });
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.get('/newsletter/posts', adminAuth, async (_req: Request, res: Response) => {
  try {
    const posts = await queries.getPosts();
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.post('/newsletter/posts', adminAuth, async (req: Request, res: Response) => {
  try {
    const data = newsletterPostSchema.parse(req.body);
    const result = await queries.insertPost({
      title: data.title,
      content: data.content,
      status: 'draft',
    });

    res.status(201).json({
      success: true,
      message: 'Post utworzony',
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.patch('/newsletter/posts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = newsletterPostSchema.parse(req.body);

    await queries.updatePost({
      id: Number(id),
      title: data.title,
      content: data.content,
      status: data.status || 'draft',
    });

    res.json({ success: true, message: 'Post zaktualizowany' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.delete('/newsletter/posts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queries.deletePost(Number(id));
    res.json({ success: true, message: 'Post usunięty' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.post('/newsletter/posts/:id/send', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const post = await queries.getPostById(Number(id));
    
    if (!post) {
      res.status(404).json({ success: false, message: 'Post nie znaleziony' });
      return;
    }

    const subscribers = await queries.getSubscribers();
    
    if (subscribers.length === 0) {
      res.status(400).json({ 
        success: false, 
        message: 'Brak aktywnych subskrybentów' 
      });
      return;
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const subscriber of subscribers) {
      try {
        await sendNewsletterEmail({
          email: subscriber.email,
          name: subscriber.name,
          title: post.title,
          content: post.content,
        });
        sentCount++;
      } catch (err) {
        failedCount++;
        console.error(`Failed to send to ${subscriber.email}:`, err);
      }
    }

    await queries.markPostAsSent({ id: Number(id), sentCount });

    res.json({
      success: true,
      message: `Newsletter wysłany do ${sentCount} subskrybentów`,
      data: { sentCount, failedCount }
    });
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.get('/newsletter/stats', adminAuth, async (_req: Request, res: Response) => {
  try {
    const subscribers = await queries.getAllSubscribers();
    const posts = await queries.getPosts();
    const activeCount = (await queries.getActiveSubscribersCount())?.count || 0;
    const sentPosts = posts.filter((p: any) => p.status === 'sent').length;

    res.json({
      success: true,
      data: {
        totalSubscribers: subscribers.length,
        activeSubscribers: activeCount,
        totalPosts: posts.length,
        sentPosts,
      }
    });
  } catch (error) {
    console.error('Get newsletter stats error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// === NOTIFICATIONS ===

router.get('/notifications', adminAuth, async (_req: Request, res: Response) => {
  try {
    const notifications = await queries.getProductNotifications();
    
    const enrichedNotifications = notifications.map((n: any) => ({
      ...n,
      productName: productNames[n.product_id] || n.product_id,
    }));

    res.json({ success: true, data: enrichedNotifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.get('/notifications/stats', adminAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await queries.getNotificationStats();

    res.json({
      success: true,
      data: {
        total: stats?.total || 0,
        waiting: stats?.waiting || 0,
        sent: stats?.sent || 0,
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.delete('/notifications/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queries.deleteProductNotification(Number(id));
    res.json({ success: true, message: 'Powiadomienie usunięte' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.post('/notifications/send/:productId', adminAuth, async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;
    const productName = productNames[productId];
    
    if (!productName) {
      res.status(400).json({ success: false, message: 'Produkt nie istnieje' });
      return;
    }

    const notifications = await queries.getWaitingNotificationsForProduct(productId);

    if (notifications.length === 0) {
      res.json({ success: true, message: 'Brak osób oczekujących' });
      return;
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const notification of notifications) {
      try {
        const result = await sendProductAvailabilityNotification(
          notification.email,
          productName,
          productId
        );
        
        if (result.success) {
          await queries.markNotificationAsSent(notification.id);
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Wysłano ${sentCount} powiadomień`,
      data: { sentCount, failedCount }
    });
  } catch (error) {
    console.error('Send notifications error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

export default router;
