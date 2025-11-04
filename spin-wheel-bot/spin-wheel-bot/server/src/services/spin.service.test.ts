import { beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { performSpin, __testing } from './spin.service';

dayjs.extend(utc);
dayjs.extend(timezone);

const state = {
  rewards: [] as any[],
  counters: new Map<string, { usedCount: number }>(),
  spins: [] as any[],
  dailyCaps: new Map<string, { cap: number }>(),
};

function dayKeyDate() {
  return dayjs().tz('Asia/Kuala_Lumpur').startOf('day').toDate();
}

vi.mock('../lib/prisma', () => {
  const prisma = {
    rewards: {
      findMany: vi.fn(async () =>
        state.rewards.map((reward) => {
          const counterKey = `${reward.id}:`;
          const counterEntry = Array.from(state.counters.entries())
            .filter(([key]) => key.startsWith(`${reward.id}:`))
            .map(([, value]) => ({ usedCount: value.usedCount }));
          return {
            ...reward,
            dailyCaps: reward.dailyCaps ?? [],
            counters: counterEntry.length ? counterEntry : reward.counters ?? [],
          };
        })
      ),
    },
    reward_counters: {
      upsert: vi.fn(async ({ where, create }) => {
        const key = `${where.rewardId_date.rewardId}:${where.rewardId_date.date.toISOString()}`;
        const entry = state.counters.get(key) ?? { usedCount: 0, id: key };
        state.counters.set(key, entry);
        return entry;
      }),
    },
    spins: {
      count: vi.fn(async ({ where }) =>
        state.spins.filter((spin) => {
          if (where.userId && spin.userId !== where.userId) return false;
          if (where.rewardId && spin.rewardId !== where.rewardId) return false;
          if (where.createdAt) {
            const created = new Date(spin.createdAt).getTime();
            const gte = where.createdAt.gte?.getTime?.() ?? 0;
            const lt = where.createdAt.lt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
            if (!(created >= gte && created < lt)) {
              return false;
            }
          }
          return true;
        }).length
      ),
      create: vi.fn(async ({ data }) => {
        const reward = state.rewards.find((item) => item.id === data.rewardId) ?? null;
        const record = {
          id: `spin_${state.spins.length + 1}`,
          userId: data.userId,
          rewardId: data.rewardId,
          idempotencyKey: data.idempotencyKey,
          requestSignature: data.requestSignature,
          clientInfo: data.clientInfo,
          outcomeSnapshot: data.outcomeSnapshot,
          createdAt: new Date(),
          reward,
        };
        state.spins.push(record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }) => state.spins.find((spin) => spin.idempotencyKey === where.idempotencyKey) ?? null),
      findMany: vi.fn(async ({ where }) =>
        state.spins
          .filter((spin) => spin.userId === where.userId)
          .map((spin) => ({ ...spin, reward: state.rewards.find((item) => item.id === spin.rewardId) }))
      ),
    },
    $transaction: async (callback: any) =>
      callback({
        reward_counters: {
          upsert: async ({ where, create }: any) => {
            const key = `${where.rewardId_date.rewardId}:${where.rewardId_date.date.toISOString()}`;
            let entry = state.counters.get(key);
            if (!entry) {
              entry = { id: key, rewardId: where.rewardId_date.rewardId, date: where.rewardId_date.date, usedCount: 0 };
              state.counters.set(key, entry);
            }
            return entry;
          },
          update: async ({ where, data }: any) => {
            const entry = state.counters.get(where.id);
            if (entry) {
              entry.usedCount += data.usedCount.increment;
            }
            return entry;
          },
        },
        spins: {
          count: async (args: any) => prisma.spins.count(args),
          create: async (args: any) => prisma.spins.create(args),
        },
      }),
  } as any;

  prisma.reward_counters.update = vi.fn(async ({ where, data }) => {
    const entry = state.counters.get(where.id);
    if (entry) {
      entry.usedCount += data.usedCount.increment;
    }
    return entry;
  });

  return { __esModule: true, default: prisma };
});

vi.mock('../lib/redis', () => {
  const counters = new Map<string, number>();
  const hashes = new Map<string, Map<string, number>>();
  return {
    __esModule: true,
    default: {
      async incr(key: string) {
        const value = (counters.get(key) ?? 0) + 1;
        counters.set(key, value);
        return value;
      },
      async expire() {
        return true;
      },
      async set(key: string, value: string, mode: string, option: string, ttl: number) {
        if (mode === 'NX') {
          if (counters.has(key)) {
            return null;
          }
          counters.set(key, Number(value));
          return 'OK';
        }
        counters.set(key, Number(value));
        return 'OK';
      },
      async hincrby(key: string, field: string, increment: number) {
        const hash = hashes.get(key) ?? new Map();
        const current = (hash.get(field) ?? 0) + increment;
        hash.set(field, current);
        hashes.set(key, hash);
        return current;
      },
      async del(key: string) {
        counters.delete(key);
        hashes.delete(key);
      },
    },
  };
});

function setupRewards() {
  state.rewards = [
    {
      id: 'reward_rm10',
      name: 'RM10 Instant Discount',
      type: 'voucher',
      baseWeight: 10,
      totalQty: 100,
      isActive: true,
      metadata: {},
      dailyCaps: [{ cap: 5 }],
      counters: [],
    },
    {
      id: 'reward_rm5',
      name: 'RM5 Instant Discount',
      type: 'voucher',
      baseWeight: 20,
      totalQty: 100,
      isActive: true,
      metadata: {},
      dailyCaps: [{ cap: 10 }],
      counters: [],
    },
    {
      id: 'reward_almost',
      name: 'Almost There!',
      type: 'none',
      baseWeight: 6,
      totalQty: null,
      isActive: true,
      metadata: {},
      dailyCaps: [],
      counters: [],
    },
  ];
}

beforeEach(() => {
  setupRewards();
  state.spins = [];
  state.counters.clear();
});

describe('computeEffectiveWeight', () => {
  it('scales down weight as remaining stock decreases', () => {
    expect(__testing.computeEffectiveWeight(10, 10, 10)).toBe(10);
    expect(__testing.computeEffectiveWeight(10, 5, 10)).toBe(5);
    expect(__testing.computeEffectiveWeight(10, 1, 10)).toBe(1);
    expect(__testing.computeEffectiveWeight(10, 0, 10)).toBe(0);
  });
});

describe('pickRewardIndex', () => {
  it('selects reward respecting weights', () => {
    const weights = [1, 3, 6];
    expect(__testing.pickRewardIndex(weights, 0)).toBe(0);
    expect(__testing.pickRewardIndex(weights, 1)).toBe(1);
    expect(__testing.pickRewardIndex(weights, 3)).toBe(1);
    expect(__testing.pickRewardIndex(weights, 4)).toBe(2);
  });
});

describe('performSpin', () => {
  it('grants a reward and records spin', async () => {
    const result = await performSpin({
      userId: 'user-1',
      idempotencyKey: 'idem-1',
      timestamp: Date.now(),
      requestSignature: 'sig',
      headers: { ip: '127.0.0.1', userAgent: 'jest' },
    });
    expect(result.reward.id).toBeDefined();
    expect(state.spins.length).toBe(1);
  });

  it('enforces per-user daily lock on second spin', async () => {
    await performSpin({
      userId: 'user-1',
      idempotencyKey: 'idem-1',
      timestamp: Date.now(),
      requestSignature: 'sig',
      headers: { ip: '127.0.0.1', userAgent: 'jest' },
    });

    await expect(
      performSpin({
        userId: 'user-1',
        idempotencyKey: 'idem-2',
        timestamp: Date.now(),
        requestSignature: 'sig',
        headers: { ip: '127.0.0.1', userAgent: 'jest' },
      })
    ).rejects.toThrow('Daily spin limit reached');
  });

  it('rerolls when a reward hits daily cap', async () => {
    state.rewards[0].dailyCaps[0].cap = 1;
    const key = `${state.rewards[0].id}:${dayKeyDate().toISOString()}`;
    state.counters.set(key, { id: key, usedCount: 1 });
    const result = await performSpin({
      userId: 'user-2',
      idempotencyKey: 'idem-3',
      timestamp: Date.now(),
      requestSignature: 'sig',
      headers: { ip: '127.0.0.1', userAgent: 'jest' },
    });
    expect(result.reward.id).toBe('reward_rm5');
  });

  it('handles concurrent spins without exceeding caps', async () => {
    state.rewards[0].dailyCaps[0].cap = 1;
    const [first, second] = await Promise.all([
      performSpin({
        userId: 'user-a',
        idempotencyKey: 'idem-a',
        timestamp: Date.now(),
        requestSignature: 'sig',
        headers: { ip: '1.1.1.1', userAgent: 'jest' },
      }),
      performSpin({
        userId: 'user-b',
        idempotencyKey: 'idem-b',
        timestamp: Date.now(),
        requestSignature: 'sig',
        headers: { ip: '2.2.2.2', userAgent: 'jest' },
      }),
    ]);
    const rewards = [first.reward.id, second.reward.id].sort();
    expect(rewards).toEqual(['reward_rm10', 'reward_rm5']);
  });

  it('returns same outcome for idempotent requests', async () => {
    const first = await performSpin({
      userId: 'user-3',
      idempotencyKey: 'idem-4',
      timestamp: Date.now(),
      requestSignature: 'sig',
      headers: { ip: '127.0.0.1', userAgent: 'jest' },
    });
    const second = await performSpin({
      userId: 'user-3',
      idempotencyKey: 'idem-4',
      timestamp: Date.now(),
      requestSignature: 'sig',
      headers: { ip: '127.0.0.1', userAgent: 'jest' },
    });
    expect(second.reward.id).toBe(first.reward.id);
    expect(state.spins.length).toBeGreaterThanOrEqual(1);
  });
});
