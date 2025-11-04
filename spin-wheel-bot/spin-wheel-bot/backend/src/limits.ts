import db from './db.js';
import { todayKey } from './time.js';

export function getGlobalRemaining(wheel_id: string, globalCap: number) {
  const date = todayKey();
  const row = db.prepare(
    'SELECT global_count FROM daily_counters WHERE date=? AND wheel_id=? AND prize_id IS NULL'
  ).get(date, wheel_id) as {global_count:number}|undefined;
  const used = row?.global_count||0;
  return Math.max(globalCap - used, 0);
}

export function incGlobal(wheel_id: string, inc=1) {
  const date = todayKey();
  const exist = db.prepare('SELECT id, global_count FROM daily_counters WHERE date=? AND wheel_id=? AND prize_id IS NULL').get(date, wheel_id) as any;
  if (exist) {
    db.prepare('UPDATE daily_counters SET global_count = global_count + ? WHERE id=?').run(inc, exist.id);
  } else {
    db.prepare('INSERT INTO daily_counters(date,wheel_id,prize_id,prize_count,global_count) VALUES (?,?,NULL,0,?)').run(date, wheel_id, inc);
  }
}

export function getPrizeRemaining(wheel_id: string, prize_id: string, dailyCap: number|null) {
  if (dailyCap==null) return Infinity;
  const date = todayKey();
  const row = db.prepare(
    'SELECT prize_count FROM daily_counters WHERE date=? AND wheel_id=? AND prize_id=?'
  ).get(date, wheel_id, prize_id) as {prize_count:number}|undefined;
  const used = row?.prize_count||0;
  return Math.max(dailyCap - used, 0);
}

export function incPrize(wheel_id: string, prize_id: string, inc=1) {
  const date = todayKey();
  const exist = db.prepare('SELECT id FROM daily_counters WHERE date=? AND wheel_id=? AND prize_id=?').get(date, wheel_id, prize_id) as any;
  if (exist) {
    db.prepare('UPDATE daily_counters SET prize_count = prize_count + ? WHERE id=?').run(inc, exist.id);
  } else {
    db.prepare('INSERT INTO daily_counters(date,wheel_id,prize_id,prize_count,global_count) VALUES (?,?,?,?,0)')
      .run(date, wheel_id, prize_id, inc);
  }
}
