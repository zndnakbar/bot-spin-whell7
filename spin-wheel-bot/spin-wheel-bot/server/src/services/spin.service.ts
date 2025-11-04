import crypto from 'node:crypto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CampaignConfig, Reward, SpinOutcomeSnapshot } from '../../shared/types';
import prisma from '../lib/prisma';
import redis from '../lib/redis';

const TZ = 'Asia/Kuala_Lumpur';

dayjs.extend(utc);
dayjs.extend(timezone);

const CONFIG: CampaignConfig = {
  campaignId: 'festive-fare-2025',
  timezone: TZ,
  activationStart: '2025-12-15T00:00:00+08:00',
  activationEnd: '2025-12-26T23:59:59+08:00',
  perUserDailySpinLimit: 1,
  fallbackRewardId: 'reward_almost',
  rewards: [
    {
      id: 'reward_skyworlds',
      name: 'Genting SkyWorlds Ticket',
      type: 'physical',
      baseWeight: 2,
      totalQty: 4,
      isActive: true,
      metadata: { partner: 'Genting Highlands', redeemBy: '2025-12-31' },
    },
    {
      id: 'reward_rm20',
      name: 'RM20 Instant Discount',
      type: 'voucher',
      baseWeight: 8,
      totalQty: 40,
      isActive: true,
      metadata: { routes: ['MY', 'SG'], redeemBy: '2025-12-31' },
    },
    {
      id: 'reward_rm10',
      name: 'RM10 Instant Discount',
      type: 'voucher',
      baseWeight: 16,
      totalQty: 80,
      isActive: true,
      metadata: { routes: ['MY', 'SG'], redeemBy: '2025-12-31' },
    },
    {
      id: 'reward_rm5',
      name: 'RM5 Instant Discount',
      type: 'voucher',
      baseWeight: 28,
      totalQty: 130,
      isActive: true,
      metadata: { routes: ['MY', 'SG'], redeemBy: '2025-12-31' },
    },
    {
      id: 'reward_cashback5',
      name: '+5% Extra Cashback',
      type: 'perk',
      baseWeight: 10,
      totalQty: 30,
      isActive: true,
      metadata: { stackable: true, redeemBy: '2025-12-31' },
    },
    {
      id: 'reward_almost',
      name: 'Almost There!',
      type: 'none',
      baseWeight: 6,
      totalQty: null,
      isActive: true,
    },
  ],
};

interface PerformSpinOptions {
  userId: string;
  idempotencyKey: string;
  timestamp: number;
  requestSignature: string;
  headers: {
    ip: string;
    userAgent: string;
  };
}

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function getTodayRange(now = dayjs().tz(TZ)) {
  const start = now.startOf('day');
  const end = start.add(1, 'day');
  return { start, end };
}

export function getSpinConfig() {
  return CONFIG;
}

