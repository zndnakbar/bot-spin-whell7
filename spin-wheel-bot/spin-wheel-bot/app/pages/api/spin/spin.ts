import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-hmac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Missing user' });
  }

  const { idempotencyKey, timestamp } = req.body ?? {};
  if (!idempotencyKey || !timestamp) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const token = jwt.sign({ sub: userId, role: 'user' }, JWT_SECRET, { expiresIn: '5m' });
  const signaturePayload = `${userId}|${idempotencyKey}|${timestamp}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(signaturePayload).digest('hex');

  const upstreamRes = await fetch(`${BACKEND_BASE_URL}/api/spin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-signature': signature,
      'x-user-id': userId,
    },
    body: JSON.stringify({ userId, idempotencyKey, timestamp }),
  });

  const data = await upstreamRes.json().catch(() => ({ message: 'Spin failed' }));
  return res.status(upstreamRes.status).json(data);
}
