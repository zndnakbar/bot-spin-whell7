import type { Request, Response, NextFunction } from 'express';
const recent = new Map<string, {ts:number, body:any, result:any}>();
export function idempotent60s(req:Request,res:Response,next:NextFunction){
  const key = (req.cookies?.bot_anon_id||'')+':'+req.path;
  const ent = recent.get(key);
  const now = Date.now();
  if (ent && now - ent.ts < 60000) {
    return res.json(ent.result);
  }
  // patch res.json to store
  const _json = res.json.bind(res);
  (res as any).json = (body:any)=>{
    recent.set(key, {ts:Date.now(), body:req.body, result:body});
    return _json(body);
  };
  next();
}
