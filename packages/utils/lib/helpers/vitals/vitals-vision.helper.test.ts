import { describe, expect, it } from 'vitest';
import { VitalsVisionOption } from '../../types';
import { getVisionExtraOptionsFormattedString } from './vitals-vision.helper';

describe('vitals-vision.helper', () => {
  describe('getVisionExtraOptionsFormattedString', () => {
    it('should return undefined when options is undefined', () => {
      expect(getVisionExtraOptionsFormattedString(undefined)).toBeUndefined();
    });

    it('should return undefined when options is empty', () => {
      expect(getVisionExtraOptionsFormattedString([])).toBeUndefined();
    });

    it('should format a single option', () => {
      expect(getVisionExtraOptionsFormattedString(['with_glasses'])).toBe(' With glasses');
    });

    it('should format multiple options separated by semicolons', () => {
      const options: VitalsVisionOption[] = ['with_glasses', 'without_glasses'];
      const result = getVisionExtraOptionsFormattedString(options);
      expect(result).toBe(' With glasses; Without glasses');
    });

    it('should format child_too_young option', () => {
      expect(getVisionExtraOptionsFormattedString(['child_too_young'])).toBe(' Child too young');
    });

    it('should format all three options', () => {
      const options: VitalsVisionOption[] = ['child_too_young', 'with_glasses', 'without_glasses'];
      const result = getVisionExtraOptionsFormattedString(options);
      expect(result).toBe(' Child too young; With glasses; Without glasses');
    });
  });
});
