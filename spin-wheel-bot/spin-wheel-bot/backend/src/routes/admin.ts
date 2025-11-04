import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const a = Router();
a.use(requireAdmin);

// Wheels CRUD
a.get('/wheels', (req,res)=>{
  const rows = db.prepare('SELECT * FROM wheels').all();
  res.json(rows);
});

a.post('/wheels', (req,res)=>{
  const {id,name,status='active',schedule_start=null,schedule_end=null,global_daily_cap=600,fallback='ZONK'} = req.body||{};
  db.prepare('INSERT INTO wheels(id,name,status,schedule_start,schedule_end,global_daily_cap,fallback) VALUES (?,?,?,?,?,?,?)')
    .run(id,name,status,schedule_start,schedule_end,global_daily_cap,fallback);
  res.json({ok:true});
});

a.put('/wheels/:id', (req,res)=>{
  const id = req.params.id;
  const w = db.prepare('SELECT * FROM wheels WHERE id=?').get(id);
  if(!w) return res.status(404).json({error:'not found'});
  const {name,status,schedule_start,schedule_end,global_daily_cap,fallback} = req.body||{};
  db.prepare('UPDATE wheels SET name=COALESCE(?,name), status=COALESCE(?,status), schedule_start=COALESCE(?,schedule_start), schedule_end=COALESCE(?,schedule_end), global_daily_cap=COALESCE(?,global_daily_cap), fallback=COALESCE(?,fallback) WHERE id=?')
    .run(name,status,schedule_start,schedule_end,global_daily_cap,fallback,id);
  res.json({ok:true});
});

a.delete('/wheels/:id', (req,res)=>{
  const id=req.params.id;
  db.prepare('DELETE FROM slices WHERE wheel_id=?').run(id);
  db.prepare('DELETE FROM wheels WHERE id=?').run(id);
  res.json({ok:true});
});

// Slices CRUD
a.get('/wheels/:id/slices', (req,res)=>{
  const rows = db.prepare('SELECT * FROM slices WHERE wheel_id=? ORDER BY position_index ASC').all(req.params.id);
  res.json(rows);
});

a.post('/wheels/:id/slices', (req,res)=>{
  const w = db.prepare('SELECT * FROM wheels WHERE id=?').get(req.params.id);
  if(!w) return res.status(404).json({error:'wheel not found'});
  const {id,label,type,weight,daily_cap=null,max_per_user_per_day=null,metadata={},style={},position_index=0} = req.body||{};
  db.prepare('INSERT INTO slices(id,wheel_id,label,type,weight,daily_cap,max_per_user_per_day,metadata_json,style_json,position_index) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, req.params.id, label, type, weight, daily_cap, max_per_user_per_day, JSON.stringify(metadata), JSON.stringify(style), position_index);
  res.json({ok:true});
});

a.put('/wheels/:id/slices/:sliceId', (req,res)=>{
  const {label,type,weight,daily_cap,max_per_user_per_day,metadata,style,position_index} = req.body||{};
  db.prepare('UPDATE slices SET label=COALESCE(?,label), type=COALESCE(?,type), weight=COALESCE(?,weight), daily_cap=COALESCE(?,daily_cap), max_per_user_per_day=COALESCE(?,max_per_user_per_day), metadata_json=COALESCE(?,metadata_json), style_json=COALESCE(?,style_json), position_index=COALESCE(?,position_index) WHERE wheel_id=? AND id=?')
    .run(label,type,weight,daily_cap,max_per_user_per_day, metadata?JSON.stringify(metadata):undefined, style?JSON.stringify(style):undefined, position_index, req.params.id, req.params.sliceId);
  res.json({ok:true});
});

a.delete('/wheels/:id/slices/:sliceId', (req,res)=>{
  db.prepare('DELETE FROM slices WHERE wheel_id=? AND id=?').run(req.params.id, req.params.sliceId);
  res.json({ok:true});
});

export default a;
