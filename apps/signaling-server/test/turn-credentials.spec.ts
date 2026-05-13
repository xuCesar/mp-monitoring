import { describe, expect, it } from '@jest/globals';
import { generateTurnCredentials } from '../src/signaling/turn-credentials';

describe('generateTurnCredentials', () => {
  it('returns expiring credentials for coturn shared secret auth', () => {
    const result = generateTurnCredentials('top-secret', 3600, 1_700_000_000_000);

    expect(result.username).toMatch(/^\d+:viewer$/);
    expect(result.credential).toBeTruthy();
    expect(result.ttlSeconds).toBe(3600);
  });
});
