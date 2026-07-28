import { ServiceRequest } from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { MAX_PLAUSIBLE_LENGTH_CM } from 'utils/lib/procedure-coding/extract';
import { REPAIR_DEPTH_OPTIONS } from 'utils/lib/procedure-coding/format';
import { ProcedureDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/save-chart-data/validateRequestParameters';
import { createProcedureServiceRequest } from '../../../src/shared/chart-data';
import { createMockZambdaInput } from './helpers';

const ENCOUNTER_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('save-chart-data - validateRequestParameters', () => {
  const validBody = {
    encounterId: '550e8400-e29b-41d4-a716-446655440000',
    chartDataResourceType: 'vitals',
    data: { weight: 70 },
  };

  test('should return validated params with encounterId', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should spread all body data into result', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result).toHaveProperty('chartDataResourceType', 'vitals');
    expect(result).toHaveProperty('data', { weight: 70 });
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput(validBody, {
      headers: { Authorization: 'Bearer my-special-token' },
    });
    const result = validateRequestParameters(input);

    expect(result.userToken).toBe('my-special-token');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is undefined', () => {
    const input = createMockZambdaInput({ someField: 'value' });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: 'enc-123' });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(validBody, {
      headers: {},
    });
    expect(() => validateRequestParameters(input)).toThrow('not authorized');
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});

const validateProcedure = (procedure: Record<string, unknown>): ProcedureDTO => {
  const result = validateRequestParameters(
    createMockZambdaInput({ encounterId: ENCOUNTER_ID, procedures: [procedure] })
  );
  const validated = result.procedures?.[0];
  if (validated === undefined) throw new Error('expected a validated procedure');
  return validated;
};

const expectRejected = (procedure: Record<string, unknown>): void => {
  try {
    validateProcedure(procedure);
    expect.fail('expected the request to be rejected');
  } catch (error: any) {
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  }
};

describe('save-chart-data - procedure payload', () => {
  test('should pass the rest of the procedure payload through untouched', () => {
    const validated = validateProcedure({
      resourceId: 'sr-1',
      procedureType: 'laceration-repair',
      procedureDetails: 'Layered closure, 5 x 4-0 nylon',
      cptCodes: [{ code: '12042', display: 'Intermediate repair' }],
      technique: ['Simple interrupted'],
      consentObtained: true,
    });
    expect(validated).toEqual({
      resourceId: 'sr-1',
      procedureType: 'laceration-repair',
      procedureDetails: 'Layered closure, 5 x 4-0 nylon',
      cptCodes: [{ code: '12042', display: 'Intermediate repair' }],
      technique: ['Simple interrupted'],
      consentObtained: true,
    });
  });

  test('should accept a procedure with none of the structured fields set', () => {
    expect(validateProcedure({ procedureType: 'ekg' })).toEqual({ procedureType: 'ekg' });
  });

  test('should throw when procedures is not an array', () => {
    const input = createMockZambdaInput({ encounterId: ENCOUNTER_ID, procedures: { lengthCm: 3 } });
    expect(() => validateRequestParameters(input)).toThrow('procedures');
  });
});

describe('save-chart-data - procedure lengthCm', () => {
  test.each([0.1, 1, 3.5, MAX_PLAUSIBLE_LENGTH_CM])('should accept %s cm', (lengthCm) => {
    expect(validateProcedure({ lengthCm }).lengthCm).toBe(lengthCm);
  });

  test.each([
    ['just past the plausibility ceiling', MAX_PLAUSIBLE_LENGTH_CM + 0.1],
    ['far past the plausibility ceiling', 100_000],
    ['zero', 0],
    ['negative', -5],
    ['a numeric string', '3.5'],
    ['null', null],
  ])('should throw for %s', (_label, lengthCm) => {
    expectRejected({ lengthCm });
  });
});

describe('save-chart-data - procedure repairDepth', () => {
  test.each(REPAIR_DEPTH_OPTIONS.map((option) => option.value))('should accept the %s selection', (repairDepth) => {
    expect(validateProcedure({ repairDepth }).repairDepth).toBe(repairDepth);
  });

  test.each([
    ['an unknown selection', 'deep-single'],
    ['a display label instead of the stored code', 'Subcutaneous — layered closure'],
    ['markup', '<script>alert(1)</script>'],
    ['an empty string', ''],
    ['a non-string', 3],
  ])('should throw for %s', (_label, repairDepth) => {
    expectRejected({ repairDepth });
  });
});

describe('save-chart-data - procedure infusion times', () => {
  test.each(['00:00', '09:05', '12:30', '23:59'])('should accept %s', (time) => {
    const validated = validateProcedure({ infusionStartTime: time, infusionStopTime: time });
    expect(validated.infusionStartTime).toBe(time);
    expect(validated.infusionStopTime).toBe(time);
  });

  test.each([
    ['an out-of-range hour', '24:00'],
    ['an out-of-range minute', '12:60'],
    ['a nonsense clock', '99:99'],
    ['an unpadded hour, a second spelling of one time', '9:05'],
    ['seconds precision', '09:05:00'],
    ['a 12-hour clock with a meridiem', '9:05 pm'],
    ['a full ISO timestamp', '2026-01-01T09:05:00Z'],
    ['an empty string', ''],
    ['free text', 'around lunchtime'],
  ])('should throw for %s as a start time', (_label, infusionStartTime) => {
    expectRejected({ infusionStartTime });
  });

  test('should throw for an invalid stop time even when the start time is valid', () => {
    expectRejected({ infusionStartTime: '10:00', infusionStopTime: '99:99' });
  });
});

describe('save-chart-data - procedure extension round trip', () => {
  const extensionsOf = (procedure: ProcedureDTO): Record<string, unknown> => {
    const request = createProcedureServiceRequest(procedure, ENCOUNTER_ID, 'pat-1');
    const sr = request.resource as ServiceRequest;
    return Object.fromEntries(
      (sr.extension ?? []).map((extension) => [
        extension.url,
        extension.valueDecimal ?? extension.valueString ?? extension.valueBoolean,
      ])
    );
  };

  test('should write the structured fields as extensions once they pass validation', () => {
    const extensions = extensionsOf(
      validateProcedure({
        lengthCm: 3.5,
        repairDepth: 'subcutaneous-layered',
        infusionStartTime: '10:15',
        infusionStopTime: '11:00',
      })
    );
    expect(extensions[FHIR_EXTENSION.ServiceRequest.lengthCm.url]).toBe(3.5);
    expect(extensions[FHIR_EXTENSION.ServiceRequest.repairDepth.url]).toBe('subcutaneous-layered');
    expect(extensions[FHIR_EXTENSION.ServiceRequest.infusionStartTime.url]).toBe('10:15');
    expect(extensions[FHIR_EXTENSION.ServiceRequest.infusionStopTime.url]).toBe('11:00');
  });

  test('should keep an invalid value out of the written extensions', () => {
    const hostile = {
      lengthCm: -5,
      repairDepth: '<script>',
      infusionStartTime: '99:99',
      infusionStopTime: '24:00',
    };
    expectRejected(hostile);

    const unvalidated = extensionsOf(hostile as unknown as ProcedureDTO);
    expect(unvalidated[FHIR_EXTENSION.ServiceRequest.lengthCm.url]).toBe(-5);
    expect(unvalidated[FHIR_EXTENSION.ServiceRequest.infusionStartTime.url]).toBe('99:99');
  });
});
