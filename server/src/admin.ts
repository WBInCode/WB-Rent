import { Router, type Request, type Response, type NextFunction } from 'express';
import { getQueries } from './db.js';
import { config } from './config.js';
import { sendContactReply, sendReservationStatusEmail, sendPickedUpEmail, sendReturnedEmail } from './email.js';

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
  
  // Simple token check (in production, use proper JWT)
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
router.get('/reservations', adminAuth, (req: Request, res: Response) => {
  try {
    const queries = getQueries();
    const status = req.query.status as string | undefined;
    
    let reservations;
    if (status && status !== 'all') {
      reservations = queries.getReservationsByStatus.all(status);
    } else {
      reservations = queries.getReservations.all();
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

    const queries = getQueries();
    
    // Get reservation before update
    const reservation = queries.getReservationById.get(Number(id)) as any;
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }
    
    // Update status
    queries.updateReservationStatus.run({ id: Number(id), status });
    
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
        // Don't fail the request if email fails
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
    }
    
    // 'completed' - no email to customer, just internal status
    
    const updated = queries.getReservationById.get(Number(id));

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
router.get('/reservations/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queries = getQueries();
    const reservation = queries.getReservationById.get(Number(id));

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
router.get('/contacts', adminAuth, (req: Request, res: Response) => {
  try {
    const queries = getQueries();
    const contacts = queries.getContacts.all();

    res.json({ success: true, data: contacts });
  } catch (error) {
    console.error('Admin contacts error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Update contact status
router.patch('/contacts/:id', adminAuth, (req: Request, res: Response) => {
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

    const queries = getQueries();
    queries.updateContactStatus.run({ id: Number(id), status });

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
router.get('/stats', adminAuth, (req: Request, res: Response) => {
  try {
    const queries = getQueries();
    const reservations = queries.getReservations.all() as any[];
    const contacts = queries.getContacts.all() as any[];

    const stats = {
      reservations: {
        total: reservations.length,
        pending: reservations.filter(r => r.status === 'pending').length,
        confirmed: reservations.filter(r => r.status === 'confirmed').length,
        picked_up: reservations.filter(r => r.status === 'picked_up').length,
        returned: reservations.filter(r => r.status === 'returned').length,
        completed: reservations.filter(r => r.status === 'completed').length,
        rejected: reservations.filter(r => r.status === 'rejected').length,
      },
      contacts: {
        total: contacts.length,
        new: contacts.filter(c => c.status === 'new' || !c.status).length,
      },
      revenue: {
        today: (queries.getRevenueToday.get() as any)?.revenue || 0,
        month: (queries.getRevenueThisMonth.get() as any)?.revenue || 0,
        total: (queries.getRevenueTotal.get() as any)?.revenue || 0,
        pending: reservations
          .filter(r => r.status === 'pending' || r.status === 'confirmed' || r.status === 'picked_up')
          .reduce((sum, r) => sum + (r.total_price || 0), 0),
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Revenue details endpoint
router.get('/revenue', adminAuth, (req: Request, res: Response) => {
  try {
    const queries = getQueries();
    
    const today = (queries.getRevenueToday.get() as any)?.revenue || 0;
    const month = (queries.getRevenueThisMonth.get() as any)?.revenue || 0;
    const total = (queries.getRevenueTotal.get() as any)?.revenue || 0;
    const byMonth = queries.getRevenueByMonth.all() as any[];
    
    const reservations = queries.getReservations.all() as any[];
    const pending = reservations
      .filter(r => r.status === 'pending' || r.status === 'confirmed' || r.status === 'picked_up')
      .reduce((sum, r) => sum + (r.total_price || 0), 0);
    
    res.json({
      success: true,
      data: {
        today,
        month,
        total,
        pending,
        byMonth,
      }
    });
  } catch (error) {
    console.error('Admin revenue error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Delete single contact
router.delete('/contacts/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queries = getQueries();
    
    const contact = queries.getContactById.get(Number(id));
    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    queries.deleteContact.run(Number(id));

    res.json({ success: true, message: 'Wiadomość usunięta' });
  } catch (error) {
    console.error('Admin delete contact error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Delete multiple contacts
router.post('/contacts/delete-many', adminAuth, (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: 'Podaj listę ID do usunięcia' });
      return;
    }

    const queries = getQueries();
    
    // Delete each contact
    const deleteStmt = queries.deleteContact;
    let deleted = 0;
    for (const id of ids) {
      try {
        deleteStmt.run(Number(id));
        deleted++;
      } catch (e) {
        // Skip if not found
      }
    }

    res.json({ 
      success: true, 
      message: `Usunięto ${deleted} wiadomości`,
      deleted
    });
  } catch (error) {
    console.error('Admin delete contacts error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Get single contact with replies
router.get('/contacts/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queries = getQueries();
    const contact = queries.getContactById.get(Number(id)) as any;

    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    const replies = queries.getRepliesByContact.all(Number(id));

    res.json({ success: true, data: { ...contact, replies } });
  } catch (error) {
    console.error('Admin get contact error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Reply to contact message
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

    const queries = getQueries();
    const contact = queries.getContactById.get(Number(id)) as any;

    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    // Save reply to database
    queries.insertContactReply.run({
      contactId: Number(id),
      message: message.trim(),
      sentBy: 'admin',
    });

    // Update contact status to replied
    queries.updateContactStatus.run({ id: Number(id), status: 'replied' });

    // Send email to customer
    await sendContactReply(
      contact.email,
      contact.name,
      contact.subject,
      message.trim()
    );

    // Get updated replies
    const replies = queries.getRepliesByContact.all(Number(id));

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

// Send reminders endpoint (can be called manually or via cron)
router.post('/send-reminders', adminAuth, async (req: Request, res: Response) => {
  try {
    const { sendPickupReminderEmail, sendReturnReminderEmail } = await import('./email.js');
    const queries = getQueries();
    
    // Get reservations needing pickup reminder (start date = tomorrow)
    const pickupReminders = queries.getReservationsForPickupReminder.all() as any[];
    
    // Get reservations needing return reminder (end date = tomorrow)
    const returnReminders = queries.getReservationsForReturnReminder.all() as any[];
    
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
      }
    });
  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

export default router;
