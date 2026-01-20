import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file in server root
const dbPath = path.join(__dirname, '..', '..', 'data', 'wb-rent.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize tables
export function initializeDatabase() {
  // Contacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      honeypot TEXT,
      ip_address TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add status column if missing (migration)
  try {
    db.exec(`ALTER TABLE contacts ADD COLUMN status TEXT DEFAULT 'new'`);
  } catch (e) {
    // Column already exists
  }

  // Contact replies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      sent_by TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    )
  `);

  // Reservations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Product info
      category_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      
      -- Dates
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      
      -- Location
      city TEXT,
      delivery INTEGER DEFAULT 0,
      address TEXT,
      
      -- Customer info
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      company TEXT,
      
      -- Invoice data
      wants_invoice INTEGER DEFAULT 0,
      invoice_nip TEXT,
      invoice_company TEXT,
      invoice_address TEXT,
      
      -- Additional
      notes TEXT,
      
      -- Calculated
      days INTEGER NOT NULL,
      base_price REAL NOT NULL,
      delivery_fee REAL DEFAULT 0,
      total_price REAL NOT NULL,
      
      -- Meta
      ip_address TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Newsletter subscribers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at DATETIME
    )
  `);

  // Newsletter/News posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      sent_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME
    )
  `);

  // Product availability notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT DEFAULT 'waiting',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notified_at DATETIME,
      UNIQUE(product_id, email)
    )
  `);

  // Migration: Add invoice columns to reservations table if they don't exist
  try {
    db.exec(`ALTER TABLE reservations ADD COLUMN wants_invoice INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE reservations ADD COLUMN invoice_nip TEXT`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE reservations ADD COLUMN invoice_company TEXT`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE reservations ADD COLUMN invoice_address TEXT`);
  } catch (e) { /* Column already exists */ }

  console.log('✅ Database initialized');
}

// Lazy-initialized prepared statements
let _queries: ReturnType<typeof createQueries> | null = null;

