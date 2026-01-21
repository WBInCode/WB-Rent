const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  const client = await pool.connect();
  try {
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
    console.log('✅ contacts table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_replies (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        sent_by TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ contact_replies table created');

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
    console.log('✅ reservations table created');

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
    console.log('✅ newsletter_subscribers table created');

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
    console.log('✅ newsletter_posts table created');

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
    console.log('✅ product_notifications table created');

    console.log('🎉 All tables created successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

createTables().catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