async function ensureRateLimit(userId: string, ip: string) {
  const key = `rate:${dayjs().tz(TZ).format('YYYYMMDD')}:${userId}:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  if (count > RATE_LIMIT_MAX) {
    throw new Error('Too many requests');
  }
}

interface RewardPoolEntry {
  reward: Reward;
  capToday: number | null;
  usedCount: number;
  remainingToday: number | null;
  effectiveWeight: number;
}

export function computeEffectiveWeight(baseWeight: number, remaining: number | null, cap: number | null) {
  if (cap === null || remaining === null) {
    return baseWeight;
  }
  if (cap <= 0) {
    return 0;
  }
  const ratio = remaining / cap;
  return Math.max(1, Math.round(baseWeight * ratio));
}

async function buildRewardPool(date: Date, dateEnd: Date) {
  const rewards = await prisma.rewards.findMany({
    where: { isActive: true },
    include: {
      dailyCaps: {
        where: {
          date: { gte: date, lt: dateEnd },
        },
      },
      counters: {
        where: {
          date: { gte: date, lt: dateEnd },
        },
      },
    },
  });

  return rewards
    .filter((reward) => reward.id !== CONFIG.fallbackRewardId)
    .map<RewardPoolEntry | null>((reward) => {
      const capRecord = reward.dailyCaps[0];
      const counter = reward.counters[0];
      const capToday = capRecord?.cap ?? null;
      const usedCount = counter?.usedCount ?? 0;
      if (capToday !== null && usedCount >= capToday) {
        return null;
      }
      const remainingToday = capToday !== null ? Math.max(capToday - usedCount, 0) : null;
      const effectiveWeight = computeEffectiveWeight(reward.baseWeight, remainingToday, capToday);
      return {
        reward,
        capToday,
        usedCount,
        remainingToday,
        effectiveWeight,
      };
    })
    .filter((entry): entry is RewardPoolEntry => Boolean(entry) && entry.effectiveWeight > 0);
}

export function pickRewardIndex(weights: number[], roll: number) {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) {
    throw new Error('Invalid weight distribution');
  }
  let threshold = roll % totalWeight;
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (threshold < cumulative) {
      return index;
    }
  }
  return weights.length - 1;
}

function pickReward(pool: RewardPoolEntry[]) {
  const weights = pool.map((entry) => entry.effectiveWeight);
  const roll = crypto.randomInt(weights.reduce((sum, weight) => sum + weight, 0));
  return pool[pickRewardIndex(weights, roll)];
}

function createSnapshot(pool: RewardPoolEntry[], picked: RewardPoolEntry, rerolls: number): SpinOutcomeSnapshot {
  return {
    pool: pool.map((entry) => ({
      rewardId: entry.reward.id,
      effectiveWeight: entry.effectiveWeight,
      remainingToday: entry.remainingToday ?? Number.MAX_SAFE_INTEGER,
      capToday: entry.capToday ?? Number.MAX_SAFE_INTEGER,
    })),
    pickedRewardId: picked.reward.id,
    rerolls,
  };
}

async function reserveReward(
  rewardEntry: RewardPoolEntry,
  userId: string,
  idempotencyKey: string,
  requestSignature: string,
  snapshot: SpinOutcomeSnapshot,
  clientInfo: Record<string, unknown>,
  date: Date
) {
  return prisma.$transaction(async (tx) => {
    const counter = await tx.reward_counters.upsert({
      where: {
        rewardId_date: {
          rewardId: rewardEntry.reward.id,
          date,
        },
      },
      update: {},
      create: {
        rewardId: rewardEntry.reward.id,
        date,
        usedCount: 0,
      },
    });

    if (rewardEntry.capToday !== null && counter.usedCount >= rewardEntry.capToday) {
      throw new Error('Daily cap reached during reservation');
    }

    if (rewardEntry.reward.totalQty !== null) {
      const totalUsed = await tx.spins.count({ where: { rewardId: rewardEntry.reward.id } });
      if (totalUsed >= rewardEntry.reward.totalQty) {
        throw new Error('Total cap reached');
      }
    }

    await tx.reward_counters.update({
      where: { id: counter.id },
      data: { usedCount: { increment: 1 } },
    });

    const spinRecord = await tx.spins.create({
      data: {
        userId,
        rewardId: rewardEntry.reward.id,
        idempotencyKey,
        requestSignature,
        clientInfo,
        outcomeSnapshot: snapshot,
      },
      include: {
        reward: true,
      },
    });

    return spinRecord;
  });
}

function buildFallbackReward(): Reward {
  const fallback = CONFIG.rewards.find((reward) => reward.id === CONFIG.fallbackRewardId);
  if (!fallback) {
    throw new Error('Fallback reward missing');
  }
  return fallback;
}

export async function performSpin(options: PerformSpinOptions) {
  const { userId, idempotencyKey, requestSignature, headers } = options;
  const config = getSpinConfig();
  const now = dayjs().tz(TZ);
  const activationStart = dayjs(config.activationStart);
  const activationEnd = dayjs(config.activationEnd);
  if (now.isBefore(activationStart) || now.isAfter(activationEnd)) {
    throw new Error('Campaign is inactive');
  }

  const existingSpin = await prisma.spins.findUnique({
    where: { idempotencyKey },
    include: { reward: true },
  });
  if (existingSpin) {
    const rewardId = existingSpin.rewardId ?? config.fallbackRewardId;
    const reward = existingSpin.reward ?? buildFallbackReward();
    return {
      reward,
      message: reward.id === config.fallbackRewardId
        ? 'Oops… Almost there! Try again tomorrow.'
        : `Selamat! Kamu dapat ${reward.name}`,
      spunAt: existingSpin.createdAt.toISOString(),
      rewardIndex: Math.max(config.rewards.findIndex((entry) => entry.id === rewardId), 0),
    };
  }

  await ensureRateLimit(userId, headers.ip);

  const { start, end } = getTodayRange(now);
  const startUtc = start.toDate();
  const endUtc = end.toDate();
  const dayKey = start.format('YYYYMMDD');

  const todaySpins = await prisma.spins.count({
    where: {
      userId,
      createdAt: {
        gte: startUtc,
        lt: endUtc,
      },
    },
  });
  if (todaySpins >= config.perUserDailySpinLimit) {
    throw new Error('Daily spin limit reached');
  }

  const ttl = end.diff(now, 'second');
  const lockKey = `user:${userId}:spin:${dayKey}`;
  const lock = await redis.set(lockKey, '1', 'NX', 'EX', ttl);
  if (lock !== 'OK') {
    throw new Error('Daily spin limit reached');
  }

  let success = false;
  try {
    let pool = await buildRewardPool(startUtc, endUtc);
    if (!pool.length) {
      const fallbackReward = buildFallbackReward();
      const spinRecord = await prisma.spins.create({
        data: {
          userId,
          rewardId: fallbackReward.id,
          idempotencyKey,
          requestSignature,
          clientInfo: headers,
          outcomeSnapshot: {
            pool: [],
            pickedRewardId: fallbackReward.id,
            rerolls: 0,
          },
        },
        include: { reward: true },
      });
      success = true;
      return {
        reward: fallbackReward,
        message: 'Oops… Almost there! Try again tomorrow.',
        spunAt: spinRecord.createdAt.toISOString(),
        rewardIndex: Math.max(config.rewards.findIndex((reward) => reward.id === fallbackReward.id), 0),
      };
    }

    let rerolls = 0;
    while (pool.length) {
      const choice = pickReward(pool);
      const snapshot = createSnapshot(pool, choice, rerolls);
      try {
        const spinRecord = await reserveReward(choice, userId, idempotencyKey, requestSignature, snapshot, headers, startUtc);
        await redis.hincrby(`rw:${dayKey}`, choice.reward.id, 1);
        await redis.expire(`rw:${dayKey}`, ttl);
        success = true;
        return {
          reward: choice.reward,
          message: `Selamat! Kamu dapat ${choice.reward.name}`,
          spunAt: spinRecord.createdAt.toISOString(),
          rewardIndex: Math.max(config.rewards.findIndex((reward) => reward.id === choice.reward.id), 0),
        };
      } catch (err) {
        pool = pool.filter((entry) => entry.reward.id !== choice.reward.id);
        rerolls += 1;
      }
    }

    const fallbackReward = buildFallbackReward();
    const fallbackRecord = await prisma.spins.create({
      data: {
        userId,
        rewardId: fallbackReward.id,
        idempotencyKey,
        requestSignature,
        clientInfo: headers,
        outcomeSnapshot: {
          pool: [],
          pickedRewardId: fallbackReward.id,
          rerolls,
        },
      },
      include: { reward: true },
    });
    success = true;
    return {
      reward: fallbackReward,
      message: 'Oops… Almost there! Try again tomorrow.',
      spunAt: fallbackRecord.createdAt.toISOString(),
      rewardIndex: Math.max(config.rewards.findIndex((reward) => reward.id === fallbackReward.id), 0),
    };
  } finally {
    if (!success) {
      await redis.del(lockKey);
    }
  }
}

interface UserPrizesOptions {
  summaryOnly?: boolean;
}

export async function getUserPrizes(userId: string, options: UserPrizesOptions = {}) {
  const config = getSpinConfig();
  const now = dayjs().tz(TZ);
  const { start, end } = getTodayRange(now);
  const startUtc = start.toDate();
  const endUtc = end.toDate();
  const todaySpins = await prisma.spins.count({
    where: {
      userId,
      createdAt: {
        gte: startUtc,
        lt: endUtc,
      },
    },
  });
  const remainingSpinsToday = Math.max(config.perUserDailySpinLimit - todaySpins, 0);
  const nextResetAt = end.toISOString();

  if (options.summaryOnly) {
    return { remainingSpinsToday, nextResetAt };
  }

  const prizes = await prisma.spins.findMany({
    where: { userId },
    include: { reward: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return {
    prizes: prizes.map((spin) => ({
      id: spin.id,
      name: spin.reward?.name ?? 'Almost There!',
      type: spin.reward?.type ?? 'none',
      metadata: spin.reward?.metadata ?? undefined,
      wonAt: spin.createdAt.toISOString(),
    })),
    remainingSpinsToday,
    nextResetAt,
  };
}

export async function getSummaryForDate(date: string) {
  const start = dayjs.tz(date, TZ).startOf('day');
  const end = start.add(1, 'day');
  const startUtc = start.toDate();
  const endUtc = end.toDate();

  const totalSpins = await prisma.spins.count({
    where: {
      createdAt: {
        gte: startUtc,
        lt: endUtc,
      },
    },
  });

  const rewards = await prisma.rewards.findMany({
    include: {
      dailyCaps: {
        where: {
          date: { gte: startUtc, lt: endUtc },
        },
      },
      counters: {
        where: {
          date: { gte: startUtc, lt: endUtc },
        },
      },
    },
  });

  return {
    date,
    totalSpins,
    rewards: rewards.map((reward) => ({
      rewardId: reward.id,
      rewardName: reward.name,
      cap: reward.dailyCaps[0]?.cap ?? null,
      usedCount: reward.counters[0]?.usedCount ?? 0,
    })),
  };
}

export const __testing = {
  computeEffectiveWeight,
  pickRewardIndex,
};
