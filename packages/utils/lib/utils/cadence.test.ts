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

  it('returns 5 for a 25-minute slot (gcd(25,60) = 5)', () => {
    expect(getDefaultCadenceMinutes(25)).toBe(5);
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
