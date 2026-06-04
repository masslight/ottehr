import { Secrets } from 'utils';
import { describe, expect, test } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';
import { validateRequestParameters } from '../../src/subscriptions/appointment/sub-erx-patient-sync/validateRequestParameters';

const secrets = {} as Secrets;

const makeInput = (resource: unknown): ZambdaInput => ({
  headers: null,
  body: JSON.stringify(resource),
  secrets,
});

describe('sub-erx-patient-sync validateRequestParameters', () => {
  test('parses an Observation body into patientId + encounterId', () => {
    const result = validateRequestParameters(
      makeInput({
        resourceType: 'Observation',
        id: 'obs-1',
        subject: { reference: 'Patient/pat-1' },
        encounter: { reference: 'Encounter/enc-1' },
      })
    );
    expect(result.patientId).toBe('pat-1');
    expect(result.encounterId).toBe('enc-1');
  });

  test('parses a Patient body into patientId with no encounterId', () => {
    const result = validateRequestParameters(
      makeInput({
        resourceType: 'Patient',
        id: 'pat-1',
      })
    );
    expect(result.patientId).toBe('pat-1');
    expect(result.encounterId).toBeUndefined();
  });

  test('throws on an unsupported resourceType', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          resourceType: 'Practitioner',
          id: 'prac-1',
        })
      )
    ).toThrow();
  });

  test('throws on an Observation missing its encounter reference', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          resourceType: 'Observation',
          id: 'obs-1',
          subject: { reference: 'Patient/pat-1' },
        })
      )
    ).toThrow();
  });

  test('throws when the body is missing', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: null,
        secrets,
      })
    ).toThrow();
  });
});
