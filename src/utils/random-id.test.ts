import { describe, expect, it } from 'vitest';

import { generateId } from './random-id';

describe('generateId', () => {
  it('returns an 8-character string', () => {
    const id = generateId();
    expect(id).toHaveLength(8);
  });

  it('returns only alphanumeric characters', () => {
    const id = generateId();
    expect(id).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it('returns different values across multiple calls', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});
