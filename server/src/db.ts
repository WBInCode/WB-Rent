import { Pool } from 'pg';

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : false,
});

// Initialize tables
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Contacts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT,
        message TEXT NOT NULL,
        honeypot TEXT,
        ip_address TEXT,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Contact replies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_replies (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        sent_by TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Reservations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        category_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        city TEXT,
        delivery INTEGER DEFAULT 0,
        address TEXT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        company TEXT,
        wants_invoice INTEGER DEFAULT 0,
        invoice_nip TEXT,
        invoice_company TEXT,
        invoice_address TEXT,
        notes TEXT,
        days INTEGER NOT NULL,
        base_price REAL NOT NULL,
        delivery_fee REAL DEFAULT 0,
        total_price REAL NOT NULL,
        ip_address TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Newsletter subscribers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unsubscribed_at TIMESTAMP
      )
    `);

    // Newsletter posts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_posts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        sent_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      )
    `);

    // Product availability notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_notifications (
        id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT DEFAULT 'waiting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notified_at TIMESTAMP,
        UNIQUE(product_id, email)
      )
    `);

    console.log('✅ PostgreSQL database initialized');
  } finally {
    client.release();
  }
}

// Query helper functions
export const queries = {
  // Contacts
  insertContact: async (data: {
    name: string;
    email: string;
    subject?: string;
    message: string;
    honeypot?: string;
    ipAddress?: string;
  }) => {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, subject, message, honeypot, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.name, data.email, data.subject, data.message, data.honeypot, data.ipAddress]
    );
    return { lastInsertRowid: result.rows[0].id };
  },

  getContacts: async () => {
    const result = await pool.query(`SELECT * FROM contacts ORDER BY created_at DESC`);
    return result.rows;
  },

  getContactById: async (id: number) => {
    const result = await pool.query(`SELECT * FROM contacts WHERE id = $1`, [id]);
    return result.rows[0];
  },

  updateContactStatus: async (data: { id: number; status: string }) => {
    await pool.query(`UPDATE contacts SET status = $1 WHERE id = $2`, [data.status, data.id]);
  },

  deleteContact: async (id: number) => {
    await pool.query(`DELETE FROM contacts WHERE id = $1`, [id]);
  },

  deleteContacts: async (ids: number[]) => {
    await pool.query(`DELETE FROM contacts WHERE id = ANY($1::int[])`, [ids]);
  },

  // Contact replies
  insertContactReply: async (data: { contactId: number; message: string; sentBy: string }) => {
    await pool.query(
      `INSERT INTO contact_replies (contact_id, message, sent_by) VALUES ($1, $2, $3)`,
      [data.contactId, data.message, data.sentBy]
    );
  },

  getRepliesByContact: async (contactId: number) => {
    const result = await pool.query(
      `SELECT * FROM contact_replies WHERE contact_id = $1 ORDER BY created_at ASC`,
      [contactId]
    );
    return result.rows;
  },

  // Reservations
  insertReservation: async (data: {
    categoryId: string;
    productId: string;
    startDate: string;
    endDate: string;
    city?: string;
    delivery: number;
    address?: string;
    name: string;
    email: string;
    phone: string;
    company?: string;
    notes?: string;
    wantsInvoice: number;
    invoiceNip?: string;
    invoiceCompany?: string;
    invoiceAddress?: string;
    days: number;
    basePrice: number;
    deliveryFee: number;
    totalPrice: number;
    ipAddress?: string;
  }) => {
    const result = await pool.query(
      `INSERT INTO reservations (
        category_id, product_id, start_date, end_date,
        city, delivery, address,
        name, email, phone, company, notes,
        wants_invoice, invoice_nip, invoice_company, invoice_address,
        days, base_price, delivery_fee, total_price,
        ip_address
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING id`,
      [
        data.categoryId, data.productId, data.startDate, data.endDate,
        data.city, data.delivery, data.address,
        data.name, data.email, data.phone, data.company, data.notes,
        data.wantsInvoice, data.invoiceNip, data.invoiceCompany, data.invoiceAddress,
        data.days, data.basePrice, data.deliveryFee, data.totalPrice,
        data.ipAddress
      ]
    );
    return { lastInsertRowid: result.rows[0].id };
  },

  getReservations: async () => {
    const result = await pool.query(`SELECT * FROM reservations ORDER BY created_at DESC`);
    return result.rows;
  },

  getReservationById: async (id: number) => {
    const result = await pool.query(`SELECT * FROM reservations WHERE id = $1`, [id]);
    return result.rows[0];
  },

  updateReservationStatus: async (data: { id: number; status: string }) => {
    await pool.query(`UPDATE reservations SET status = $1 WHERE id = $2`, [data.status, data.id]);
  },

  getReservationsByStatus: async (status: string) => {
    const result = await pool.query(
      `SELECT * FROM reservations WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );
    return result.rows;
  },

  getReservationsByProduct: async (productId: string) => {
    const result = await pool.query(
      `SELECT * FROM reservations WHERE product_id = $1 AND status NOT IN ('cancelled', 'rejected') ORDER BY start_date ASC`,
      [productId]
    );
    return result.rows;
  },

  checkDateAvailability: async (data: { productId: string; startDate: string; endDate: string }) => {
    const result = await pool.query(
      `SELECT id, start_date, end_date, name, status 
       FROM reservations 
       WHERE product_id = $1 
         AND status IN ('pending', 'confirmed', 'picked_up')
         AND start_date < $2 
         AND end_date > $3`,
      [data.productId, data.endDate, data.startDate]
    );
    return result.rows;
  },

  getReservedProductsToday: async (today: string) => {
    const result = await pool.query(
      `SELECT DISTINCT product_id 
       FROM reservations 
       WHERE status IN ('pending', 'confirmed', 'picked_up')
         AND start_date <= $1 
         AND end_date >= $1`,
      [today]
    );
    return result.rows;
  },

  // Revenue
  getRevenueToday: async () => {
    const result = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) as revenue
       FROM reservations 
       WHERE status IN ('completed', 'returned')
         AND DATE(created_at) = CURRENT_DATE`
    );
    return result.rows[0];
  },

  getRevenueThisMonth: async () => {
    const result = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) as revenue
       FROM reservations 
       WHERE status IN ('completed', 'returned')
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
    );
    return result.rows[0];
  },

  getRevenueTotal: async () => {
    const result = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) as revenue
       FROM reservations 
       WHERE status IN ('completed', 'returned')`
    );
    return result.rows[0];
  },

  getRevenueByMonth: async () => {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        SUM(total_price) as revenue,
        COUNT(*) as count
       FROM reservations 
       WHERE status IN ('completed', 'returned')
       GROUP BY TO_CHAR(created_at, 'YYYY-MM')
       ORDER BY month DESC
       LIMIT 12`
    );
    return result.rows;
  },

  // Reminders
  getReservationsForPickupReminder: async () => {
    const result = await pool.query(
      `SELECT * FROM reservations 
       WHERE status IN ('pending', 'confirmed')
         AND (DATE(start_date) = CURRENT_DATE + INTERVAL '1 day'
              OR DATE(start_date) = CURRENT_DATE)`
    );
    return result.rows;
  },

  getReservationsForReturnReminder: async () => {
    const result = await pool.query(
      `SELECT * FROM reservations 
       WHERE status = 'picked_up'
         AND DATE(end_date) = CURRENT_DATE + INTERVAL '1 day'`
    );
    return result.rows;
  },

  // Newsletter subscribers
  insertSubscriber: async (data: { email: string; name?: string }) => {
    const result = await pool.query(
      `INSERT INTO newsletter_subscribers (email, name) VALUES ($1, $2) RETURNING id`,
      [data.email, data.name]
    );
    return { lastInsertRowid: result.rows[0].id };
  },

  getSubscribers: async () => {
    const result = await pool.query(
      `SELECT * FROM newsletter_subscribers WHERE status = 'active' ORDER BY created_at DESC`
    );
    return result.rows;
  },

  getAllSubscribers: async () => {
    const result = await pool.query(`SELECT * FROM newsletter_subscribers ORDER BY created_at DESC`);
    return result.rows;
  },

  getSubscriberByEmail: async (email: string) => {
    const result = await pool.query(`SELECT * FROM newsletter_subscribers WHERE email = $1`, [email]);
    return result.rows[0];
  },

  getActiveSubscribersCount: async () => {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM newsletter_subscribers WHERE status = 'active'`
    );
    return result.rows[0];
  },

  unsubscribe: async (email: string) => {
    await pool.query(
      `UPDATE newsletter_subscribers SET status = 'inactive', unsubscribed_at = CURRENT_TIMESTAMP WHERE email = $1`,
      [email]
    );
  },

  resubscribe: async (email: string) => {
    await pool.query(
      `UPDATE newsletter_subscribers SET status = 'active', unsubscribed_at = NULL WHERE email = $1`,
      [email]
    );
  },

  deleteSubscriber: async (id: number) => {
    await pool.query(`DELETE FROM newsletter_subscribers WHERE id = $1`, [id]);
  },

  // Newsletter posts
  insertPost: async (data: { title: string; content: string; status: string }) => {
    const result = await pool.query(
      `INSERT INTO newsletter_posts (title, content, status) VALUES ($1, $2, $3) RETURNING id`,
      [data.title, data.content, data.status]
    );
    return { lastInsertRowid: result.rows[0].id };
  },

  getPosts: async () => {
    const result = await pool.query(`SELECT * FROM newsletter_posts ORDER BY created_at DESC`);
    return result.rows;
  },

  getPostById: async (id: number) => {
    const result = await pool.query(`SELECT * FROM newsletter_posts WHERE id = $1`, [id]);
    return result.rows[0];
  },

  updatePost: async (data: { id: number; title: string; content: string; status: string }) => {
    await pool.query(
      `UPDATE newsletter_posts SET title = $1, content = $2, status = $3 WHERE id = $4`,
      [data.title, data.content, data.status, data.id]
    );
  },

  markPostAsSent: async (data: { id: number; sentCount: number }) => {
    await pool.query(
      `UPDATE newsletter_posts SET status = 'sent', sent_at = CURRENT_TIMESTAMP, sent_count = $1 WHERE id = $2`,
      [data.sentCount, data.id]
    );
  },

  deletePost: async (id: number) => {
    await pool.query(`DELETE FROM newsletter_posts WHERE id = $1`, [id]);
  },

  // Product notifications
  insertProductNotification: async (data: { productId: string; email: string }) => {
    await pool.query(
      `INSERT INTO product_notifications (product_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [data.productId, data.email]
    );
  },

  getProductNotifications: async () => {
    const result = await pool.query(
      `SELECT * FROM product_notifications ORDER BY created_at DESC`
    );
    return result.rows;
  },

  getWaitingNotifications: async () => {
    const result = await pool.query(
      `SELECT * FROM product_notifications WHERE status = 'waiting' ORDER BY created_at DESC`
    );
    return result.rows;
  },

  getWaitingNotificationsForProduct: async (productId: string) => {
    const result = await pool.query(
      `SELECT * FROM product_notifications WHERE product_id = $1 AND status = 'waiting'`,
      [productId]
    );
    return result.rows;
  },

  markNotificationAsSent: async (id: number) => {
    await pool.query(
      `UPDATE product_notifications SET status = 'sent', notified_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  },

  deleteProductNotification: async (id: number) => {
    await pool.query(`DELETE FROM product_notifications WHERE id = $1`, [id]);
  },

  getNotificationStats: async () => {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
       FROM product_notifications`
    );
    return result.rows[0];
  },
};

// Legacy function for compatibility
export function getQueries() {
  return queries;
}
