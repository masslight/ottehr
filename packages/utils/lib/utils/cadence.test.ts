import { describe, expect, it } from 'vitest';
import { getDefaultCadenceMinutes } from './dateUtils';

describe('getDefaultCadenceMinutes', () => {
  it('returns the duration itself when duration evenly divides 60', () => {
    expect(getDefaultCadenceMinutes(15)).toBe(15);
    expect(getDefaultCadenceMinutes(30)).toBe(30);
    expect(getDefaultCadenceMinutes(60)).toBe(60);
  });

  it('returns 15 for a 45-minute slot (gcd(45,60) = 15)', () => {
    expect(getDefaultCadenceMinutes(45)).toBe(15);
  });

  it('returns 30 for a 90-minute slot (gcd(90,60) = 30)', () => {
    expect(getDefaultCadenceMinutes(90)).toBe(30);
  });

  it('returns 60 for a 120-minute slot (gcd(120,60) = 60)', () => {
    expect(getDefaultCadenceMinutes(120)).toBe(60);
  });

  it('returns 20 for a 20-minute slot (gcd(20,60) = 20)', () => {
    expect(getDefaultCadenceMinutes(20)).toBe(20);
  });

  it('returns the gcd when it lands at or above the 10-min minimum (10 / 12 / 50 / 70 — gcd 10 / 12 / 10 / 10)', () => {
    expect(getDefaultCadenceMinutes(10)).toBe(10);
    expect(getDefaultCadenceMinutes(12)).toBe(12);
    expect(getDefaultCadenceMinutes(50)).toBe(10);
    expect(getDefaultCadenceMinutes(70)).toBe(10);
  });

  it('falls back to the duration itself when gcd collapses below the 10-min minimum', () => {
    // Without the fallback, gcd(d, 60) for these primes / near-primes
    // collapses to 1 or some other tiny value, producing a slot start
    // every minute (or every few minutes) of every open hour — overlap
    // chaos. Falling back to the duration itself gives non-overlapping,
    // predictable starts.
    expect(getDefaultCadenceMinutes(37)).toBe(37); // gcd 1
    expect(getDefaultCadenceMinutes(41)).toBe(41); // gcd 1
    expect(getDefaultCadenceMinutes(49)).toBe(49); // gcd 1
    expect(getDefaultCadenceMinutes(14)).toBe(14); // gcd 2
    expect(getDefaultCadenceMinutes(22)).toBe(22); // gcd 2
    expect(getDefaultCadenceMinutes(25)).toBe(25); // gcd 5
    expect(getDefaultCadenceMinutes(35)).toBe(35); // gcd 5
    expect(getDefaultCadenceMinutes(55)).toBe(55); // gcd 5
  });

  it('falls back to 15 for zero duration', () => {
    expect(getDefaultCadenceMinutes(0)).toBe(15);
  });

  it('falls back to 15 for negative durations', () => {
    expect(getDefaultCadenceMinutes(-30)).toBe(15);
  });

  it('falls back to 15 for non-finite durations', () => {
    expect(getDefaultCadenceMinutes(Number.NaN)).toBe(15);
    expect(getDefaultCadenceMinutes(Number.POSITIVE_INFINITY)).toBe(15);
    expect(getDefaultCadenceMinutes(Number.NEGATIVE_INFINITY)).toBe(15);
  });
});
