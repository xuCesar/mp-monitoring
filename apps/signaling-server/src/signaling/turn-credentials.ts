import crypto from 'node:crypto';

export function generateTurnCredentials(
  secret: string,
  ttlSeconds: number,
  nowMs = Date.now(),
) {
  const expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
  const username = `${expiresAt}:viewer`;
  const credential = crypto
    .createHmac('sha1', secret)
    .update(username)
    .digest('base64');

  return {
    username,
    credential,
    ttlSeconds,
  };
}
