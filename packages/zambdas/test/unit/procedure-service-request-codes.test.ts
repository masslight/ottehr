import { ServiceRequest } from 'fhir/r4b';
import { BODY_SITE_SYSTEM, PERFORMER_TYPE_SYSTEM, PROCEDURE_TYPE_SYSTEM } from 'utils/lib/fhir/constants';
import { ProcedureDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, test } from 'vitest';
import { createProcedureServiceRequest } from '../../src/shared/chart-data';

const buildServiceRequest = (procedure: ProcedureDTO): ServiceRequest =>
  createProcedureServiceRequest(procedure, 'enc-1', 'pat-1').resource as ServiceRequest;

describe('createProcedureServiceRequest code sanitization', () => {
  test('collapses repeated and surrounding whitespace in free-text codes', () => {
    const sr = buildServiceRequest({
      procedureType: ' Laceration  repair ',
      performerType: 'Healthcare  staff',
      bodySite: 'Left  forearm ',
    });

    expect(sr.category?.[0]?.coding?.[0]).toEqual({
      system: PROCEDURE_TYPE_SYSTEM,
      code: 'Laceration repair',
    });
    expect(sr.performerType?.coding?.[0]).toEqual({
      system: PERFORMER_TYPE_SYSTEM,
      code: 'Healthcare staff',
    });
    expect(sr.bodySite?.[0]?.coding?.[0]).toEqual({ system: BODY_SITE_SYSTEM, code: 'Left forearm' });
  });

  test('omits the element entirely when the value is blank or whitespace-only', () => {
    const sr = buildServiceRequest({ procedureType: '', performerType: '   ', bodySite: '' });

    expect(sr.category).toBeUndefined();
    expect(sr.performerType).toBeUndefined();
    expect(sr.bodySite).toBeUndefined();
  });

  // FHIR invariant ext-1: an extension carries either a value or nested extensions. An extension
  // holding an empty string reaches the server as neither, and every later PATCH of the resource —
  // cancelling the procedure, for one — fails whole-resource validation with a 400.
  test('omits extensions whose text is blank or whitespace-only', () => {
    const sr = buildServiceRequest({
      medicationUsed: '',
      bodySide: '   ',
      technique: ['', ' '],
      suppliesUsed: '',
      procedureDetails: '  ',
      complications: '',
      patientResponse: '',
      postInstructions: '',
      timeSpent: '',
      documentedBy: '',
      repairDepth: '',
      infusionStartTime: '',
      infusionStopTime: '',
    });

    expect(sr.extension).toBeUndefined();
  });

  test('keeps every emitted extension carrying a value', () => {
    const sr = buildServiceRequest({
      medicationUsed: 'lidocaine',
      procedureDetails: '',
      lengthCm: 3.2,
      specimenSent: false,
      documentedBy: 'Dr. House',
    });

    expect(sr.extension).toHaveLength(4);
    expect(
      sr.extension?.every(
        (extension) =>
          extension.valueString != null ||
          extension.valueBoolean != null ||
          extension.valueDecimal != null ||
          extension.extension != null
      )
    ).toBe(true);
  });

  test('leaves already-valid codes untouched', () => {
    const sr = buildServiceRequest({
      procedureType: 'splint-application',
      performerType: 'Provider',
      bodySite: 'Left arm',
    });

    expect(sr.category?.[0]?.coding?.[0]?.code).toBe('splint-application');
    expect(sr.performerType?.coding?.[0]?.code).toBe('Provider');
    expect(sr.bodySite?.[0]?.coding?.[0]?.code).toBe('Left arm');
  });
});
