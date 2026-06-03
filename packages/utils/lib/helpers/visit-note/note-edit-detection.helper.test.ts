import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { isNoteEdited, NOTE_EDIT_DETECTION_WINDOW_MS } from './note-edit-detection.helper';

describe('note-edit-detection.helper', () => {
  describe('isNoteEdited', () => {
    const baseIso = '2026-05-22T12:00:00.000Z';
    const baseMillis = DateTime.fromISO(baseIso).toMillis();
    const toIso = (millis: number): string => DateTime.fromMillis(millis, { zone: 'utc' }).toISO()!;

    it('returns false when createdAt is missing', () => {
      expect(isNoteEdited(undefined, baseIso)).toBe(false);
    });

    it('returns false when lastUpdated is missing', () => {
      expect(isNoteEdited(baseIso, undefined)).toBe(false);
    });

    it('returns false when both are missing', () => {
      expect(isNoteEdited(undefined, undefined)).toBe(false);
    });

    it('returns false when createdAt is an empty string', () => {
      expect(isNoteEdited('', baseIso)).toBe(false);
    });

    it('returns false when lastUpdated is an empty string', () => {
      expect(isNoteEdited(baseIso, '')).toBe(false);
    });

    it('returns false when createdAt is an invalid ISO string', () => {
      expect(isNoteEdited('not-a-date', baseIso)).toBe(false);
    });

    it('returns false when lastUpdated is an invalid ISO string', () => {
      expect(isNoteEdited(baseIso, 'still-not-a-date')).toBe(false);
    });

    it('returns false when both timestamps are invalid', () => {
      expect(isNoteEdited('garbage', 'also-garbage')).toBe(false);
    });

    it('returns false when timestamps are byte-identical', () => {
      expect(isNoteEdited(baseIso, baseIso)).toBe(false);
    });

    it('returns false when lastUpdated is within the detection window of createdAt', () => {
      const withinWindow = toIso(baseMillis + NOTE_EDIT_DETECTION_WINDOW_MS - 1);
      expect(isNoteEdited(baseIso, withinWindow)).toBe(false);
    });

    it('returns false when the gap exactly equals the detection window (strict >)', () => {
      const atWindow = toIso(baseMillis + NOTE_EDIT_DETECTION_WINDOW_MS);
      expect(isNoteEdited(baseIso, atWindow)).toBe(false);
    });

    it('returns true when lastUpdated exceeds the detection window by 1ms', () => {
      const justOutside = toIso(baseMillis + NOTE_EDIT_DETECTION_WINDOW_MS + 1);
      expect(isNoteEdited(baseIso, justOutside)).toBe(true);
    });

    it('returns true when lastUpdated is well beyond the detection window', () => {
      const wellOutside = toIso(baseMillis + 60 * 60 * 1000); // +1h
      expect(isNoteEdited(baseIso, wellOutside)).toBe(true);
    });

    it('returns false when lastUpdated is before createdAt (negative diff cannot exceed window)', () => {
      const earlier = toIso(baseMillis - 60 * 60 * 1000); // -1h
      expect(isNoteEdited(baseIso, earlier)).toBe(false);
    });

    it('compares absolute instants regardless of timezone offset', () => {
      // Same instant expressed in two different zones — diff is 0.
      const utc = '2026-05-22T12:00:00.000Z';
      const offset = '2026-05-22T08:00:00.000-04:00';
      expect(isNoteEdited(utc, offset)).toBe(false);
    });
  });
});
