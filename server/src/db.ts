import pg from 'pg';
import { Pool } from 'pg';

// Return Postgres DATE columns as plain 'YYYY-MM-DD' strings
// (default pg behavior converts to JS Date in local TZ, which shifts dates in emails/JSON)
pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);

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
        start_time TEXT DEFAULT '09:00',
        end_time TEXT DEFAULT '09:00',
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

    // App settings (key-value; e.g. admin password hash override)
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Versioned migrations (for schema changes beyond CREATE IF NOT EXISTS)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runMigrations(client);

    console.log('✅ PostgreSQL database initialized');
  } finally {
    client.release();
  }
}

// === MIGRATIONS ===
// Append-only list. Each entry runs once (tracked in schema_migrations).
const migrations: Array<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: 'add-reservation-time-columns',
    sql: `ALTER TABLE reservations
            ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '09:00',
            ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '09:00'`,
  },
  {
    version: 2,
    name: 'index-reservations-product-dates',
    sql: `CREATE INDEX IF NOT EXISTS idx_reservations_product_dates
            ON reservations (product_id, start_date, end_date)`,
  },
  {
    version: 3,
    name: 'payments',
    sql: `
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        external_id TEXT,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'PLN',
        status TEXT DEFAULT 'pending',
        redirect_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP
      );
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
        ADD COLUMN IF NOT EXISTS payment_provider TEXT;
      CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments (reservation_id);
    `,
  },
  {
    version: 4,
    name: 'rental-contracts',
    sql: `
      CREATE TABLE IF NOT EXISTS rental_contracts (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE RESTRICT,
        contract_number TEXT NOT NULL UNIQUE,
        template_version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready',
        snapshot_encrypted TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        signature_encrypted TEXT,
        signature_hash TEXT,
        signing_token_hash TEXT NOT NULL UNIQUE,
        signing_expires_at TIMESTAMP NOT NULL,
        signed_name TEXT,
        signed_ip TEXT,
        signed_user_agent TEXT,
        consent_at TIMESTAMP,
        signed_at TIMESTAMP,
        pdf_path TEXT,
        pdf_hash TEXT,
        email_sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'not_prepared';
      CREATE INDEX IF NOT EXISTS idx_contracts_status ON rental_contracts (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_contracts_token ON rental_contracts (signing_token_hash);
    `,
  },
];

