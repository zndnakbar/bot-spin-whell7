import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import SpinWheel from '../components/SpinWheel';
import { fetchConfig, postSpin, SpinConfigResponse, SpinResponse } from '../lib/api';
import { useFestiveUserId } from '../lib/user';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

type SpinState = 'idle' | 'countdown' | 'cooldown' | 'spinning';

const festivePalette = ['#C62828', '#F9A825', '#8E24AA', '#00897B', '#6D4C41', '#0277BD', '#FB8C00', '#2E7D32'];

const fetcher = (userId: string) => fetchConfig(userId);

export default function Home() {
  const userId = useFestiveUserId();
  const [lastSpin, setLastSpin] = useState<SpinResponse | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [spinState, setSpinState] = useState<SpinState>('idle');

  const { data, error, mutate } = useSWR<SpinConfigResponse>(userId ? ['config', userId] : null, () => fetcher(userId!));

  const isLoading = !data && !error;

  const campaignConfig = data?.config;
  const timezoneName = campaignConfig?.timezone ?? 'Asia/Kuala_Lumpur';
  const now = useMemo(() => (data ? dayjs(data.serverTime).tz(timezoneName) : dayjs().tz(timezoneName)), [data, timezoneName]);

  useEffect(() => {
    if (!campaignConfig) return;
    const activationStart = dayjs(campaignConfig.activationStart).tz(timezoneName);
    const activationEnd = dayjs(campaignConfig.activationEnd).tz(timezoneName);
    if (now.isBefore(activationStart)) {
      setSpinState('countdown');
    } else if (now.isAfter(activationEnd)) {
      setSpinState('cooldown');
    } else if ((data?.remainingSpinsToday ?? 0) <= 0) {
      setSpinState('cooldown');
    } else {
      setSpinState('idle');
    }
  }, [campaignConfig, now, data?.remainingSpinsToday]);

  const segments = useMemo(() => {
    if (!campaignConfig) return [];
    const rewards = campaignConfig.rewards.filter((reward) => reward.isActive);
    return rewards.map((reward, index) => ({
      id: reward.id,
      label: reward.name,
      icon: reward.type === 'voucher' ? '🎟️' : reward.type === 'physical' ? '🎁' : reward.type === 'perk' ? '✨' : '🙂',
      color: festivePalette[index % festivePalette.length],
    }));
  }, [campaignConfig]);

  const handleSpin = async () => {
    if (!userId) return 0;
    setSpinError(null);
    setSpinState('spinning');
    try {
      const timestamp = Date.now();
      const response = await postSpin(userId, {
        idempotencyKey: uuidv4(),
        timestamp,
      });
      setLastSpin(response);
      mutate();
      return response.rewardIndex;
    } catch (err) {
      setSpinError(err instanceof Error ? err.message : 'Unable to spin');
      setSpinState('idle');
      return 0;
    }
  };

  const nextReset = data ? dayjs(data.nextResetAt).tz(timezoneName) : null;
  const countdownLabel = nextReset ? nextReset.from(now) : 'later today';

  return (
    <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80')] bg-cover">
      <Head>
        <title>Festive Fare Spin</title>
      </Head>
      <div className="min-h-screen backdrop-blur-sm backdrop-brightness-95">
        <header className="px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between text-white">
          <h1 className="text-3xl md:text-4xl font-bold drop-shadow-lg">Festive Fare Spin</h1>
          <nav className="flex space-x-4 mt-4 md:mt-0">
            <Link className="underline" href="/prizes">
              All Prizes
            </Link>
            <Link className="underline" href="/my-prizes">
              My Prizes
            </Link>
          </nav>
        </header>
        <main className="px-6 pb-16 flex flex-col items-center text-center text-white">
          <section className="max-w-3xl bg-black/40 rounded-3xl p-10 shadow-2xl">
            <h2 className="text-2xl font-semibold mb-6">Cooking your rewards…</h2>
            {isLoading && <p className="animate-pulse">Loading campaign details…</p>}
            {error && <p className="text-red-200">Unable to load campaign. Please try again shortly.</p>}
            {campaignConfig && segments.length > 0 && (
              <div className="space-y-8">
                <SpinWheel
                  segments={segments}
                  onSpin={handleSpin}
                  disabled={spinState !== 'idle'}
                  ariaLabel="Festive Fare Spin wheel"
                />
                {spinState === 'countdown' && (
                  <p className="text-lg">
                    The Festive Fare Spin opens on{' '}
                    {dayjs(campaignConfig.activationStart).tz(timezoneName).format('D MMM YYYY, h:mm A')}.
                  </p>
                )}
                {spinState === 'cooldown' && (
                  <p className="text-lg">
                    Oops… Almost there! Come back {nextReset ? `after ${countdownLabel}` : 'tomorrow'}.
                  </p>
                )}
                {spinError && <p className="text-red-200">{spinError}</p>}
                {lastSpin && (
                  <div className="bg-white/90 text-festiveDark rounded-2xl p-6 space-y-2">
                    <h3 className="text-2xl font-bold">Woohoo!</h3>
                    <p className="text-xl">{lastSpin.reward.name}</p>
                    {lastSpin.reward.metadata && (lastSpin.reward.metadata as any).code && (
                      <p className="text-sm uppercase tracking-wide">
                        Code: <span className="font-mono">{(lastSpin.reward.metadata as any).code}</span>
                      </p>
                    )}
                    <div className="flex flex-col md:flex-row md:space-x-4 space-y-3 md:space-y-0 justify-center">
                      <button className="px-6 py-2 rounded-full bg-festiveGold text-white font-semibold shadow">
                        Use Now
                      </button>
                      <button className="px-6 py-2 rounded-full bg-festiveDark text-white font-semibold shadow" disabled>
                        Spin Again Tomorrow
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-sm text-white/80">
                  Each user gets one spin daily between 15–26 Dec 2025 ({timezoneName}). Prizes redeemable until 31 Dec 2025.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
