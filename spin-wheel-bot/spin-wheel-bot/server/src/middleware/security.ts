import { Request, Response, NextFunction } from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { verifySignature } from '../lib/crypto';

const ALLOWED_DRIFT_MS = 3 * 60 * 1000;

dayjs.extend(utc);
dayjs.extend(timezone);

export function validateSignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ message: 'Missing signature' });
  }
  const { userId, idempotencyKey, timestamp } = req.body;
  if (!userId || !idempotencyKey || !timestamp) {
    return res.status(400).json({ message: 'Invalid payload' });
  }
  const payload = `${userId}|${idempotencyKey}|${timestamp}`;
  if (!verifySignature(payload, signature)) {
    return res.status(401).json({ message: 'Invalid signature' });
  }
  return next();
}

export function validateTimestamp(req: Request, res: Response, next: NextFunction) {
  const { timestamp } = req.body;
  if (!timestamp || typeof timestamp !== 'number') {
    return res.status(400).json({ message: 'Missing timestamp' });
  }
  const drift = Math.abs(Date.now() - timestamp);
  if (drift > ALLOWED_DRIFT_MS) {
    return res.status(400).json({ message: 'Timestamp outside allowed drift' });
  }
  return next();
}

export function ensureWithinWindow(start: string, end: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const now = dayjs().tz('Asia/Kuala_Lumpur');
    if (now.isBefore(dayjs(start)) || now.isAfter(dayjs(end))) {
      return res.status(400).json({ message: 'Campaign is inactive' });
    }
    return next();
  };
}
