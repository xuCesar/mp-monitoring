import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('camera-pwa vite config', () => {
  it('loads VITE_* variables from the monorepo root env file', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toContain("envDir: '../..'");
  });
});
