import { describe, expect, it } from 'vitest';
import { getPatientAccountSectionOrder } from './patientAccountSectionOrder';

describe('getPatientAccountSectionOrder', () => {
  it('places workers compensation ahead of medical insurance for workers comp visits', () => {
    expect(getPatientAccountSectionOrder('workers-comp')).toEqual(['workersComp', 'insurance', 'responsible']);
  });

  it.each([undefined, 'occupational-medicine', 'pre-op'])(
    'preserves the default section order for service category %s',
    (serviceCategory) => {
      expect(getPatientAccountSectionOrder(serviceCategory)).toEqual(['insurance', 'responsible', 'workersComp']);
    }
  );
});
