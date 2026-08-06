import Oystehr from '@oystehr/sdk';
import { ValueSet } from 'fhir/r4b';
import { EmCodeOption } from '../types/api/config/em-codes';
import { EM_CODES_VALUE_SET_URL } from '../types/api/em-codes.constants';
import { FHIR_RESOURCE_NOT_FOUND } from '../types/errors';

export async function getEmCodesFhirResources(oystehr: Oystehr): Promise<{ valueSet: ValueSet & { id: string } }> {
  const searchResult = (
    await oystehr.fhir.search<ValueSet>({
      resourceType: 'ValueSet',
      params: [{ name: 'url', value: EM_CODES_VALUE_SET_URL }],
    })
  ).unbundle();

  const valueSet = searchResult.find((vs) => vs.url === EM_CODES_VALUE_SET_URL);
  if (!valueSet?.id) throw FHIR_RESOURCE_NOT_FOUND;

  return {
    valueSet: valueSet as ValueSet & { id: string },
  };
}

export async function getEmCodes(oystehr: Oystehr): Promise<EmCodeOption[]> {
  const { valueSet } = await getEmCodesFhirResources(oystehr);

  return (valueSet.expansion?.contains ?? [])
    .filter((entry): entry is typeof entry & { code: string; display: string } => !!entry.code && !!entry.display)
    .map((entry) => ({ code: entry.code, display: entry.display }));
}
