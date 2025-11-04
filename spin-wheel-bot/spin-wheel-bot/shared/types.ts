export interface RewardMetadata {
  [key: string]: unknown;
}

export interface Reward {
  id: string;
  name: string;
  type: string;
  baseWeight: number;
  totalQty: number | null;
  isActive: boolean;
  metadata?: RewardMetadata;
}

export interface RewardWithCap extends Reward {
  capToday: number | null;
  usedToday: number;
  remainingToday: number | null;
  effectiveWeight: number;
}

export interface CampaignConfig {
  campaignId: string;
  timezone: string;
  activationStart: string;
  activationEnd: string;
  perUserDailySpinLimit: number;
  fallbackRewardId: string;
  rewards: Reward[];
}

export interface SpinOutcome {
  reward: Reward;
  message: string;
  spunAt: string;
}

export interface SpinRequestPayload {
  idempotencyKey: string;
  userId: string;
  timestamp: number;
}

export interface SpinPoolEntry {
  rewardId: string;
  effectiveWeight: number;
  remainingToday: number;
  capToday: number;
}

export interface SpinOutcomeSnapshot {
  pool: SpinPoolEntry[];
  pickedRewardId: string;
  rerolls: number;
}
