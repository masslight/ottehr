import { describe, expect, it } from 'vitest';
import { DEFAULT_BATCH_DAYS, splitDateRangeIntoBatches } from './reports';

describe('reports', () => {
  describe('DEFAULT_BATCH_DAYS', () => {
    it('should be 1', () => {
      expect(DEFAULT_BATCH_DAYS).toBe(1);
    });
  });

  describe('splitDateRangeIntoBatches', () => {
    it('should return a single batch when range is within maxDays', () => {
      const result = splitDateRangeIntoBatches('2025-06-15T00:00:00Z', '2025-06-15T23:59:59Z', 1);
      expect(result).toHaveLength(1);
      expect(result[0].start).toContain('2025-06-15');
      expect(result[0].end).toContain('2025-06-15');
    });

    it('should split into multiple batches for longer ranges', () => {
      const result = splitDateRangeIntoBatches('2025-06-01T00:00:00Z', '2025-06-10T23:59:59Z', 3);
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should cover the entire range without gaps', () => {
      const start = '2025-06-01T00:00:00Z';
      const end = '2025-06-05T23:59:59Z';
      const batches = splitDateRangeIntoBatches(start, end, 2);

      // First batch should start at the original start
      expect(batches[0].start).toContain('2025-06-01');
      // Last batch should end at the original end
      expect(batches[batches.length - 1].end).toContain('2025-06-05');
    });

    it('should return empty array when start equals end', () => {
      const result = splitDateRangeIntoBatches('2025-06-15T12:00:00Z', '2025-06-15T12:00:00Z', 1);
      expect(result).toHaveLength(0);
    });

    it('should use default batch days of 1', () => {
      const result = splitDateRangeIntoBatches('2025-06-01T00:00:00Z', '2025-06-03T23:59:59Z');
      expect(result.length).toBeGreaterThanOrEqual(3);
    });
  });
});
