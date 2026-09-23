import { CPT_BILLABLE_UNITS_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { CODE_SYSTEM_CPT_MODIFIER, EXTENSION_URL_CPT_MODIFIER } from 'utils/lib/helpers/rcm/constants';
import { describe, expect, it } from 'vitest';
import {
  createProcedureServiceRequest,
  makeCPTCodeDTO,
  makeProcedureResource,
  readProcedureFormFieldsFromServiceRequest,
} from '../../src/shared/chart-data/index';

describe('CPT Procedure billable units', () => {
  it('round-trips billable units and modifiers through Procedure coding extensions', () => {
    const resource = makeProcedureResource(
      'encounter-id',
      'patient-id',
      {
        code: '13133',
        display: 'Each additional 5 cm',
        modifier: [{ code: '59', display: 'Distinct procedural service' }],
        billableUnits: 2,
      },
      'cpt-code'
    );

    expect(resource.code?.coding?.[0].extension).toContainEqual({
      url: CPT_BILLABLE_UNITS_EXTENSION_URL,
      valueDecimal: 2,
    });
    expect(resource.code?.coding?.[0].extension).toContainEqual({
      url: EXTENSION_URL_CPT_MODIFIER,
      valueCodeableConcept: {
        coding: [
          {
            system: CODE_SYSTEM_CPT_MODIFIER,
            code: '59',
            display: 'Distinct procedural service',
          },
        ],
      },
    });

    expect(makeCPTCodeDTO(resource)).toMatchObject({
      code: '13133',
      modifier: [{ code: '59', display: 'Distinct procedural service' }],
      billableUnits: 2,
    });
  });
});

describe('structured procedure documentation', () => {
  it('preserves incomplete rows, explicit false/zero and future fields through FHIR', () => {
    const structuredFacts = {
      wounds: [{ site: 'trunk', length: 3.5 }, { closure: 'layered' }],
      count: 0,
      confirmed: false,
      futureField: 'retained',
    };
    const request = createProcedureServiceRequest(
      { procedureType: 'Laceration Repair (Wound Closure)', structuredFacts },
      'encounter-id',
      'patient-id'
    );
    expect(readProcedureFormFieldsFromServiceRequest(request.resource).structuredFacts).toEqual(structuredFacts);
  });
});
