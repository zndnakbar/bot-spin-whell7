import useSWR from 'swr';
import dayjs from 'dayjs';
import Head from 'next/head';
import Link from 'next/link';
import { useFestiveUserId } from '../lib/user';

interface PrizeEntry {
  id: string;
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
  wonAt: string;
}

const fetcher = (userId: string) =>
  fetch(`/api/spin/my-prizes`, {
    headers: {
      'x-user-id': userId,
    },
  }).then((res) => res.json());

export default function MyPrizesPage() {
  const userId = useFestiveUserId();
  const { data, error } = useSWR<{ prizes: PrizeEntry[] }>(userId ? ['my-prizes', userId] : null, () => fetcher(userId!));

  return (
    <div className="min-h-screen bg-[#fdf8f2] text-festiveDark">
      <Head>
        <title>My Prizes · Festive Fare Spin</title>
      </Head>
      <header className="px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between bg-festiveRed text-white">
        <h1 className="text-3xl font-bold">My Prizes</h1>
        <nav className="flex space-x-4 mt-4 md:mt-0">
          <Link className="underline" href="/">
            Spin Now
          </Link>
          <Link className="underline" href="/prizes">
            All Prizes
          </Link>
        </nav>
      </header>
      <main className="px-6 py-10 max-w-4xl mx-auto space-y-6">
        <p className="text-lg">All rewards are redeemable until 31 Dec 2025 (UTC+8).</p>
        {error && <p className="text-red-600">Unable to load your prizes right now.</p>}
        {!data && !error && <p className="animate-pulse">Loading…</p>}
        {data && (
          <ul className="space-y-4">
            {data.prizes.length === 0 && <li className="text-lg">No prizes yet. Try your luck today!</li>}
            {data.prizes.map((prize) => {
              const status = dayjs().isBefore(dayjs('2025-12-31T23:59:59+08:00')) ? 'Active' : 'Expired';
              return (
                <li key={prize.id} className="bg-white rounded-2xl shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{prize.name}</h2>
                    <p className="text-sm text-festiveDark/70">Won on {dayjs(prize.wonAt).format('D MMM YYYY, h:mm A')}</p>
                  </div>
                  <div className="mt-4 md:mt-0 text-right">
                    <p className="font-semibold">Status: {status}</p>
                    {prize.metadata && (prize.metadata as any).code && (
                      <p className="text-sm">Code: {(prize.metadata as any).code}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
