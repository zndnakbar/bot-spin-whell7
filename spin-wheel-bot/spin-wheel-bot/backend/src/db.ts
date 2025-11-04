import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbFile = path.resolve(process.cwd(), 'spinwheel.sqlite');
const db = new Database(dbFile);

export function migrate() {
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'backend/schema.sql'), 'utf8');
  db.exec(schema);
}

export default db;
