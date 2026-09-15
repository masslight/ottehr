import { MedicationStatement } from 'fhir/r4b';
import { MedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { MEDICATION_DISPENSABLE_DRUG_ID } from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it } from 'vitest';
import { makeMedicationDTO, makeMedicationResource } from '../../src/shared/chart-data';

/**
 * A medication entered from a name alone — the ambient scribe reads one out of a transcript, and
 * the eRx catalog search can come back without an id — has no dispensable drug id to carry.
 */

const build = (data: Partial<MedicationDTO>): MedicationStatement =>
  makeMedicationResource(
    'encounter-1',
    'patient-1',
    'practitioner-1',
    {
      name: 'Ibuprofen',
      status: 'active',
      type: 'as-needed',
      intakeInfo: {},
      ...data,
    } as MedicationDTO,
    'current-medication'
  );

describe('makeMedicationResource', () => {
  it('carries the dispensable drug id when there is one', () => {
    const resource = build({ id: '12345' });

    expect(resource.identifier).toEqual([{ value: '12345' }]);
    expect(resource.medicationCodeableConcept?.coding).toEqual([
      { system: MEDICATION_DISPENSABLE_DRUG_ID, code: '12345', display: 'Ibuprofen' },
    ]);
  });

  it('leaves out the identifier and the coding system when there is no id', () => {
    const resource = build({ id: undefined });

    // An identifier with nothing in it is not a valid FHIR element: the whole write is rejected.
    expect(JSON.parse(JSON.stringify(resource))).not.toHaveProperty('identifier');
    // Nor should the resource claim a coding system it has no code for.
    expect(resource.medicationCodeableConcept?.coding).toEqual([{ display: 'Ibuprofen' }]);
  });

  it('round-trips a medication that has no id', () => {
    const dto = makeMedicationDTO(build({ id: undefined, name: 'Claritin (loratadine)' }));

    expect(dto.name).toBe('Claritin (loratadine)');
    expect(dto.id).toBe('');
    expect(dto.status).toBe('active');
    expect(dto.type).toBe('as-needed');
  });
});
