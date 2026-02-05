// Usage: node research/tmp-insert-helper.cjs <table> <json-file-path>
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const table = process.argv[2];
const jsonFile = process.argv[3];
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

const columns = Object.keys(data);
const placeholders = columns.map(() => '?').join(', ');
const values = columns.map(k => data[k]);

const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
const result = stmt.run(...values);

console.log(JSON.stringify({ id: result.lastInsertRowid, changes: result.changes }));
db.close();
