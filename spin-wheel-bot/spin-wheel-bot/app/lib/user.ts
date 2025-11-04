import { useEffect, useState } from 'react';

const STORAGE_KEY = 'festive-fare-spin:user-id';

export function useFestiveUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let existing = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!existing) {
      existing = crypto.randomUUID();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, existing);
      }
    }
    setUserId(existing);
  }, []);

  return userId;
}
