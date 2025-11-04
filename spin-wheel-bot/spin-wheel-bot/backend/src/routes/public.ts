import { Router } from 'express';
import db from '../db.js';
import { ENV } from '../env.js';
import { drawPrize } from '../draw.js';
import { getGlobalRemaining, incGlobal, getPrizeRemaining, incPrize } from '../limits.js';
import crypto from 'crypto';
import { DateTime } from 'luxon';

const r = Router();

function ensureAnonId(req:any,res:any){
  const name = ENV.COOKIE_NAME;
  let id = req.cookies?.[name];
  if(!id){
    id = 'anon_'+crypto.randomBytes(8).toString('hex');
    res.cookie(name, id, { httpOnly:true, sameSite:'lax', secure:false, maxAge:365*24*3600*1000 });
  }
  return id;
}

r.get('/wheels/:wheelId/config', (req,res)=>{
  const w = db.prepare('SELECT * FROM wheels WHERE id=?').get(req.params.wheelId) as any;
  if(!w) return res.status(404).json({error:'wheel not found'});
  const slices = db.prepare('SELECT id,label,type,weight,daily_cap,max_per_user_per_day,style_json FROM slices WHERE wheel_id=? ORDER BY position_index ASC').all(req.params.wheelId);
  res.json({
    wheel: { id:w.id, name:w.name, fallback:w.fallback, global_daily_cap:w.global_daily_cap },
    slices: slices.map((s:any)=>({
      id:s.id, label:s.label, type:s.type,
      style: s.style_json ? JSON.parse(s.style_json):null
    }))
  });
});

r.post('/wheels/:wheelId/spin', (req,res)=>{
  const wheelId = req.params.wheelId;
  const w = db.prepare('SELECT * FROM wheels WHERE id=?').get(wheelId) as any;
  if(!w) return res.status(404).json({error:'wheel not found'});

  const anon_id = ensureAnonId(req,res);
  // rate limit per 24 jam
  const last = db.prepare('SELECT created_at FROM spins WHERE wheel_id=? AND anon_id=? ORDER BY id DESC LIMIT 1').get(wheelId, anon_id) as any;
  if (last) {
    const lastTs = DateTime.fromISO(last.created_at);
    const next = lastTs.plus({ seconds: ENV.MIN_INTERVAL_BETWEEN_SPINS_SEC });
    if (DateTime.now().setZone(ENV.DAILY_TIMEZONE) < next) {
      return res.status(429).json({ error:'too_soon', nextEligibleAt: next.toISO() });
    }
  }

  // global cap
  const globalRemaining = getGlobalRemaining(wheelId, w.global_daily_cap);
  if (globalRemaining<=0) {
    const fallback = db.prepare('SELECT * FROM slices WHERE wheel_id=? AND id=?').get(wheelId, w.fallback) as any;
    const nowIso = DateTime.now().setZone(ENV.DAILY_TIMEZONE).toISO();
    db.prepare('INSERT INTO spins(wheel_id,anon_id,prize_id,created_at) VALUES (?,?,?,?)').run(wheelId, anon_id, fallback.id, nowIso);
    return res.json({ outcome: fallback, nextEligibleAt: DateTime.now().plus({seconds:ENV.MIN_INTERVAL_BETWEEN_SPINS_SEC}).toISO(), caps:{globalRemaining:0} });
  }

  const pick = drawPrize(wheelId, w.global_daily_cap);
  // check prize cap
  const prizeRemaining = getPrizeRemaining(wheelId, pick.id, pick.daily_cap ?? null);
  if (prizeRemaining<=0) {
    const fallback = db.prepare('SELECT * FROM slices WHERE wheel_id=? AND id=?').get(wheelId, w.fallback) as any;
    const nowIso = DateTime.now().setZone(ENV.DAILY_TIMEZONE).toISO();
    db.prepare('INSERT INTO spins(wheel_id,anon_id,prize_id,created_at) VALUES (?,?,?,?)').run(wheelId, anon_id, fallback.id, nowIso);
    incGlobal(wheelId,1);
    return res.json({ outcome: fallback, nextEligibleAt: DateTime.now().plus({seconds:ENV.MIN_INTERVAL_BETWEEN_SPINS_SEC}).toISO(), caps:{ globalRemaining: globalRemaining-1 } });
  }

  // award
  const nowIso = DateTime.now().setZone(ENV.DAILY_TIMEZONE).toISO();
  db.prepare('INSERT INTO spins(wheel_id,anon_id,prize_id,created_at) VALUES (?,?,?,?)').run(wheelId, anon_id, pick.id, nowIso);
  incGlobal(wheelId,1);
  incPrize(wheelId, pick.id, 1);

  // attach code for voucher
  let outcome:any = pick;
  if (pick.type==='voucher') {
    const code = `${JSON.parse(pick.metadata_json||'{}').code_prefix||'BOT'}-` + crypto.randomBytes(4).toString('hex').toUpperCase();
    db.prepare('INSERT INTO voucher_pool(prize_id,code,issued_to_anon_id,issued_at) VALUES (?,?,?,?)')
      .run(pick.id, code, anon_id, nowIso);
    outcome = { ...pick, code };
  }

  const nextEligibleAt = DateTime.now().plus({seconds:ENV.MIN_INTERVAL_BETWEEN_SPINS_SEC}).toISO();
  res.json({ outcome, nextEligibleAt, caps:{ globalRemaining: globalRemaining-1 } });
});

export default r;
