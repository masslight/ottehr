import { Condition, Encounter, FhirResource, ServiceRequest } from 'fhir/r4b';
import { ADDED_VIA_PROCEDURE_EXTENSION } from 'utils/lib/types/api/procedures.constants';
import { ADDED_VIA_LAB_ORDER_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { describe, expect, it } from 'vitest';
import { orphanedProcedureDiagnoses } from '../../src/ehr/save-chart-data/procedure-diagnoses';
import {
  createProcedureServiceRequest,
  makeDiagnosisConditionResource,
  makeDiagnosisDTO,
} from '../../src/shared/chart-data/index';

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'visit',
  status: 'in-progress',
  class: { code: 'AMB' },
  diagnosis: [
    { condition: { reference: 'Condition/first' }, rank: 2 },
    { condition: { reference: 'Condition/second' }, rank: 3 },
  ],
};
const condition = (id = 'first', owned = true): Condition => ({
  resourceType: 'Condition',
  id,
  subject: { reference: 'Patient/patient' },
  encounter: { reference: 'Encounter/visit' },
  extension: owned ? [{ url: ADDED_VIA_PROCEDURE_EXTENSION, valueBoolean: true }] : undefined,
});
const procedure = (id: string, references = ['first']): ServiceRequest =>
  createProcedureServiceRequest(
    {
      resourceId: id,
      diagnoses: references.map((resourceId) => ({ resourceId, code: 'J06.9', display: 'URI', isPrimary: false })),
    },
    'visit',
    'patient'
  ).resource;
const remove = (extra: FhirResource[] = [], original = condition(), current = encounter): Condition[] =>
  orphanedProcedureDiagnoses(
    current,
    [original, procedure('procedure'), ...extra],
    [{ resourceId: 'procedure', diagnoses: [] }]
  );

describe('procedure diagnosis lifecycle', () => {
  it('round-trips procedure origin without changing existing diagnosis DTOs', () => {
    const diagnosis = {
      code: 'J06.9',
      display: 'URI',
      isPrimary: false,
      addedViaProcedure: true,
      addedViaLabOrder: true,
    };
    const resource = makeDiagnosisConditionResource('visit', 'patient', diagnosis, 'diagnosis');
    expect(resource.extension).toEqual(
      expect.arrayContaining([
        { url: ADDED_VIA_PROCEDURE_EXTENSION, valueBoolean: true },
        { url: ADDED_VIA_LAB_ORDER_SYSTEM, valueBoolean: true },
      ])
    );
    expect(makeDiagnosisDTO(resource, false)).toMatchObject(diagnosis);
    expect(makeDiagnosisDTO(condition('legacy', false), false)).not.toHaveProperty('addedViaProcedure');
  });
  it('removes a recorded procedure-origin diagnosis after its final procedure link is removed', () => {
    expect(remove().map((resource) => resource.id)).toEqual(['first']);
  });
  it('preserves a linked visit diagnosis or unknown legacy origin', () => {
    expect(remove([], condition('first', false))).toEqual([]);
  });
  it('preserves primary diagnoses, lab-origin diagnoses and diagnoses from another visit', () => {
    expect(
      remove([], condition(), { ...encounter, diagnosis: [{ condition: { reference: 'Condition/first' }, rank: 1 }] })
    ).toEqual([]);
    const lab = condition();
    lab.extension?.push({ url: ADDED_VIA_LAB_ORDER_SYSTEM, valueBoolean: true });
    expect(remove([], lab)).toEqual([]);
    expect(remove([], { ...condition(), encounter: { reference: 'Encounter/other' } })).toEqual([]);
  });
  it('preserves diagnoses still linked to another procedure or a new procedure in the same request', () => {
    expect(remove([procedure('other')])).toEqual([]);
    expect(
      orphanedProcedureDiagnoses(
        encounter,
        [condition(), procedure('procedure')],
        [
          { resourceId: 'procedure', diagnoses: [] },
          { diagnoses: [{ resourceId: 'first', code: 'J06.9', display: 'URI', isPrimary: false }] },
        ]
      )
    ).toEqual([]);
  });
  it('protects order references, including nested absolute and versioned references', () => {
    expect(
      remove([
        {
          resourceType: 'MedicationRequest',
          id: 'med',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/patient' },
          medicationCodeableConcept: { text: 'Medication' },
          reasonReference: [{ reference: 'https://example.org/fhir/Condition/first/_history/1' }],
        },
      ])
    ).toEqual([]);
    expect(
      remove([
        { ...procedure('lab', []), extension: [{ url: 'reason', valueReference: { reference: 'Condition/first' } }] },
      ])
    ).toEqual([]);
  });
  it('preserves a diagnosis used as another Encounter reason even after the procedure link is removed', () => {
    expect(remove([], condition(), { ...encounter, reasonReference: [{ reference: 'Condition/first' }] })).toEqual([]);
  });
  it('removes both diagnoses only when both final links are removed', () => {
    expect(
      orphanedProcedureDiagnoses(
        encounter,
        [condition(), condition('second'), procedure('procedure', ['first', 'second'])],
        [{ resourceId: 'procedure', diagnoses: [] }]
      ).map((resource) => resource.id)
    ).toEqual(['first', 'second']);
  });
  it('does not clean up diagnoses when saving unrelated chart fields or retaining the link', () => {
    expect(orphanedProcedureDiagnoses(encounter, [condition(), procedure('procedure')], [])).toEqual([]);
    expect(
      orphanedProcedureDiagnoses(
        encounter,
        [condition(), procedure('procedure')],
        [
          {
            resourceId: 'procedure',
            diagnoses: [{ resourceId: 'first', code: 'J06.9', display: 'URI', isPrimary: false }],
          },
        ]
      )
    ).toEqual([]);
  });
});
