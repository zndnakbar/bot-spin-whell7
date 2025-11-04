import type { Request, Response, NextFunction } from 'express';
import { ENV } from '../env.js';
export function requireAdmin(req:Request,res:Response,next:NextFunction){
  const key = req.header('x-admin-key');
  if (key !== ENV.ADMIN_API_KEY) return res.status(401).json({error:'unauthorized'});
  next();
}
