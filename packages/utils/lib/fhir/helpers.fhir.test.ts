import { describe, expect, it } from 'vitest';
import { CPTCodeDTO } from '../types';
import { convertFhirNameToDisplayName } from './convertFhirNameToDisplayName';
import { makeCptCodeDisplay } from './helpers';

describe('Display helper functions', () => {
  it('convertFhirNameToDisplayName should return full name string', () => {
    const full = convertFhirNameToDisplayName({ family: 'John', given: ['Gait'] });
    expect(full).toEqual('John, Gait');
  });

  it('makeCptCodeDisplay should format cpt code for front end (no modifier)', () => {
    const cptCode: CPTCodeDTO = { code: '87807', display: 'Rapid RSV' };
    const formattedDisplay = makeCptCodeDisplay(cptCode);
    expect(formattedDisplay).toEqual('87807 Rapid RSV');
  });

  it('makeCptCodeDisplay should format cpt code for front end (one modifier)', () => {
    const cptCode: CPTCodeDTO = {
      code: '82962',
      display: 'Glucose Finger/Heel Stick',
      modifier: [{ code: '91', display: 'Repeat Clinical Diagnostic Laboratory Test' }],
    };
    const formattedDisplay = makeCptCodeDisplay(cptCode);
    expect(formattedDisplay).toEqual('82962-91 Glucose Finger/Heel Stick - Repeat Clinical Diagnostic Laboratory Test');
  });

  it('makeCptCodeDisplay should format cpt code for front end (three modifiers)', () => {
    const cptCode: CPTCodeDTO = {
      code: '82962',
      display: 'Glucose Finger/Heel Stick',
      modifier: [
        { code: '91', display: 'Repeat Clinical Diagnostic Laboratory Test' },
        { code: '26', display: 'Professional Component' },
        { code: '47', display: 'Anesthesia by Surgeon' },
      ],
    };
    const formattedDisplay = makeCptCodeDisplay(cptCode);
    expect(formattedDisplay).toEqual(
      '82962-91-26-47 Glucose Finger/Heel Stick - Repeat Clinical Diagnostic Laboratory Test - Professional Component - Anesthesia by Surgeon'
    );
  });
});
