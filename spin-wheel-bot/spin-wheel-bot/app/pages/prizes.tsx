import useSWR from 'swr';
import Head from 'next/head';
import Link from 'next/link';
import { useFestiveUserId } from '../lib/user';

interface PrizeConfig {
  id: string;
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
}

const fetcher = (userId: string) =>
  fetch(`/api/spin/config`, {
    headers: {
      'x-user-id': userId,
    },
  }).then((res) => res.json());

export default function PrizesPage() {
  const userId = useFestiveUserId();
  const { data, error } = useSWR(userId ? ['prizes', userId] : null, () => fetcher(userId!));

  const prizes: PrizeConfig[] = data?.config?.rewards ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-festiveRed to-festiveGold text-white">
      <Head>
        <title>Prizes · Festive Fare Spin</title>
      </Head>
      <header className="px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Festive Fare Spin Prizes</h1>
        <nav className="flex space-x-4 mt-4 md:mt-0">
          <Link className="underline" href="/">
            Spin Now
          </Link>
          <Link className="underline" href="/my-prizes">
            My Prizes
          </Link>
        </nav>
      </header>
      <main className="px-6 py-10 max-w-5xl mx-auto">
        {error && <p className="text-red-200">Unable to load prize list.</p>}
        {!data && !error && <p className="animate-pulse">Loading…</p>}
        <div className="grid gap-6 md:grid-cols-2">
          {prizes.map((prize) => (
            <div key={prize.id} className="bg-white/15 backdrop-blur rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold">{prize.name}</h2>
              <p className="text-sm uppercase tracking-wide text-white/80">{prize.type}</p>
              {prize.metadata && (prize.metadata as any).routes && (
                <p className="mt-2 text-sm">Routes: {(prize.metadata as any).routes.join(', ')}</p>
              )}
              {prize.metadata && (prize.metadata as any).redeemBy && (
                <p className="text-sm">Redeem by: {(prize.metadata as any).redeemBy}</p>
              )}
              {prize.metadata && (prize.metadata as any).partner && (
                <p className="text-sm">Partner: {(prize.metadata as any).partner}</p>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