function createQueries() {
  return {
    // Contacts
    insertContact: db.prepare(`
      INSERT INTO contacts (name, email, subject, message, honeypot, ip_address)
      VALUES (@name, @email, @subject, @message, @honeypot, @ipAddress)
    `),

    getContacts: db.prepare(`
      SELECT * FROM contacts ORDER BY created_at DESC
    `),

    // Reservations
    insertReservation: db.prepare(`
      INSERT INTO reservations (
        category_id, product_id, start_date, end_date,
        city, delivery, address,
        name, email, phone, company, notes,
        wants_invoice, invoice_nip, invoice_company, invoice_address,
        days, base_price, delivery_fee, total_price,
        ip_address
      ) VALUES (
        @categoryId, @productId, @startDate, @endDate,
        @city, @delivery, @address,
        @name, @email, @phone, @company, @notes,
        @wantsInvoice, @invoiceNip, @invoiceCompany, @invoiceAddress,
        @days, @basePrice, @deliveryFee, @totalPrice,
        @ipAddress
      )
    `),

    getReservations: db.prepare(`
      SELECT * FROM reservations ORDER BY created_at DESC
    `),

    getReservationById: db.prepare(`
      SELECT * FROM reservations WHERE id = ?
    `),

    updateReservationStatus: db.prepare(`
      UPDATE reservations SET status = @status WHERE id = @id
    `),

    getReservationsByStatus: db.prepare(`
      SELECT * FROM reservations WHERE status = ? ORDER BY created_at DESC
    `),

    getReservationsByProduct: db.prepare(`
      SELECT * FROM reservations WHERE product_id = ? AND status != 'cancelled' AND status != 'rejected' ORDER BY start_date ASC
    `),

    // Check date availability - returns conflicting reservations
    // Two date ranges overlap if: startA < endB AND endA > startB
    checkDateAvailability: db.prepare(`
      SELECT id, start_date, end_date, name, status 
      FROM reservations 
      WHERE product_id = @productId 
        AND status IN ('pending', 'confirmed', 'picked_up')
        AND start_date < @endDate 
        AND end_date > @startDate
    `),

    // Get products currently reserved (for today availability display)
    getReservedProductsToday: db.prepare(`
      SELECT DISTINCT product_id 
      FROM reservations 
      WHERE status IN ('pending', 'confirmed', 'picked_up')
        AND start_date <= @today 
        AND end_date >= @today
    `),

    // Delete contact
    deleteContact: db.prepare(`
      DELETE FROM contacts WHERE id = ?
    `),

    // Delete multiple contacts
    deleteContacts: db.prepare(`
      DELETE FROM contacts WHERE id IN (SELECT value FROM json_each(?))
    `),

    updateContactStatus: db.prepare(`
      UPDATE contacts SET status = @status WHERE id = @id
    `),

    getContactById: db.prepare(`
      SELECT * FROM contacts WHERE id = ?
    `),

    // Contact replies
    insertContactReply: db.prepare(`
      INSERT INTO contact_replies (contact_id, message, sent_by)
      VALUES (@contactId, @message, @sentBy)
    `),

    getRepliesByContact: db.prepare(`
      SELECT * FROM contact_replies WHERE contact_id = ? ORDER BY created_at ASC
    `),
    
    // Revenue statistics - only completed/returned reservations count as actual revenue
    getRevenueToday: db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as revenue
      FROM reservations 
      WHERE status IN ('completed', 'returned')
        AND date(created_at) = date('now', 'localtime')
    `),
    
    getRevenueThisMonth: db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as revenue
      FROM reservations 
      WHERE status IN ('completed', 'returned')
        AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
    `),
    
    getRevenueTotal: db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as revenue
      FROM reservations 
      WHERE status IN ('completed', 'returned')
    `),
    
    getRevenueByMonth: db.prepare(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        SUM(total_price) as revenue,
        COUNT(*) as count
      FROM reservations 
      WHERE status IN ('completed', 'returned')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
      LIMIT 12
    `),
    
    // Reservations for pickup/return reminders (tomorrow)
    getReservationsForPickupReminder: db.prepare(`
      SELECT * FROM reservations 
      WHERE status = 'confirmed'
        AND date(start_date) = date('now', '+1 day', 'localtime')
    `),
    
    getReservationsForReturnReminder: db.prepare(`
      SELECT * FROM reservations 
      WHERE status = 'picked_up'
        AND date(end_date) = date('now', '+1 day', 'localtime')
    `),

    // Newsletter subscribers
    insertSubscriber: db.prepare(`
      INSERT INTO newsletter_subscribers (email, name) VALUES (@email, @name)
    `),

    getSubscribers: db.prepare(`
      SELECT * FROM newsletter_subscribers WHERE status = 'active' ORDER BY created_at DESC
    `),

    getAllSubscribers: db.prepare(`
      SELECT * FROM newsletter_subscribers ORDER BY created_at DESC
    `),

    getSubscriberByEmail: db.prepare(`
      SELECT * FROM newsletter_subscribers WHERE email = ?
    `),

    getActiveSubscribersCount: db.prepare(`
      SELECT COUNT(*) as count FROM newsletter_subscribers WHERE status = 'active'
    `),

    unsubscribe: db.prepare(`
      UPDATE newsletter_subscribers SET status = 'inactive', unsubscribed_at = CURRENT_TIMESTAMP WHERE email = ?
    `),

    resubscribe: db.prepare(`
      UPDATE newsletter_subscribers SET status = 'active', unsubscribed_at = NULL WHERE email = ?
    `),

    deleteSubscriber: db.prepare(`
      DELETE FROM newsletter_subscribers WHERE id = ?
    `),

    // Newsletter posts
    insertPost: db.prepare(`
      INSERT INTO newsletter_posts (title, content, status) VALUES (@title, @content, @status)
    `),

    getPosts: db.prepare(`
      SELECT * FROM newsletter_posts ORDER BY created_at DESC
    `),

    getPostById: db.prepare(`
      SELECT * FROM newsletter_posts WHERE id = ?
    `),

    updatePost: db.prepare(`
      UPDATE newsletter_posts SET title = @title, content = @content, status = @status WHERE id = @id
    `),

    markPostAsSent: db.prepare(`
      UPDATE newsletter_posts SET status = 'sent', sent_at = CURRENT_TIMESTAMP, sent_count = @sentCount WHERE id = @id
    `),

    deletePost: db.prepare(`
      DELETE FROM newsletter_posts WHERE id = ?
    `),

    // Product availability notifications
    insertProductNotification: db.prepare(`
      INSERT OR IGNORE INTO product_notifications (product_id, email) VALUES (@productId, @email)
    `),

    getProductNotifications: db.prepare(`
      SELECT * FROM product_notifications ORDER BY created_at DESC
    `),

    getWaitingNotifications: db.prepare(`
      SELECT * FROM product_notifications WHERE status = 'waiting' ORDER BY created_at DESC
    `),

    getWaitingNotificationsForProduct: db.prepare(`
      SELECT * FROM product_notifications WHERE product_id = ? AND status = 'waiting'
    `),

    markNotificationAsSent: db.prepare(`
      UPDATE product_notifications SET status = 'sent', notified_at = CURRENT_TIMESTAMP WHERE id = ?
    `),

    deleteProductNotification: db.prepare(`
      DELETE FROM product_notifications WHERE id = ?
    `),

    getNotificationStats: db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
      FROM product_notifications
    `),
  };
}

// Get queries (lazy init after tables are created)
export function getQueries() {
  if (!_queries) {
    _queries = createQueries();
  }
  return _queries;
}
