import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import { getVaccines, validateRequestParameters } from '../../src/ehr/immunization/get-vaccines';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const vaccine = (id: string, name?: string, cvx = '115'): Medication => ({
  resourceType: 'Medication',
  id,
  identifier: [
    { system: 'some-other-system', value: INVENTORY_VACCINE_TYPE_CODE },
    ...(name ? [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name }] : []),
  ],
  ...(cvx ? { code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: cvx }] } } : {}),
});

const mockOystehr = (medications: Medication[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
  const search = vi.fn().mockResolvedValue({ unbundle: () => medications });
  return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
};

describe('get-vaccines', () => {
  it('searches the switched-on catalog vaccines with a fixed query the request cannot change', async () => {
    const { oystehr, search } = mockOystehr([]);

    await getVaccines(oystehr);

    expect(search).toHaveBeenCalledWith({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: INVENTORY_VACCINE_TYPE_CODE },
        { name: 'status', value: 'active' },
      ],
    });
  });

  it('returns id, name and CVX, sorted by name, leaving out medications without a name, id or CVX', async () => {
    const { oystehr } = mockOystehr([
      vaccine('med-tdap', 'Tdap'),
      vaccine('med-no-name'),
      { ...vaccine('ignored', 'Hep B'), id: undefined },
      // one of the 26 config vaccines that predate the catalog: a name, no CVX
      vaccine('med-old-config', 'DTaP (Infanrix/Daptacel)', ''),
      vaccine('med-dtap', 'DTaP', '20'),
      vaccine('med-dtap-2', 'DTaP', '106'),
    ]);

    const response = await getVaccines(oystehr);

    expect(response).toEqual({
      vaccines: [
        { id: 'med-dtap', name: 'DTaP', cvx: '20' },
        { id: 'med-dtap-2', name: 'DTaP', cvx: '106' },
        { id: 'med-tdap', name: 'Tdap', cvx: '115' },
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
