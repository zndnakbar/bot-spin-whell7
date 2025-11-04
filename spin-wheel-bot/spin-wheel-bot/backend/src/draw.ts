import { secureRandom } from './rng.js';
import { getPrizeRemaining } from './limits.js';
import db from './db.js';

// Rebalance: hilangkan hadiah yang cap-nya habis, normalisasi weight sisanya.
export function drawPrize(wheelId: string, globalDailyCap: number) {
  const slices = db.prepare('SELECT * FROM slices WHERE wheel_id=? ORDER BY position_index ASC').all(wheelId) as any[];
  const active: any[] = [];
  for (const s of slices) {
    const remaining = getPrizeRemaining(wheelId, s.id, s.daily_cap ?? null);
    if (remaining > 0 || s.daily_cap == null) active.push(s);
  }
  if (!active.length) {
    // fallback ke ZONK kalau semua habis
    const z = slices.find(s=>s.id==='ZONK') || slices[0];
    return z;
  }
  const total = active.reduce((a,s)=>a+Number(s.weight||0), 0);
  let r = secureRandom() * total;
  for (const s of active) {
    r -= Number(s.weight||0);
    if (r <= 0) return s;
  }
  return active[active.length-1];
}
