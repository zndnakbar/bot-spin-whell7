import crypto from 'crypto';
export function secureRandom() {
  return crypto.randomInt(0, 1_000_000) / 1_000_000;
}
