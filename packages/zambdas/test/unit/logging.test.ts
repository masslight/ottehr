import { describe, expect, it, vi } from 'vitest';
import { lambdaResponse } from '../../src/shared/lambda';
import { MAX_LOGGED_CHARS, truncateForLog } from '../../src/shared/logging';

describe('truncateForLog', () => {
  it('caps at 500 characters by default', () => {
    expect(MAX_LOGGED_CHARS).toBe(500);
    expect(truncateForLog('z'.repeat(2000))).toBe(`${'z'.repeat(500)}... [truncated, 2000 chars total]`);
  });

  it('leaves a value at the limit untouched', () => {
    const atLimit = 'z'.repeat(500);
    expect(truncateForLog(atLimit)).toBe(atLimit);
  });

  it('serializes objects before measuring them', () => {
    expect(truncateForLog({ a: 1 })).toBe('{"a":1}');
    expect(truncateForLog({ items: Array.from({ length: 500 }, (_, i) => i) })).toContain('[truncated,');
  });

  it('degrades to a marker instead of throwing on circular structures', () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;

    expect(truncateForLog(circular)).toBe('[unserializable]');
  });

  it('handles undefined and honors a custom limit', () => {
    expect(truncateForLog(undefined)).toBe('undefined');
    expect(truncateForLog('abcdef', 3)).toBe('abc... [truncated, 6 chars total]');
  });
});

describe('lambdaResponse', () => {
  it('logs the status code and a truncated body, and returns the full body', () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((line) => void logged.push(String(line)));

    const body = { note: 'n'.repeat(2000) };
    const result = lambdaResponse(200, body);

    spy.mockRestore();

    expect(result.body).toBe(JSON.stringify(body));
    expect(logged).toHaveLength(1);
    expect(logged[0].startsWith('Response: 200 ')).toBe(true);
    expect(logged[0]).toContain('[truncated,');
    expect(logged[0].length).toBeLessThan(600);
  });
});
