import { Request, Response } from 'express';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { getSpinConfig, performSpin, getUserPrizes, getSummaryForDate } from '../services/spin.service';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function getConfig(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }
  try {
    const config = await getSpinConfig();
    const { remainingSpinsToday, nextResetAt } = await getUserPrizes(userId, { summaryOnly: true });
    return res.json({
      config,
      serverTime: dayjs().tz(config.timezone).toISOString(),
      remainingSpinsToday,
      nextResetAt,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load config' });
  }
}

export async function postSpin(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }
  const { idempotencyKey, timestamp } = req.body;
  const requestSignature = (req.headers['x-signature'] as string) ?? '';
  try {
    const result = await performSpin({
      userId,
      idempotencyKey,
      timestamp,
      requestSignature,
      headers: {
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip,
        userAgent: req.headers['user-agent'] ?? 'unknown',
      },
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to spin';
    return res.status(message === 'Too many requests' ? 429 : 400).json({ message });
  }
}

export async function getMyPrizes(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }
  try {
    const { prizes } = await getUserPrizes(userId);
    return res.json({ prizes });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load prizes' });
  }
}

export async function getAdminSummary(req: Request, res: Response) {
  const date = (req.query.date as string) ?? dayjs().tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD');
  try {
    const summary = await getSummaryForDate(date);
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load summary' });
  }
}

export async function postWinnerWebhook(req: Request, res: Response) {
  // Stub for integration hook
  return res.status(202).json({ status: 'accepted' });
}
