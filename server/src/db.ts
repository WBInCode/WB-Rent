import pg from 'pg';
import { Pool } from 'pg';
import { products, syncProductCatalog } from './products.js';

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
        end_date DATE,
        is_indefinite BOOLEAN NOT NULL DEFAULT FALSE,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    await seedProductCatalog(client);
    const catalog = await client.query(`SELECT * FROM products ORDER BY category_id, name`);
    syncProductCatalog(catalog.rows);

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
  {
    version: 5,
    name: 'lessor-contract-signature',
    sql: `
      ALTER TABLE rental_contracts
        ADD COLUMN IF NOT EXISTS lessor_signature_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS lessor_signature_hash TEXT;
    `,
  },
  {
    version: 6,
    name: 'indefinite-rentals-and-term-history',
    sql: `
      ALTER TABLE reservations
        ALTER COLUMN end_date DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS is_indefinite BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      CREATE TABLE IF NOT EXISTS reservation_term_changes (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        previous_end_date DATE,
        new_end_date DATE,
        previous_is_indefinite BOOLEAN NOT NULL DEFAULT FALSE,
        new_is_indefinite BOOLEAN NOT NULL DEFAULT FALSE,
        previous_days INTEGER NOT NULL,
        new_days INTEGER NOT NULL,
        previous_total_price REAL NOT NULL,
        new_total_price REAL NOT NULL,
        price_delta REAL NOT NULL,
        note TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_term_changes_reservation
        ON reservation_term_changes (reservation_id, created_at DESC);
    `,
  },
  {
    version: 7,
    name: 'reservation-status-history',
    sql: `
      CREATE TABLE IF NOT EXISTS reservation_status_changes (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        previous_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        note TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        notify_customer BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_status_changes_reservation
        ON reservation_status_changes (reservation_id, created_at DESC);
    `,
  },
  {
    version: 8,
    name: 'multi-item-reservations',
    sql: `
      CREATE TABLE IF NOT EXISTS reservation_items (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        item_price REAL NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(reservation_id, product_id)
      );
      INSERT INTO reservation_items (reservation_id, product_id, category_id, item_price, position)
      SELECT id, product_id, category_id, base_price, 0
      FROM reservations
      ON CONFLICT (reservation_id, product_id) DO NOTHING;
      CREATE INDEX IF NOT EXISTS idx_reservation_items_product
        ON reservation_items (product_id, reservation_id);
      CREATE INDEX IF NOT EXISTS idx_reservation_items_reservation
        ON reservation_items (reservation_id, position);
    `,
  },
  {
    version: 9,
    name: 'product-inventory',
    sql: `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category_id TEXT NOT NULL,
        image TEXT NOT NULL DEFAULT '/favicon.svg',
        price_per_day REAL NOT NULL CHECK (price_per_day >= 0),
        price_next_day REAL NOT NULL CHECK (price_next_day >= 0),
        price_weekend REAL NOT NULL CHECK (price_weekend >= 0),
        total_quantity INTEGER NOT NULL DEFAULT 1 CHECK (total_quantity >= 0),
        service_quantity INTEGER NOT NULL DEFAULT 0 CHECK (service_quantity >= 0 AND service_quantity <= total_quantity),
        condition_status TEXT NOT NULL DEFAULT 'good' CHECK (condition_status IN ('good', 'attention', 'service', 'damaged')),
        inventory_notes TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_products_active_category
        ON products (is_active, category_id, name);
    `,
  },
  {
    version: 10,
    name: 'product-image-gallery',
    sql: `
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
      UPDATE products
      SET images = jsonb_build_array(image)
      WHERE jsonb_array_length(images) = 0 AND image <> '';
    `,
  },
  {
    version: 11,
    name: 'documents-discounts-coupons',
    sql: `
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other'
          CHECK (category IN ('contract', 'invoice', 'protocol', 'identity', 'insurance', 'service', 'other')),
        reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
        customer_email TEXT NOT NULL DEFAULT '',
        document_date DATE,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
        file_hash TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'system')),
        notes TEXT NOT NULL DEFAULT '',
        uploaded_by TEXT NOT NULL DEFAULT '',
        archived_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_documents_archive
        ON documents (archived_at, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_documents_reservation
        ON documents (reservation_id);

      CREATE TABLE IF NOT EXISTS discounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
        value REAL NOT NULL CHECK (value > 0),
        scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'category', 'product')),
        scope_value TEXT NOT NULL DEFAULT '',
        min_days INTEGER NOT NULL DEFAULT 1 CHECK (min_days >= 1),
        min_total REAL NOT NULL DEFAULT 0 CHECK (min_total >= 0),
        starts_on DATE,
        ends_on DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_discounts_active
        ON discounts (is_active, scope, scope_value);

      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
        value REAL NOT NULL CHECK (value > 0),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')),
        customer_email TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        min_total REAL NOT NULL DEFAULT 0 CHECK (min_total >= 0),
        expires_on DATE,
        issued_for_reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
        used_reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
        used_at TIMESTAMP,
        issued_by TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        email_sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_coupons_status
        ON coupons (status, created_at DESC);

      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS discount_code TEXT,
        ADD COLUMN IF NOT EXISTS discount_label TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS discount_amount REAL NOT NULL DEFAULT 0;

      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS included_accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS optional_accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS accessory_price REAL NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 12,
    name: 'staff-pricing-and-handover-photos',
    sql: `
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS price_override_note TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS price_set_by TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS reservation_photos (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL DEFAULT '',
        phase TEXT NOT NULL CHECK (phase IN ('before', 'after')),
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
        file_hash TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        taken_by TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_reservation_photos
        ON reservation_photos (reservation_id, phase, created_at);
    `,
  },
  {
    version: 13,
    name: 'handover-protocol-signatures',
    sql: `
      ALTER TABLE rental_contracts
        ADD COLUMN IF NOT EXISTS handover_signature_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS handover_signature_hash TEXT,
        ADD COLUMN IF NOT EXISTS handover_lessor_signature_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS handover_lessor_signature_hash TEXT;
    `,
  },
  {
    version: 14,
    name: 'normalize-reservation-status',
    sql: `
      -- Rezerwacje z wystawiona umowa zostawaly w kolejce zapytan, bo status
      -- zmienial sie tylko po recznym kliknieciu. Maszyna stanow wymaga, zeby
      -- kolumna status odzwierciedlala rzeczywisty etap obslugi.
      UPDATE reservations
      SET status = 'confirmed'
      WHERE status = 'pending' AND contract_status IN ('ready', 'signed');
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

async function seedProductCatalog(client: import('pg').PoolClient) {
  for (const [id, product] of Object.entries(products)) {
    await client.query(
      `INSERT INTO products (
         id, name, category_id, image, images, price_per_day, price_next_day, price_weekend,
         description, features, included_accessories, optional_accessories, accessory_price
       ) VALUES ($1, $2, $3, $4, jsonb_build_array($4::text), $5, $6, $7,
                 $8, $9::jsonb, $10::jsonb, $11::jsonb, $12)
       ON CONFLICT (id) DO UPDATE SET
         image = CASE
           WHEN products.image = '/favicon.svg' THEN EXCLUDED.image
           ELSE products.image
         END,
         images = CASE
           WHEN products.images = '[]'::jsonb
             OR products.images = jsonb_build_array('/favicon.svg'::text)
           THEN EXCLUDED.images
           ELSE products.images
         END,
         -- Backfill offer details only while untouched, so admin edits survive.
         description = CASE
           WHEN products.description = '' THEN EXCLUDED.description
           ELSE products.description
         END,
         features = CASE
           WHEN products.features = '[]'::jsonb THEN EXCLUDED.features
           ELSE products.features
         END,
         included_accessories = CASE
           WHEN products.included_accessories = '[]'::jsonb THEN EXCLUDED.included_accessories
           ELSE products.included_accessories
         END,
         optional_accessories = CASE
           WHEN products.optional_accessories = '[]'::jsonb THEN EXCLUDED.optional_accessories
           ELSE products.optional_accessories
         END,
         accessory_price = CASE
           WHEN products.accessory_price = 0 THEN EXCLUDED.accessory_price
           ELSE products.accessory_price
         END`,
      [
        id, product.name, product.categoryId, product.image,
        product.pricePerDay, product.priceNextDay, product.priceWeekend,
        product.description ?? '',
        JSON.stringify(product.features ?? []),
        JSON.stringify(product.includedAccessories ?? []),
        JSON.stringify(product.optionalAccessories ?? []),
        product.accessoryPrice ?? 0,
      ]
    );
  }
}

// Query helper functions

/**
 * Units that may actually leave the counter. Equipment flagged as damaged or
 * sent to service is never bookable, no matter what the counters say - staff
 * marking a machine "uszkodzony" must actually block it.
 */
const rentableQuantitySql = (alias = 'p') =>
  `CASE WHEN ${alias}.condition_status IN ('damaged', 'service') THEN 0
        ELSE GREATEST(${alias}.total_quantity - ${alias}.service_quantity, 0) END`;

export const queries = {
  getProducts: async (includeInactive = false) => {
    const result = await pool.query(
      `SELECT p.*,
              ${rentableQuantitySql()} AS rentable_quantity,
              COUNT(DISTINCT r.id)::integer AS reserved_today,
              GREATEST(${rentableQuantitySql()} - COUNT(DISTINCT r.id)::integer, 0) AS available_today
       FROM products p
       LEFT JOIN reservation_items ri ON ri.product_id = p.id
       LEFT JOIN reservations r ON r.id = ri.reservation_id
         AND r.status IN ('pending', 'confirmed', 'picked_up')
         AND r.start_date <= CURRENT_DATE
         AND COALESCE(r.end_date, 'infinity'::date) >= CURRENT_DATE
       WHERE ($1::boolean OR p.is_active = TRUE)
       GROUP BY p.id
       ORDER BY p.category_id, p.name`,
      [includeInactive]
    );
    return result.rows;
  },

  getProductById: async (id: string) => {
    const result = await pool.query(
      `SELECT p.*, ${rentableQuantitySql()} AS rentable_quantity
       FROM products p WHERE p.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  getProductsByIds: async (ids: string[], includeInactive = false) => {
    const result = await pool.query(
      `SELECT * FROM products
       WHERE id = ANY($1::text[]) AND ($2::boolean OR is_active = TRUE)`,
      [ids, includeInactive]
    );
    return result.rows;
  },

  isProductImageInUse: async (url: string) => {
    const result = await pool.query(
      `SELECT 1 FROM products WHERE image = $1 OR images ? $1 LIMIT 1`,
      [url]
    );
    return Boolean(result.rowCount);
  },

  createProduct: async (data: {
    id: string;
    name: string;
    description: string;
    categoryId: string;
    image: string;
    images: string[];
    pricePerDay: number;
    priceNextDay: number;
    priceWeekend: number;
    totalQuantity: number;
    serviceQuantity: number;
    conditionStatus: string;
    inventoryNotes: string;
    features: string[];
    includedAccessories: string[];
    optionalAccessories: string[];
    accessoryPrice: number;
    isActive: boolean;
  }) => {
    const result = await pool.query(
      `INSERT INTO products (
         id, name, description, category_id, image, images,
         price_per_day, price_next_day, price_weekend,
         total_quantity, service_quantity, condition_status, inventory_notes, is_active,
         features, included_accessories, optional_accessories, accessory_price
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15::jsonb, $16::jsonb, $17::jsonb, $18)
       RETURNING *`,
      [
        data.id, data.name, data.description, data.categoryId, data.image, JSON.stringify(data.images),
        data.pricePerDay, data.priceNextDay, data.priceWeekend,
        data.totalQuantity, data.serviceQuantity, data.conditionStatus, data.inventoryNotes, data.isActive,
        JSON.stringify(data.features), JSON.stringify(data.includedAccessories),
        JSON.stringify(data.optionalAccessories), data.accessoryPrice,
      ]
    );
    syncProductCatalog(result.rows);
    return result.rows[0];
  },

  updateProduct: async (id: string, data: {
    name: string;
    description: string;
    categoryId: string;
    image: string;
    images: string[];
    pricePerDay: number;
    priceNextDay: number;
    priceWeekend: number;
    totalQuantity: number;
    serviceQuantity: number;
    conditionStatus: string;
    inventoryNotes: string;
    features: string[];
    includedAccessories: string[];
    optionalAccessories: string[];
    accessoryPrice: number;
    isActive: boolean;
  }) => {
    const result = await pool.query(
      `UPDATE products SET
         name = $2, description = $3, category_id = $4, image = $5, images = $6::jsonb,
         price_per_day = $7, price_next_day = $8, price_weekend = $9,
         total_quantity = $10, service_quantity = $11, condition_status = $12,
         inventory_notes = $13, is_active = $14,
         features = $15::jsonb, included_accessories = $16::jsonb,
         optional_accessories = $17::jsonb, accessory_price = $18,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [
        id, data.name, data.description, data.categoryId, data.image, JSON.stringify(data.images),
        data.pricePerDay, data.priceNextDay, data.priceWeekend,
        data.totalQuantity, data.serviceQuantity, data.conditionStatus, data.inventoryNotes, data.isActive,
        JSON.stringify(data.features), JSON.stringify(data.includedAccessories),
        JSON.stringify(data.optionalAccessories), data.accessoryPrice,
      ]
    );
    syncProductCatalog(result.rows);
    return result.rows[0];
  },

  /**
   * Highest number of this product booked at the same time from today on.
   * Lowering stock below it would leave active reservations without equipment.
   */
  getPeakActiveReservations: async (productId: string): Promise<number> => {
    const result = await pool.query(
      `WITH active AS (
         SELECT r.id, r.start_date AS starts, COALESCE(r.end_date, 'infinity'::date) AS ends
         FROM reservations r
         JOIN reservation_items ri ON ri.reservation_id = r.id
         WHERE ri.product_id = $1
           AND r.status IN ('pending', 'confirmed', 'picked_up')
           AND COALESCE(r.end_date, 'infinity'::date) > CURRENT_DATE
       )
       SELECT COALESCE(MAX(overlapping), 0)::integer AS peak
       FROM (
         SELECT COUNT(*)::integer AS overlapping
         FROM active a
         JOIN active b ON b.starts <= a.starts AND b.ends > a.starts
         GROUP BY a.id
       ) counts`,
      [productId]
    );
    return Number(result.rows[0]?.peak ?? 0);
  },

  deleteProduct: async (id: string) => {
    const result = await pool.query(
      `DELETE FROM products p
       WHERE p.id = $1
         AND NOT EXISTS (SELECT 1 FROM reservation_items ri WHERE ri.product_id = p.id)
       RETURNING id, images`,
      [id]
    );
    if (result.rowCount) delete products[id];
    return result.rows[0] || null;
  },

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
    endDate: string | null;
    isIndefinite: boolean;
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
        category_id, product_id, start_date, end_date, is_indefinite, start_time, end_time,
        city, delivery, address,
        name, email, phone, company, notes,
        wants_invoice, invoice_nip, invoice_company, invoice_address,
        days, base_price, delivery_fee, total_price,
        ip_address
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      ) RETURNING id`,
      [
        data.categoryId, data.productId, data.startDate, data.endDate, data.isIndefinite, data.startTime, data.endTime,
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
    productItems?: Array<{ productId: string; categoryId: string; itemPrice: number }>;
    startDate: string;
    endDate: string | null;
    isIndefinite: boolean;
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
    discountCode?: string | null;
    discountLabel?: string;
    discountAmount?: number;
    priceOverrideNote?: string;
    priceSetBy?: string;
    ipAddress?: string;
  }): Promise<{ lastInsertRowid?: number; conflicts?: any[]; couponError?: string }> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productItems = data.productItems?.length
        ? data.productItems
        : [{ productId: data.productId, categoryId: data.categoryId, itemPrice: data.basePrice }];
      const productIds = productItems.map((item) => item.productId).sort();

      // Stable lock order prevents deadlocks when concurrent bundles overlap.
      for (const productId of productIds) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [productId]);
      }

      const conflictCheck = await client.query(
        `SELECT requested.product_id,
                MIN(r.start_date) AS start_date,
                MAX(r.end_date) AS end_date,
                COUNT(DISTINCT r.id)::integer AS reserved_quantity,
                ${rentableQuantitySql()} AS rentable_quantity
         FROM unnest($1::text[]) AS requested(product_id)
         LEFT JOIN products p ON p.id = requested.product_id
         LEFT JOIN reservation_items ri ON ri.product_id = requested.product_id
         LEFT JOIN reservations r ON r.id = ri.reservation_id
           AND r.status IN ('pending', 'confirmed', 'picked_up')
           AND r.start_date < COALESCE($2::date, 'infinity'::date)
           AND COALESCE(r.end_date, 'infinity'::date) > $3::date
         GROUP BY requested.product_id, p.id, p.total_quantity, p.service_quantity, p.is_active, p.condition_status
         HAVING p.id IS NULL
            OR NOT p.is_active
            OR COUNT(DISTINCT r.id) >= ${rentableQuantitySql()}`,
        [productIds, data.endDate, data.startDate]
      );

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return { conflicts: conflictCheck.rows };
      }

      const result = await client.query(
        `INSERT INTO reservations (
          category_id, product_id, start_date, end_date, is_indefinite, start_time, end_time,
          city, delivery, address,
          name, email, phone, company, notes,
          wants_invoice, invoice_nip, invoice_company, invoice_address,
          days, base_price, delivery_fee, total_price,
          discount_code, discount_label, discount_amount,
          price_override_note, price_set_by,
          ip_address
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
        ) RETURNING id`,
        [
          data.categoryId, data.productId, data.startDate, data.endDate, data.isIndefinite, data.startTime, data.endTime,
          data.city, data.delivery, data.address,
          data.name, data.email, data.phone, data.company, data.notes,
          data.wantsInvoice, data.invoiceNip, data.invoiceCompany, data.invoiceAddress,
          data.days, data.basePrice, data.deliveryFee, data.totalPrice,
          data.discountCode || null, data.discountLabel || '', data.discountAmount || 0,
          data.priceOverrideNote || '', data.priceSetBy || '',
          data.ipAddress
        ]
      );

      // Redeeming inside the same transaction makes double-spend impossible:
      // the conditional UPDATE locks the row and only one request can win.
      if (data.discountCode) {
        const redeemed = await client.query(
          `UPDATE coupons
           SET status = 'used',
               used_at = CURRENT_TIMESTAMP,
               used_reservation_id = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE code = $2
             AND status = 'active'
             AND (expires_on IS NULL OR expires_on >= CURRENT_DATE)
           RETURNING id`,
          [result.rows[0].id, data.discountCode]
        );
        if (redeemed.rowCount === 0) {
          await client.query('ROLLBACK');
          return { couponError: 'Kupon jest nieaktywny, wygasł lub został już wykorzystany' };
        }
      }

      for (const [position, item] of productItems.entries()) {
        await client.query(
          `INSERT INTO reservation_items (
             reservation_id, product_id, category_id, item_price, position
           ) VALUES ($1, $2, $3, $4, $5)`,
          [result.rows[0].id, item.productId, item.categoryId, item.itemPrice, position]
        );
      }

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
    const result = await pool.query(
      `SELECT r.*,
              COALESCE((SELECT json_agg(ri ORDER BY ri.position, ri.id)
                        FROM reservation_items ri WHERE ri.reservation_id = r.id), '[]'::json) AS items
       FROM reservations r ORDER BY r.created_at DESC`
    );
    return result.rows;
  },

  getReservationById: async (id: number) => {
    const result = await pool.query(
      `SELECT r.*,
              COALESCE((SELECT json_agg(ri ORDER BY ri.position, ri.id)
                        FROM reservation_items ri WHERE ri.reservation_id = r.id), '[]'::json) AS items
       FROM reservations r WHERE r.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  getReservationItems: async (reservationId: number) => {
    const result = await pool.query(
      `SELECT product_id, category_id, item_price, position
       FROM reservation_items
       WHERE reservation_id = $1
       ORDER BY position, id`,
      [reservationId]
    );
    return result.rows;
  },

  updateReservationStatus: async (data: {
    id: number;
    status: string;
    note?: string;
    changedBy?: string;
    notifyCustomer?: boolean;
  }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query(
        `SELECT * FROM reservations WHERE id = $1 FOR UPDATE`,
        [data.id]
      );
      const current = currentResult.rows[0];
      if (!current) throw new Error('Rezerwacja nie istnieje');
      if (current.status === data.status) {
        await client.query('COMMIT');
        return { reservation: current, changed: false };
      }

      const updatedResult = await client.query(
        `UPDATE reservations
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [data.status, data.id]
      );
      await client.query(
        `INSERT INTO reservation_status_changes (
           reservation_id, previous_status, new_status, note, changed_by, notify_customer
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          data.id,
          current.status,
          data.status,
          data.note || 'Zmiana statusu',
          data.changedBy || 'System',
          data.notifyCustomer === true,
        ]
      );
      await client.query('COMMIT');
      return { reservation: updatedResult.rows[0], changed: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getReservationStatusChanges: async (id: number) => {
    const result = await pool.query(
      `SELECT * FROM reservation_status_changes
       WHERE reservation_id = $1
       ORDER BY created_at DESC, id DESC`,
      [id]
    );
    return result.rows;
  },

  getReservationActivationConflicts: async (data: {
    id: number;
    productIds: string[];
    startDate: string;
    endDate: string | null;
  }) => {
    const result = await pool.query(
      `SELECT requested.product_id,
              MIN(r.start_date) AS start_date,
              MAX(r.end_date) AS end_date,
              COUNT(DISTINCT r.id)::integer AS reserved_quantity,
              ${rentableQuantitySql()} AS rentable_quantity
       FROM unnest($1::text[]) AS requested(product_id)
       LEFT JOIN products p ON p.id = requested.product_id
       LEFT JOIN reservation_items ri ON ri.product_id = requested.product_id
       LEFT JOIN reservations r ON r.id = ri.reservation_id AND r.id <> $2
         AND r.status IN ('pending', 'confirmed', 'picked_up')
         AND r.start_date < COALESCE($3::date, 'infinity'::date)
         AND COALESCE(r.end_date, 'infinity'::date) > $4::date
      GROUP BY requested.product_id, p.id, p.total_quantity, p.service_quantity, p.condition_status
       HAVING p.id IS NULL
          OR COUNT(DISTINCT r.id) >= ${rentableQuantitySql()}`,
      [data.productIds, data.id, data.endDate, data.startDate]
    );
    return result.rows;
  },

  changeReservationTerm: async (data: {
    id: number;
    endDate: string | null;
    endTime: string;
    isIndefinite: boolean;
    days: number;
    basePrice: number;
    totalPrice: number;
    itemPrices: Array<{ productId: string; itemPrice: number }>;
    note: string;
    changedBy: string;
  }): Promise<{ reservation?: any; conflicts?: any[] }> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query(
        `SELECT * FROM reservations WHERE id = $1 FOR UPDATE`,
        [data.id]
      );
      const current = currentResult.rows[0];
      if (!current) throw new Error('Rezerwacja nie istnieje');

      const currentItems = await client.query(
        `SELECT product_id FROM reservation_items WHERE reservation_id = $1 ORDER BY product_id`,
        [data.id]
      );
      const productIds = currentItems.rows.map((item) => String(item.product_id));
      for (const productId of productIds) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [productId]);
      }
      const conflictResult = await client.query(
        `SELECT requested.product_id,
                MIN(r.start_date) AS start_date,
                MAX(r.end_date) AS end_date,
                COUNT(DISTINCT r.id)::integer AS reserved_quantity,
                ${rentableQuantitySql()} AS rentable_quantity
         FROM unnest($1::text[]) AS requested(product_id)
         LEFT JOIN products p ON p.id = requested.product_id
         LEFT JOIN reservation_items ri ON ri.product_id = requested.product_id
         LEFT JOIN reservations r ON r.id = ri.reservation_id AND r.id <> $2
           AND r.status IN ('pending', 'confirmed', 'picked_up')
           AND r.start_date < COALESCE($3::date, 'infinity'::date)
           AND COALESCE(r.end_date, 'infinity'::date) > $4::date
         GROUP BY requested.product_id, p.id, p.total_quantity, p.service_quantity, p.condition_status
         HAVING p.id IS NULL
            OR COUNT(DISTINCT r.id) >= ${rentableQuantitySql()}`,
        [productIds, data.id, data.endDate, current.start_date]
      );
      if (conflictResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return { conflicts: conflictResult.rows };
      }

      const updatedResult = await client.query(
        `UPDATE reservations SET
           end_date = $1, end_time = $2, is_indefinite = $3,
           days = $4, base_price = $5, total_price = $6,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [data.endDate, data.endTime, data.isIndefinite, data.days, data.basePrice, data.totalPrice, data.id]
      );
      for (const item of data.itemPrices) {
        await client.query(
          `UPDATE reservation_items SET item_price = $1
           WHERE reservation_id = $2 AND product_id = $3`,
          [item.itemPrice, data.id, item.productId]
        );
      }
      await client.query(
        `INSERT INTO reservation_term_changes (
           reservation_id, previous_end_date, new_end_date,
           previous_is_indefinite, new_is_indefinite,
           previous_days, new_days, previous_total_price, new_total_price,
           price_delta, note, changed_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          data.id, current.end_date, data.endDate,
          Boolean(current.is_indefinite), data.isIndefinite,
          current.days, data.days, Number(current.total_price), data.totalPrice,
          data.totalPrice - Number(current.total_price), data.note, data.changedBy,
        ]
      );
      await client.query('COMMIT');
      return { reservation: updatedResult.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getReservationTermChanges: async (id: number) => {
    const result = await pool.query(
      `SELECT * FROM reservation_term_changes
       WHERE reservation_id = $1
       ORDER BY created_at DESC, id DESC`,
      [id]
    );
    return result.rows;
  },

  getReservationsByEmail: async (email: string) => {
    const result = await pool.query(
            `SELECT r.id, r.product_id, r.start_date, r.end_date, r.is_indefinite, r.start_time, r.end_time,
              r.status, r.days, r.total_price, r.delivery, r.city, r.created_at,
              r.payment_status, r.payment_provider,
              COALESCE((SELECT json_agg(ri ORDER BY ri.position, ri.id)
            FROM reservation_items ri WHERE ri.reservation_id = r.id), '[]'::json) AS items
             FROM reservations r
             WHERE LOWER(r.email) = LOWER($1)
             ORDER BY r.start_date DESC`,
      [email]
    );
    return result.rows;
  },

  getReservationsByProduct: async (productId: string) => {
    const result = await pool.query(
      `SELECT DISTINCT r.* FROM reservations r
       JOIN reservation_items ri ON ri.reservation_id = r.id
      WHERE ri.product_id = $1 AND r.status IN ('pending', 'confirmed', 'picked_up')
       ORDER BY r.start_date ASC`,
      [productId]
    );
    return result.rows;
  },

  checkDateAvailability: async (data: { productId: string; startDate: string; endDate: string }) => {
    const [productResult, reservationsResult] = await Promise.all([
      pool.query(
        `SELECT ${rentableQuantitySql()} AS rentable_quantity, p.is_active, p.condition_status
         FROM products p WHERE p.id = $1`,
        [data.productId]
      ),
      pool.query(
      `SELECT r.id, r.start_date, r.end_date, r.name, r.status
       FROM reservations r
       JOIN reservation_items ri ON ri.reservation_id = r.id
       WHERE ri.product_id = $1
         AND r.status IN ('pending', 'confirmed', 'picked_up')
         AND r.start_date < $2::date
         AND COALESCE(r.end_date, 'infinity'::date) > $3::date`,
      [data.productId, data.endDate, data.startDate]
      ),
    ]);
    const product = productResult.rows[0];
    const rentableQuantity = product ? Number(product.rentable_quantity) : 0;
    return {
      available: Boolean(product?.is_active) && reservationsResult.rows.length < rentableQuantity,
      rentableQuantity,
      reservedQuantity: reservationsResult.rows.length,
      conflicts: reservationsResult.rows,
    };
  },

  getReservedProductsToday: async (today: string) => {
    const result = await pool.query(
      `SELECT p.id AS product_id
       FROM products p
       LEFT JOIN reservation_items ri ON ri.product_id = p.id
       LEFT JOIN reservations r ON r.id = ri.reservation_id
         AND r.status IN ('pending', 'confirmed', 'picked_up')
         AND r.start_date <= $1
         AND COALESCE(r.end_date, 'infinity'::date) >= $1::date
       GROUP BY p.id
       HAVING NOT p.is_active
          OR COUNT(DISTINCT r.id) >= ${rentableQuantitySql()}`,
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
      `SELECT r.*,
              COALESCE((SELECT json_agg(ri ORDER BY ri.position, ri.id)
                        FROM reservation_items ri WHERE ri.reservation_id = r.id), '[]'::json) AS items
       FROM reservations r
       WHERE r.status IN ('pending', 'confirmed')
         AND (DATE(r.start_date) = CURRENT_DATE + INTERVAL '1 day'
              OR DATE(r.start_date) = CURRENT_DATE)`
    );
    return result.rows;
  },

  getReservationsForReturnReminder: async () => {
    const result = await pool.query(
      `SELECT r.*,
              COALESCE((SELECT json_agg(ri ORDER BY ri.position, ri.id)
                        FROM reservation_items ri WHERE ri.reservation_id = r.id), '[]'::json) AS items
       FROM reservations r
       WHERE r.status = 'picked_up'
         AND DATE(r.end_date) = CURRENT_DATE + INTERVAL '1 day'`
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

  // === DOCUMENT ARCHIVE ===
  insertDocument: async (data: {
    title: string;
    category: string;
    reservationId: number | null;
    customerEmail: string;
    documentDate: string | null;
    fileName: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    fileHash: string;
    source: string;
    notes: string;
    uploadedBy: string;
  }) => {
    const result = await pool.query(
      `INSERT INTO documents (
         title, category, reservation_id, customer_email, document_date,
         file_name, file_path, mime_type, size_bytes, file_hash,
         source, notes, uploaded_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.title, data.category, data.reservationId, data.customerEmail, data.documentDate,
        data.fileName, data.filePath, data.mimeType, data.sizeBytes, data.fileHash,
        data.source, data.notes, data.uploadedBy,
      ]
    );
    return result.rows[0];
  },

  getDocuments: async (filters: {
    archived?: boolean;
    category?: string;
    reservationId?: number;
    search?: string;
  } = {}) => {
    const result = await pool.query(
      `SELECT d.id, d.title, d.category, d.reservation_id, d.customer_email, d.document_date,
              d.file_name, d.mime_type, d.size_bytes, d.file_hash, d.source, d.notes,
              d.uploaded_by, d.archived_at, d.created_at, d.updated_at,
              r.name AS reservation_name, r.product_id AS reservation_product_id
       FROM documents d
       LEFT JOIN reservations r ON r.id = d.reservation_id
       WHERE ($1::boolean IS NULL
              OR ($1 = TRUE AND d.archived_at IS NOT NULL)
              OR ($1 = FALSE AND d.archived_at IS NULL))
         AND ($2::text IS NULL OR d.category = $2)
         AND ($3::integer IS NULL OR d.reservation_id = $3)
         AND ($4::text IS NULL OR d.title ILIKE '%' || $4 || '%'
              OR d.customer_email ILIKE '%' || $4 || '%'
              OR d.file_name ILIKE '%' || $4 || '%')
       ORDER BY d.created_at DESC`,
      [
        filters.archived ?? null,
        filters.category ?? null,
        filters.reservationId ?? null,
        filters.search ?? null,
      ]
    );
    return result.rows;
  },

  getDocumentById: async (id: number) => {
    const result = await pool.query(`SELECT * FROM documents WHERE id = $1`, [id]);
    return result.rows[0];
  },

  updateDocument: async (id: number, data: {
    title: string;
    category: string;
    reservationId: number | null;
    customerEmail: string;
    documentDate: string | null;
    notes: string;
  }) => {
    const result = await pool.query(
      `UPDATE documents
       SET title = $2, category = $3, reservation_id = $4, customer_email = $5,
           document_date = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, data.title, data.category, data.reservationId, data.customerEmail, data.documentDate, data.notes]
    );
    return result.rows[0];
  },

  setDocumentArchived: async (id: number, archived: boolean) => {
    const result = await pool.query(
      `UPDATE documents
       SET archived_at = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, archived]
    );
    return result.rows[0];
  },

  deleteDocument: async (id: number) => {
    const result = await pool.query(`DELETE FROM documents WHERE id = $1 RETURNING file_path`, [id]);
    return result.rows[0];
  },

  /**
   * Registers a signed contract in the archive. Idempotent: the same encrypted
   * file is never listed twice, so re-signing or a restart cannot duplicate it.
   */
  registerContractDocument: async (data: {
    title: string;
    reservationId: number | null;
    customerEmail: string;
    documentDate: string | null;
    fileName: string;
    filePath: string;
    sizeBytes: number;
    fileHash: string;
  }) => {
    const result = await pool.query(
      `INSERT INTO documents (
         title, category, reservation_id, customer_email, document_date,
         file_name, file_path, mime_type, size_bytes, file_hash,
         source, notes, uploaded_by
       )
       SELECT $1, 'contract', $2, $3, $4, $5, $6, 'application/pdf', $7, $8,
              'system', 'Umowa podpisana elektronicznie w systemie.', 'system'
       WHERE NOT EXISTS (SELECT 1 FROM documents WHERE file_path = $6)
       RETURNING *`,
      [
        data.title, data.reservationId, data.customerEmail, data.documentDate,
        data.fileName, data.filePath, data.sizeBytes, data.fileHash,
      ]
    );
    return result.rows[0] || null;
  },

  /** Keeps the archive entry truthful after a contract PDF is regenerated. */
  refreshContractDocument: async (filePath: string, fileHash: string, sizeBytes: number) => {
    await pool.query(
      `UPDATE documents
       SET file_hash = $2, size_bytes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE file_path = $1 AND source = 'system'`,
      [filePath, fileHash, sizeBytes]
    );
  },

  /** Signed contracts that predate the archive (or failed to register). */
  getUnarchivedSignedContracts: async () => {
    const result = await pool.query(
      `SELECT c.id, c.reservation_id, c.contract_number, c.pdf_path, c.pdf_hash,
              c.signed_at, r.email AS customer_email
       FROM rental_contracts c
       LEFT JOIN reservations r ON r.id = c.reservation_id
       WHERE c.pdf_path IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.file_path = c.pdf_path)`
    );
    return result.rows;
  },

  // === DISCOUNTS ===
  getDiscounts: async () => {
    const result = await pool.query(`SELECT * FROM discounts ORDER BY is_active DESC, created_at DESC`);
    return result.rows;
  },

  getActiveDiscounts: async () => {
    const result = await pool.query(
      `SELECT * FROM discounts
       WHERE is_active = TRUE
         AND (starts_on IS NULL OR starts_on <= CURRENT_DATE)
         AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)`
    );
    return result.rows;
  },

  insertDiscount: async (data: {
    name: string;
    description: string;
    discountType: string;
    value: number;
    scope: string;
    scopeValue: string;
    minDays: number;
    minTotal: number;
    startsOn: string | null;
    endsOn: string | null;
    isActive: boolean;
  }) => {
    const result = await pool.query(
      `INSERT INTO discounts (
         name, description, discount_type, value, scope, scope_value,
         min_days, min_total, starts_on, ends_on, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        data.name, data.description, data.discountType, data.value, data.scope, data.scopeValue,
        data.minDays, data.minTotal, data.startsOn, data.endsOn, data.isActive,
      ]
    );
    return result.rows[0];
  },

  updateDiscount: async (id: number, data: {
    name: string;
    description: string;
    discountType: string;
    value: number;
    scope: string;
    scopeValue: string;
    minDays: number;
    minTotal: number;
    startsOn: string | null;
    endsOn: string | null;
    isActive: boolean;
  }) => {
    const result = await pool.query(
      `UPDATE discounts
       SET name = $2, description = $3, discount_type = $4, value = $5, scope = $6, scope_value = $7,
           min_days = $8, min_total = $9, starts_on = $10, ends_on = $11, is_active = $12,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [
        id, data.name, data.description, data.discountType, data.value, data.scope, data.scopeValue,
        data.minDays, data.minTotal, data.startsOn, data.endsOn, data.isActive,
      ]
    );
    return result.rows[0];
  },

  deleteDiscount: async (id: number) => {
    const result = await pool.query(`DELETE FROM discounts WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0];
  },

  // === COUPONS ===
  getCoupons: async (status?: string) => {
    const result = await pool.query(
      `SELECT c.*, r.name AS issued_for_name
       FROM coupons c
       LEFT JOIN reservations r ON r.id = c.issued_for_reservation_id
       WHERE ($1::text IS NULL OR c.status = $1)
       ORDER BY c.created_at DESC`,
      [status ?? null]
    );
    return result.rows;
  },

  getCouponById: async (id: number) => {
    const result = await pool.query(`SELECT * FROM coupons WHERE id = $1`, [id]);
    return result.rows[0];
  },

  getCouponByCode: async (code: string) => {
    const result = await pool.query(`SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)`, [code]);
    return result.rows[0];
  },

  insertCoupon: async (data: {
    code: string;
    discountType: string;
    value: number;
    customerEmail: string;
    customerName: string;
    minTotal: number;
    expiresOn: string | null;
    issuedForReservationId: number | null;
    issuedBy: string;
    note: string;
  }) => {
    const result = await pool.query(
      `INSERT INTO coupons (
         code, discount_type, value, customer_email, customer_name,
         min_total, expires_on, issued_for_reservation_id, issued_by, note
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.code, data.discountType, data.value, data.customerEmail, data.customerName,
        data.minTotal, data.expiresOn, data.issuedForReservationId, data.issuedBy, data.note,
      ]
    );
    return result.rows[0];
  },

  cancelCoupon: async (id: number) => {
    const result = await pool.query(
      `UPDATE coupons SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'active' RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  markCouponEmailSent: async (id: number) => {
    await pool.query(
      `UPDATE coupons SET email_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  },

  getCouponStats: async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::integer AS total,
              COUNT(*) FILTER (WHERE status = 'active')::integer AS active,
              COUNT(*) FILTER (WHERE status = 'used')::integer AS used,
              COUNT(*) FILTER (WHERE status = 'cancelled')::integer AS cancelled
       FROM coupons`
    );
    return result.rows[0];
  },

  // === HANDOVER PHOTOS ===
  insertReservationPhoto: async (data: {
    reservationId: number;
    productId: string;
    phase: 'before' | 'after';
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    fileHash: string;
    note: string;
    takenBy: string;
  }) => {
    const result = await pool.query(
      `INSERT INTO reservation_photos (
         reservation_id, product_id, phase, file_path, mime_type,
         size_bytes, file_hash, note, taken_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.reservationId, data.productId, data.phase, data.filePath, data.mimeType,
        data.sizeBytes, data.fileHash, data.note, data.takenBy,
      ]
    );
    return result.rows[0];
  },

  getReservationPhotos: async (reservationId: number) => {
    const result = await pool.query(
      `SELECT id, reservation_id, product_id, phase, mime_type, size_bytes,
              file_hash, note, taken_by, created_at
       FROM reservation_photos
       WHERE reservation_id = $1
       ORDER BY phase, created_at`,
      [reservationId]
    );
    return result.rows;
  },

  getReservationPhotoById: async (id: number) => {
    const result = await pool.query(`SELECT * FROM reservation_photos WHERE id = $1`, [id]);
    return result.rows[0];
  },

  countReservationPhotos: async (reservationId: number, phase: 'before' | 'after'): Promise<number> => {
    const result = await pool.query(
      `SELECT COUNT(*)::integer AS liczba FROM reservation_photos
       WHERE reservation_id = $1 AND phase = $2`,
      [reservationId, phase]
    );
    return Number(result.rows[0]?.liczba ?? 0);
  },

  /** Liczba zdjec zwrotu dla wielu rezerwacji naraz - lista w panelu pyta o wszystkie. */
  countReturnPhotosForReservations: async (ids: number[]): Promise<Record<number, number>> => {
    if (ids.length === 0) return {};
    const result = await pool.query(
      `SELECT reservation_id, COUNT(*)::integer AS liczba
       FROM reservation_photos
       WHERE reservation_id = ANY($1::int[]) AND phase = 'after'
       GROUP BY reservation_id`,
      [ids]
    );
    return Object.fromEntries(result.rows.map((row) => [Number(row.reservation_id), Number(row.liczba)]));
  },

  deleteReservationPhoto: async (id: number) => {
    const result = await pool.query(
      `DELETE FROM reservation_photos WHERE id = $1 RETURNING file_path`,
      [id]
    );
    return result.rows[0];
  },

  // === PAYMENTS ===
  /**
   * Wplata przyjeta poza bramka - gotowka, przelew, terminal. Zamyka wszystkie
   * otwarte sesje online, zeby klient nie zaplacil drugi raz przez internet.
   */
  recordManualPayment: async (data: {
    reservationId: number;
    amount: number;
    method: string;
    confirmedBy: string;
  }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE payments SET status = 'cancelled'
         WHERE reservation_id = $1 AND status = 'pending'`,
        [data.reservationId]
      );
      const sessionId = `manual-${data.reservationId}-${Date.now().toString(36)}`;
      await client.query(
        `INSERT INTO payments (reservation_id, provider, session_id, external_id, amount, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, 'paid', CURRENT_TIMESTAMP)`,
        [data.reservationId, data.method, sessionId, data.confirmedBy.slice(0, 120), data.amount]
      );
      await client.query(
        `UPDATE reservations SET payment_status = 'paid', payment_provider = $2 WHERE id = $1`,
        [data.reservationId, data.method]
      );
      await client.query(
        `UPDATE reservations SET status = 'confirmed'
         WHERE id = $1 AND status = 'pending' AND contract_status = 'signed'`,
        [data.reservationId]
      );
      await client.query('COMMIT');
      return { sessionId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

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

  /** Retires older sessions so only one payment link per reservation stays open. */
  cancelPendingPayments: async (reservationId: number) => {
    const result = await pool.query(
      `UPDATE payments SET status = 'cancelled'
       WHERE reservation_id = $1 AND status = 'pending'
       RETURNING session_id`,
      [reservationId]
    );
    return result.rows;
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
        // Podpisana umowa + zaksiegowana platnosc = rezerwacja potwierdzona.
        // Ruszamy wylacznie z 'pending', zeby nie cofnac zadnego pozniejszego stanu.
        if (data.status === 'paid') {
          await client.query(
            `UPDATE reservations SET status = 'confirmed'
             WHERE id = $1 AND status = 'pending' AND contract_status = 'signed'`,
            [row.reservation_id]
          );
        }
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
           lessor_signature_encrypted = NULL,
           lessor_signature_hash = NULL,
           handover_signature_encrypted = NULL,
           handover_signature_hash = NULL,
           handover_lessor_signature_encrypted = NULL,
           handover_lessor_signature_hash = NULL,
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
      // Przygotowanie umowy jest jednoznaczne z przyjeciem rezerwacji - inaczej
      // zostawalaby w kolejce zapytan mimo wystawionego dokumentu.
      await client.query(
        `UPDATE reservations SET status = 'confirmed' WHERE id = $1 AND status = 'pending'`,
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
    renterSignatureEncrypted: string;
    renterSignatureHash: string;
    lessorSignatureEncrypted: string;
    lessorSignatureHash: string;
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
           lessor_signature_encrypted = $3, lessor_signature_hash = $4,
           signed_name = $5, signed_ip = $6, signed_user_agent = $7,
           consent_at = CURRENT_TIMESTAMP, signed_at = CURRENT_TIMESTAMP,
           pdf_path = $8, pdf_hash = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 AND status = 'ready'
         RETURNING reservation_id, signed_at`,
        [
          data.renterSignatureEncrypted,
          data.renterSignatureHash,
          data.lessorSignatureEncrypted,
          data.lessorSignatureHash,
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
        // Jak wyzej: gdy platnosc juz przeszla, podpis domyka potwierdzenie.
        await client.query(
          `UPDATE reservations SET status = 'confirmed'
           WHERE id = $1 AND status = 'pending' AND payment_status = 'paid'`,
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

  updateContractPdfHash: async (id: number, pdfHash: string) => {
    await pool.query(
      `UPDATE rental_contracts SET pdf_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = 'signed'`,
      [pdfHash, id]
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
