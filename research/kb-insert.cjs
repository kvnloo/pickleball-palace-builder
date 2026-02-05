// Usage: node research/kb-insert.cjs <table> <json-data>
// Example: node research/kb-insert.cjs findings '{"category":"rendering","title":"Test","description":"Test finding","impact_score":5}'

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const table = process.argv[2];
const data = JSON.parse(process.argv[3]);

const columns = Object.keys(data);
const placeholders = columns.map(() => '?').join(', ');
const values = columns.map(k => data[k]);

const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
const result = stmt.run(...values);

console.log(JSON.stringify({ id: result.lastInsertRowid, changes: result.changes }));
db.close();
