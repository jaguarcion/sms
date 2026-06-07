const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fanytel.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE,
    role TEXT DEFAULT 'client',
    notes TEXT,
    tags TEXT
  )`);
  
  db.run(`ALTER TABLE users ADD COLUMN notes TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN tags TEXT`, () => {});

  // Create Numbers table
  // Each number has a token and is assigned to a specific telegram_id (client)
  db.run(`CREATE TABLE IF NOT EXISTS numbers (
    id INTEGER PRIMARY KEY,
    number TEXT UNIQUE,
    telegram_id INTEGER,
    username TEXT,
    token TEXT,
    active INTEGER DEFAULT 1
  )`);

  // Create SMS History table
  // To avoid duplicate SMS to clients, and now to store history for viewing
  db.run(`CREATE TABLE IF NOT EXISTS sms_history (
    id INTEGER PRIMARY KEY,
    number TEXT,
    message_id TEXT UNIQUE,
    sender TEXT,
    message_text TEXT,
    received_at INTEGER
  )`);
  
  // Try to alter table if it already exists (for backwards compatibility)
  db.run(`ALTER TABLE sms_history ADD COLUMN sender TEXT`, () => {});
  db.run(`ALTER TABLE sms_history ADD COLUMN message_text TEXT`, () => {});

  // Create Settings table for persistent credentials
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY,
    action TEXT,
    ip TEXT,
    details TEXT,
    timestamp INTEGER
  )`);
});

module.exports = {
  db,
  
  // Users
  addUser: (telegramId, role = 'client') => {
    return new Promise((resolve, reject) => {
      db.run(`INSERT OR IGNORE INTO users (telegram_id, role) VALUES (?, ?)`, [telegramId, role], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  },

  getUserByTelegramId: (telegramId) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM users WHERE telegram_id = ?`, [telegramId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  getAllUsers: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM users`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  updateUserNotes: (telegramId, notes, tags) => {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE users SET notes = ?, tags = ? WHERE telegram_id = ?`, [notes, tags, telegramId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  // Numbers
  addNumber: (number, telegramId, username, token) => {
    return new Promise((resolve, reject) => {
      // Note: this overwrites the entire row if the number already exists
      db.run(`INSERT OR REPLACE INTO numbers (number, telegram_id, username, token, active) VALUES (?, ?, ?, ?, 1)`,
        [number, telegramId, username, token], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  },

  deactivateNumber: (number) => {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE numbers SET active = 0 WHERE number = ?`, [number], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  getAllHistoricalNumbers: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT number FROM numbers`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.number));
      });
    });
  },

  getActiveNumbers: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM numbers WHERE active = 1`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getNumbersByUser: (telegramId) => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM numbers WHERE telegram_id = ? AND active = 1`, [telegramId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getNumber: (number) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM numbers WHERE number = ?`, [number], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // SMS History
  addSmsRecord: (number, messageId, sender, text) => {
    return new Promise((resolve, reject) => {
      db.run(`INSERT OR IGNORE INTO sms_history (number, message_id, sender, message_text, received_at) VALUES (?, ?, ?, ?, ?)`,
        [number, messageId, sender, text, Date.now()], function(err) {
        if (err) reject(err);
        else {
          // If changes > 0, it means the row was inserted (wasn't a duplicate)
          resolve(this.changes > 0);
        }
      });
    });
  },

  getSmsForNumber: (number) => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM sms_history WHERE number = ? ORDER BY received_at DESC LIMIT 10`, [number], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getAllSmsForUser: (telegramId) => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT s.* FROM sms_history s
        JOIN numbers n ON s.number = n.number
        WHERE n.telegram_id = ?
        ORDER BY s.received_at DESC LIMIT 20
      `, [telegramId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  clearAllSms: () => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM sms_history`, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  deleteOldSms: (days) => {
    return new Promise((resolve, reject) => {
      const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
      db.run(`DELETE FROM sms_history WHERE received_at < ?`, [threshold], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  // Settings
  setSetting: (key, value) => {
    return new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  getSetting: (key) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
  },

  // Audit Logs
  logAction: (action, ip, details) => {
    return new Promise((resolve) => {
      db.run(`INSERT INTO audit_logs (action, ip, details, timestamp) VALUES (?, ?, ?, ?)`, 
        [action, ip, JSON.stringify(details), Date.now()], 
        () => resolve()
      );
    });
  },

  getAuditLogs: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200`, [], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
  }
};
