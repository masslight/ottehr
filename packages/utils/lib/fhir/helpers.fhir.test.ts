import { describe, expect, it } from 'vitest';
import { CPTCodeDTO } from '../types/api/chart-data/chart-data.types';
import { convertFhirNameToDisplayName } from './convertFhirNameToDisplayName';
import { makeCptCodeDisplay, reducePatchOperations, sanitizeStringForFhirCode } from './helpers';

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

describe('sanitizeStringForFhirCode', () => {
  it('returns a valid single-word code unchanged', () => {
    expect(sanitizeStringForFhirCode('blood-pressure')).toBe('blood-pressure');
  });

  it('returns a valid multi-word code unchanged', () => {
    expect(sanitizeStringForFhirCode('blood pressure')).toBe('blood pressure');
  });

  it('trims leading whitespace', () => {
    expect(sanitizeStringForFhirCode('  blood-pressure')).toBe('blood-pressure');
  });

  it('trims trailing whitespace', () => {
    expect(sanitizeStringForFhirCode('blood-pressure  ')).toBe('blood-pressure');
  });

  it('trims both leading and trailing whitespace', () => {
    expect(sanitizeStringForFhirCode('  blood-pressure  ')).toBe('blood-pressure');
  });

  it('collapses multiple consecutive spaces into one', () => {
    expect(sanitizeStringForFhirCode('blood  pressure')).toBe('blood pressure');
  });

  it('trims and collapses when both issues are present', () => {
    expect(sanitizeStringForFhirCode('  blood   pressure  ')).toBe('blood pressure');
  });

  it('collapses tabs and newlines into single spaces', () => {
    expect(sanitizeStringForFhirCode('blood\t\tpressure')).toBe('blood pressure');
  });
});

describe('reducePatchFunctions', () => {
  it('reduces correctly', () => {
    expect(
      reducePatchOperations([
        {
          method: 'GET',
          url: '/Patient/12345',
        },
        {
          method: 'PATCH',
          url: '/Practitioner/12345',
          resource: {
            resourceType: 'Binary',
            data: btoa(
              unescape(encodeURIComponent(JSON.stringify([{ op: 'replace', path: '/active', value: false }])))
            ),
            contentType: 'application/json-patch+json',
          },
        },
        {
          method: 'PATCH',
          url: '/Person/12345',
          operations: [
            {
              op: 'replace',
              path: '/active',
              value: true,
            },
          ],
        },
        {
          method: 'PATCH',
          url: '/Person/45678',
          operations: [
            {
              op: 'replace',
              path: '/active',
              value: false,
            },
          ],
        },
        {
          method: 'PATCH',
          url: '/Person/12345',
          operations: [
            {
              op: 'replace',
              path: '/birthDate',
              value: '2026-01-01',
            },
          ],
        },
      ])
    ).toEqual([
      {
        method: 'GET',
        url: '/Patient/12345',
      },
      {
        method: 'PATCH',
        url: '/Practitioner/12345',
        resource: {
          resourceType: 'Binary',
          data: btoa(unescape(encodeURIComponent(JSON.stringify([{ op: 'replace', path: '/active', value: false }])))),
          contentType: 'application/json-patch+json',
        },
      },
      {
        method: 'PATCH',
        url: '/Person/12345',
        operations: [
          {
            op: 'replace',
            path: '/active',
            value: true,
          },
          {
            op: 'replace',
            path: '/birthDate',
            value: '2026-01-01',
          },
        ],
      },
      {
        method: 'PATCH',
        url: '/Person/45678',
        operations: [
          {
            op: 'replace',
            path: '/active',
            value: false,
          },
        ],
      },
    ]);
  });
});
