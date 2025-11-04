import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

const prisma = new PrismaClient();
const TZ = 'Asia/Kuala_Lumpur';

dayjs.extend(utc);
dayjs.extend(timezone);

const rewardsSeed = [
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
    metadata: {},
  },
];

async function main() {
  const activationStart = dayjs.tz('2025-12-15', TZ);
  const days = Array.from({ length: 12 }, (_, index) => activationStart.add(index, 'day'));
  const priorityIndices = [5, 6, 7, 8, 9, 10, 11, 4, 3, 2, 1, 0];

  for (const reward of rewardsSeed) {
    await prisma.rewards.upsert({
      where: { id: reward.id },
      update: {
        name: reward.name,
        type: reward.type,
        baseWeight: reward.baseWeight,
        totalQty: reward.totalQty,
        isActive: reward.isActive,
        metadata: reward.metadata,
      },
      create: {
        id: reward.id,
        name: reward.name,
        type: reward.type,
        baseWeight: reward.baseWeight,
        totalQty: reward.totalQty,
        isActive: reward.isActive,
        metadata: reward.metadata,
      },
    });

    if (reward.totalQty) {
      const base = Math.floor(reward.totalQty / days.length);
      const remainder = reward.totalQty % days.length;
      const remainderSet = new Set(priorityIndices.slice(0, remainder));
      for (const [index, day] of days.entries()) {
        let cap = base;
        if (remainderSet.has(index)) {
          cap += 1;
        }
        const date = day.startOf('day').toDate();
        await prisma.daily_caps.upsert({
          where: {
            dailyReward_date: {
              rewardId: reward.id,
              date,
            },
          },
          update: {
            cap,
          },
          create: {
            rewardId: reward.id,
            date,
            cap,
          },
        });
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
