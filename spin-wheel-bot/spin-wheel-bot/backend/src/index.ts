import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ENV } from './env.js';
import db, { migrate } from './db.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { idempotent60s } from './middleware/idempotency.js';

migrate();

// seed default jika kosong
const wheelCount = (db.prepare('SELECT COUNT(*) as c FROM wheels').get() as any).c;
if (wheelCount===0) {
  db.exec(`
  INSERT INTO wheels(id,name,status,global_daily_cap,fallback) VALUES ('wheel_daily','Daily Wheel','active',600,'ZONK');
  INSERT INTO slices(id,wheel_id,label,type,weight,daily_cap,max_per_user_per_day,metadata_json,style_json,position_index) VALUES
    ('VOUCHER_10','wheel_daily','Voucher 10%','voucher',0.28,180,1,'{"discount_percent":10,"code_prefix":"BOT10"}','{"bg":"#0B61A4","fg":"#FFFFFF"}',0),
    ('VOUCHER_20','wheel_daily','Voucher 20%','voucher',0.12,70,1,'{"discount_percent":20,"code_prefix":"BOT20"}','{"bg":"#134B70","fg":"#FFFFFF"}',1),
    ('CASHBACK_10K','wheel_daily','Cashback Rp10.000','cashback',0.08,50,1,'{"amount":10000,"currency":"IDR"}','{"bg":"#FF6A00","fg":"#FFFFFF"}',2),
    ('POINTS_200','wheel_daily','200 Poin','points',0.16,140,1,'{"points":200}','{"bg":"#FF884D","fg":"#1B1B1B"}',3),
    ('MYSTERY_BOX','wheel_daily','Mystery Box','mystery',0.02,12,1,'{"pool":["VOUCHER_30","CASHBACK_20K","POINTS_500"]}','{"bg":"#222B45","fg":"#FFD166"}',4),
    ('GRAND_PRIZE','wheel_daily','Tiket Gratis','ticket',0.004,2,1,'{"max_value_idr":200000}','{"bg":"#2DD4BF","fg":"#0F172A"}',5),
    ('THANK_YOU','wheel_daily','Terima kasih','none_soft',0.096,NULL,NULL,'{"copy_hint":"Coba lagi besok ya!"}','{"bg":"#E2E8F0","fg":"#0F172A"}',6),
    ('ZONK','wheel_daily','Zonk','none',0.284,NULL,NULL,'{}','{"bg":"#F8FAFC","fg":"#0F172A"}',7);
  `);
}

const app = express();
app.use(cors({ origin: (origin,cb)=>cb(null, true), credentials:true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api', idempotent60s, publicRoutes);
app.use('/admin', adminRoutes);

app.get('/', (_req,res)=>res.send('BOT Spin Wheel API OK'));

app.listen(ENV.PORT, ()=>{
  console.log(`API running on http://localhost:${ENV.PORT}`);
});
