import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import {
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import { getVaccines, validateRequestParameters } from '../../src/ehr/immunization/get-vaccines';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const vaccine = (id: string, name?: string): Medication => ({
  resourceType: 'Medication',
  id,
  identifier: [
    { system: 'some-other-system', value: INVENTORY_VACCINE_TYPE_CODE },
    ...(name ? [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name }] : []),
  ],
});

const mockOystehr = (medications: Medication[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
  const search = vi.fn().mockResolvedValue({ unbundle: () => medications });
  return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
};

describe('get-vaccines', () => {
  it('searches the inventory vaccines with a fixed query the request cannot change', async () => {
    const { oystehr, search } = mockOystehr([]);

    await getVaccines(oystehr);

    expect(search).toHaveBeenCalledWith({
      resourceType: 'Medication',
      params: [{ name: 'identifier', value: INVENTORY_VACCINE_TYPE_CODE }],
    });
  });

  it('returns id and name only, sorted by name, leaving out medications without a name or id', async () => {
    const { oystehr } = mockOystehr([
      vaccine('med-tdap', 'Tdap'),
      vaccine('med-no-name'),
      { ...vaccine('ignored', 'Hep B'), id: undefined },
      vaccine('med-dtap', 'DTaP'),
      vaccine('med-dtap-2', 'DTaP'),
    ]);

    const response = await getVaccines(oystehr);

    expect(response).toEqual({
      vaccines: [
        { id: 'med-dtap', name: 'DTaP' },
        { id: 'med-dtap-2', name: 'DTaP' },
        { id: 'med-tdap', name: 'Tdap' },
      ],
    });
  });

  it('takes no parameters: the body is not read, the secrets are passed through', () => {
    const secrets = { PROJECT_API: 'https://project.api' } as any;

    expect(validateRequestParameters(createMockZambdaInput({ resourceType: 'Patient' }, { secrets }))).toEqual({
      secrets,
    });
    expect(validateRequestParameters(createMockZambdaInput(null, { secrets }))).toEqual({ secrets });
  });
});
