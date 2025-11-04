import crypto from 'node:crypto';

const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-hmac';

export function computeSignature(payload: string) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

export function verifySignature(payload: string, signature: string) {
  const expected = computeSignature(payload);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
