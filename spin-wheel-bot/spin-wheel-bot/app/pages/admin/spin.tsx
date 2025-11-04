import { useState } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import Head from 'next/head';
import { useFestiveUserId } from '../../lib/user';

interface SummaryRow {
  rewardId: string;
  rewardName: string;
  usedCount: number;
  cap: number | null;
}

interface SummaryResponse {
  date: string;
  totalSpins: number;
  rewards: SummaryRow[];
}

const fetcher = (userId: string, date: string) =>
  fetch(`/api/spin/admin-summary?date=${date}`, {
    headers: {
      'x-user-id': userId,
    },
  }).then((res) => res.json());

export default function AdminSpinSummaryPage() {
  const userId = useFestiveUserId();
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data, error } = useSWR<SummaryResponse>(
    userId ? ['admin-summary', userId, selectedDate] : null,
    () => fetcher(userId!, selectedDate)
  );

  return (
    <div className="min-h-screen bg-[#111827] text-white">
      <Head>
        <title>Admin Summary · Festive Fare Spin</title>
      </Head>
      <header className="px-6 py-6 border-b border-white/10">
        <h1 className="text-3xl font-bold">Campaign Summary</h1>
      </header>
      <main className="px-6 py-10 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
          <label className="flex flex-col text-sm text-white/80">
            Date (UTC+8)
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-1 rounded-md border border-white/20 bg-transparent px-3 py-2"
            />
          </label>
        </div>
        {error && <p className="text-red-400">Unable to load summary.</p>}
        {!data && !error && <p className="animate-pulse">Loading…</p>}
        {data && (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-xl p-6">
              <p className="text-lg">Total spins: {data.totalSpins}</p>
            </div>
            <table className="min-w-full text-sm">
              <thead className="text-left uppercase tracking-wide text-white/70">
                <tr>
                  <th className="py-2">Reward</th>
                  <th className="py-2">Used</th>
                  <th className="py-2">Daily Cap</th>
                </tr>
              </thead>
              <tbody>
                {data.rewards.map((row) => (
                  <tr key={row.rewardId} className="border-t border-white/10">
                    <td className="py-2">{row.rewardName}</td>
                    <td className="py-2">{row.usedCount}</td>
                    <td className="py-2">{row.cap ?? '∞'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