async function runMigrations(client: import('pg').PoolClient) {
  for (const m of migrations) {
    const applied = await client.query(`SELECT 1 FROM schema_migrations WHERE version = $1`, [m.version]);
    if (applied.rowCount) continue;
    await client.query('BEGIN');
    try {
      await client.query(m.sql);
      await client.query(`INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`, [m.version, m.name]);
      await client.query('COMMIT');
      console.log(`✅ Migration ${m.version} (${m.name}) applied`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
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
    startTime: string;
    endTime: string;
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
        category_id, product_id, start_date, end_date, start_time, end_time,
        city, delivery, address,
        name, email, phone, company, notes,
        wants_invoice, invoice_nip, invoice_company, invoice_address,
        days, base_price, delivery_fee, total_price,
        ip_address
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      ) RETURNING id`,
      [
        data.categoryId, data.productId, data.startDate, data.endDate, data.startTime, data.endTime,
        data.city, data.delivery, data.address,
        data.name, data.email, data.phone, data.company, data.notes,
        data.wantsInvoice, data.invoiceNip, data.invoiceCompany, data.invoiceAddress,
        data.days, data.basePrice, data.deliveryFee, data.totalPrice,
        data.ipAddress
      ]
    );
    return { lastInsertRowid: result.rows[0].id };
  },

  /**
   * Atomically check availability and insert the reservation.
   * Uses a per-product advisory lock inside a transaction, so two concurrent
   * requests for the same product cannot both pass the conflict check.
   * Returns { conflicts } when the term is taken, { lastInsertRowid } on success.
   */
  createReservationIfAvailable: async (data: {
    categoryId: string;
    productId: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
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
  }): Promise<{ lastInsertRowid?: number; conflicts?: any[] }> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize bookings per product (lock released on COMMIT/ROLLBACK)
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [data.productId]);

      const conflictCheck = await client.query(
        `SELECT id, start_date, end_date, name, status
         FROM reservations
         WHERE product_id = $1
           AND status IN ('pending', 'confirmed', 'picked_up')
           AND start_date < $2
           AND end_date > $3`,
        [data.productId, data.endDate, data.startDate]
      );

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return { conflicts: conflictCheck.rows };
      }

      const result = await client.query(
        `INSERT INTO reservations (
          category_id, product_id, start_date, end_date, start_time, end_time,
          city, delivery, address,
          name, email, phone, company, notes,
          wants_invoice, invoice_nip, invoice_company, invoice_address,
          days, base_price, delivery_fee, total_price,
          ip_address
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
        ) RETURNING id`,
        [
          data.categoryId, data.productId, data.startDate, data.endDate, data.startTime, data.endTime,
          data.city, data.delivery, data.address,
          data.name, data.email, data.phone, data.company, data.notes,
          data.wantsInvoice, data.invoiceNip, data.invoiceCompany, data.invoiceAddress,
          data.days, data.basePrice, data.deliveryFee, data.totalPrice,
          data.ipAddress
        ]
      );

      await client.query('COMMIT');
      return { lastInsertRowid: result.rows[0].id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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

  getReservationsByEmail: async (email: string) => {
    const result = await pool.query(
      `SELECT id, product_id, start_date, end_date, start_time, end_time,
              status, days, total_price, delivery, city, created_at,
              payment_status, payment_provider
       FROM reservations
       WHERE LOWER(email) = LOWER($1)
       ORDER BY start_date DESC`,
      [email]
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

  // App settings (key-value)
  getSetting: async (key: string): Promise<string | null> => {
    const result = await pool.query(`SELECT value FROM app_settings WHERE key = $1`, [key]);
    return result.rows[0]?.value ?? null;
  },

  setSetting: async (key: string, value: string) => {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  },

  // === PAYMENTS ===
  insertPayment: async (data: {
    reservationId: number;
    provider: string;
    sessionId: string;
    externalId?: string;
    amount: number;
    redirectUrl?: string;
  }) => {
    const result = await pool.query(
      `INSERT INTO payments (reservation_id, provider, session_id, external_id, amount, redirect_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.reservationId, data.provider, data.sessionId, data.externalId, data.amount, data.redirectUrl]
    );
    return { lastInsertRowid: result.rows[0].id };
  },

  getPaymentBySessionId: async (sessionId: string) => {
    const result = await pool.query(`SELECT * FROM payments WHERE session_id = $1`, [sessionId]);
    return result.rows[0];
  },

  getLatestPaymentForReservation: async (reservationId: number) => {
    const result = await pool.query(
      `SELECT * FROM payments WHERE reservation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [reservationId]
    );
    return result.rows[0];
  },

  /** Update payment + mirror the status onto the reservation. */
  updatePaymentStatus: async (data: {
    sessionId: string;
    status: string; // pending/paid/failed/cancelled
    externalId?: string;
  }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const payment = await client.query(
        `UPDATE payments
         SET status = $1,
             external_id = COALESCE($2, external_id),
             paid_at = CASE WHEN $1 = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END
         WHERE session_id = $3
         RETURNING reservation_id, provider`,
        [data.status, data.externalId, data.sessionId]
      );

      const row = payment.rows[0];
      if (row) {
        await client.query(
          `UPDATE reservations SET payment_status = $1, payment_provider = $2 WHERE id = $3`,
          [data.status === 'paid' ? 'paid' : data.status, row.provider, row.reservation_id]
        );
      }
      await client.query('COMMIT');
      return row?.reservation_id as number | undefined;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // === RENTAL CONTRACTS ===
  getContractByReservationId: async (reservationId: number) => {
    const result = await pool.query(
      `SELECT * FROM rental_contracts WHERE reservation_id = $1`,
      [reservationId]
    );
    return result.rows[0];
  },

  getContractByTokenHash: async (tokenHash: string) => {
    const result = await pool.query(
      `SELECT * FROM rental_contracts WHERE signing_token_hash = $1`,
      [tokenHash]
    );
    return result.rows[0];
  },

  getContractById: async (id: number) => {
    const result = await pool.query(`SELECT * FROM rental_contracts WHERE id = $1`, [id]);
    return result.rows[0];
  },

  upsertContractSession: async (data: {
    reservationId: number;
    contractNumber: string;
    templateVersion: string;
    snapshotEncrypted: string;
    contentHash: string;
    signingTokenHash: string;
    signingExpiresAt: Date;
  }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO rental_contracts (
           reservation_id, contract_number, template_version, status,
           snapshot_encrypted, content_hash, signing_token_hash, signing_expires_at
         ) VALUES ($1, $2, $3, 'ready', $4, $5, $6, $7)
         ON CONFLICT (reservation_id) DO UPDATE SET
           contract_number = EXCLUDED.contract_number,
           template_version = EXCLUDED.template_version,
           status = 'ready',
           snapshot_encrypted = EXCLUDED.snapshot_encrypted,
           content_hash = EXCLUDED.content_hash,
           signing_token_hash = EXCLUDED.signing_token_hash,
           signing_expires_at = EXCLUDED.signing_expires_at,
           signature_encrypted = NULL,
           signature_hash = NULL,
           signed_name = NULL,
           signed_ip = NULL,
           signed_user_agent = NULL,
           consent_at = NULL,
           signed_at = NULL,
           pdf_path = NULL,
           pdf_hash = NULL,
           email_sent_at = NULL,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          data.reservationId,
          data.contractNumber,
          data.templateVersion,
          data.snapshotEncrypted,
          data.contentHash,
          data.signingTokenHash,
          data.signingExpiresAt,
        ]
      );
      await client.query(
        `UPDATE reservations SET contract_status = 'ready' WHERE id = $1`,
        [data.reservationId]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  markContractSigned: async (data: {
    id: number;
    signatureEncrypted: string;
    signatureHash: string;
    signedName: string;
    signedIp: string;
    signedUserAgent: string;
    pdfPath: string;
    pdfHash: string;
  }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE rental_contracts SET
           status = 'signed', signature_encrypted = $1, signature_hash = $2,
           signed_name = $3, signed_ip = $4, signed_user_agent = $5,
           consent_at = CURRENT_TIMESTAMP, signed_at = CURRENT_TIMESTAMP,
           pdf_path = $6, pdf_hash = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 AND status = 'ready'
         RETURNING reservation_id, signed_at`,
        [
          data.signatureEncrypted,
          data.signatureHash,
          data.signedName,
          data.signedIp,
          data.signedUserAgent,
          data.pdfPath,
          data.pdfHash,
          data.id,
        ]
      );
      const row = result.rows[0];
      if (row) {
        await client.query(
          `UPDATE reservations SET contract_status = 'signed' WHERE id = $1`,
          [row.reservation_id]
        );
      }
      await client.query('COMMIT');
      return row;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  markContractEmailed: async (id: number) => {
    await pool.query(
      `UPDATE rental_contracts SET email_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  },

  hasSignedContract: async (reservationId: number): Promise<boolean> => {
    const result = await pool.query(
      `SELECT 1 FROM rental_contracts WHERE reservation_id = $1 AND status = 'signed' LIMIT 1`,
      [reservationId]
    );
    return Boolean(result.rowCount);
  },
};

// Legacy function for compatibility
export function getQueries() {
  return queries;
}
