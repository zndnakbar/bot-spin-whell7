import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Missing user' });
  }

  const token = jwt.sign({ sub: userId, role: 'user' }, JWT_SECRET, { expiresIn: '5m' });

  const upstreamRes = await fetch(`${BACKEND_BASE_URL}/api/spin/my-prizes`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-user-id': userId,
    },
  });
  const data = await upstreamRes.json().catch(() => ({ message: 'Failed to fetch prizes' }));
  return res.status(upstreamRes.status).json(data);
}
