import { DateTime } from 'luxon';
import { ENV } from './env.js';
export function now() {
  return DateTime.now().setZone(ENV.DAILY_TIMEZONE);
}
export function todayKey() {
  return now().toFormat('yyyy-LL-dd');
}
