import { VitalFieldNames } from 'utils';
import { describe, expect, it } from 'vitest';
import { getObservationValueElements } from '../../src/features/visits/shared/components/vitals/components/VitalsHistoryEntry';

const LINE_COLOR = '#000000';

describe('getObservationValueElements', () => {
  describe('vital-bmi', () => {
    it('returns the BMI value with kg/m2 unit', () => {
      const obs = { field: VitalFieldNames.VitalBMI, value: 24.3 } as any;
      expect(getObservationValueElements(obs, LINE_COLOR)).toEqual(['24.3 kg/m2']);
    });

    it('displays BMI to exactly 1 decimal place', () => {
      const obs = { field: VitalFieldNames.VitalBMI, value: 22.9 } as any;
      expect(getObservationValueElements(obs, LINE_COLOR)[0]).toBe('22.9 kg/m2');
    });

    it('shows a trailing zero for integer BMI values', () => {
      const obs = { field: VitalFieldNames.VitalBMI, value: 25 } as any;
      expect(getObservationValueElements(obs, LINE_COLOR)[0]).toBe('25.0 kg/m2');
    });

    it('returns exactly one string element', () => {
      const obs = { field: VitalFieldNames.VitalBMI, value: 24.3 } as any;
      const elements = getObservationValueElements(obs, LINE_COLOR);
      expect(elements).toHaveLength(1);
      expect(typeof elements[0]).toBe('string');
    });
  });
});
