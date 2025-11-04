import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import redis from '../lib/redis';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Kuala_Lumpur';

export async function scheduleDailyReset() {
  const now = dayjs().tz(TZ);
  const nextReset = now.add(1, 'day').startOf('day');
  const delay = nextReset.diff(now, 'millisecond');
  setTimeout(async () => {
    const keyPattern = `rw:${now.format('YYYYMMDD')}`;
    await redis.del(keyPattern);
    scheduleDailyReset();
  }, delay);
}
