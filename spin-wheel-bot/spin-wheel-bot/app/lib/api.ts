const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/spin';

export interface SpinConfigResponse {
  config: {
    campaignId: string;
    timezone: string;
    activationStart: string;
    activationEnd: string;
    perUserDailySpinLimit: number;
    fallbackRewardId: string;
    rewards: Array<{
      id: string;
      name: string;
      type: string;
      baseWeight: number;
      totalQty: number | null;
      isActive: boolean;
      metadata?: Record<string, unknown>;
    }>;
  };
  serverTime: string;
  remainingSpinsToday: number;
  nextResetAt: string;
}

export interface SpinResponse {
  reward: {
    id: string;
    name: string;
    type: string;
    metadata?: Record<string, unknown>;
  };
  message: string;
  spunAt: string;
  rewardIndex: number;
}

export async function fetchConfig(userId: string): Promise<SpinConfigResponse> {
  const res = await fetch(`${API_BASE}/config`, {
    headers: { 'x-user-id': userId },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch config');
  }
  return res.json();
}

export async function postSpin(
  userId: string,
  payload: { idempotencyKey: string; timestamp: number }
): Promise<SpinResponse> {
  const res = await fetch(`${API_BASE}/spin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: 'Spin failed' }));
    throw new Error(errorBody.message ?? 'Spin failed');
  }
  return res.json();
}
