import Database from 'better-sqlite3';
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

export const db = new Database(dbPath);

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      city TEXT NOT NULL,
      delivery INTEGER DEFAULT 0,
      address TEXT,
      
      -- Customer info
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      company TEXT,
      
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
        days, base_price, delivery_fee, total_price,
        ip_address
      ) VALUES (
        @categoryId, @productId, @startDate, @endDate,
        @city, @delivery, @address,
        @name, @email, @phone, @company, @notes,
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
  };
}

// Get queries (lazy init after tables are created)
export function getQueries() {
  if (!_queries) {
    _queries = createQueries();
  }
  return _queries;
}
