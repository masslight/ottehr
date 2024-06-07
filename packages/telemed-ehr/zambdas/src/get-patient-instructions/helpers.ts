import { FhirClient } from '@zapehr/sdk';
import { InstructionType } from 'ehr-utils';
import { Communication } from 'fhir/r4';

export async function getCommunicationResources(
  fhirClient: FhirClient,
  type: InstructionType,
  ownerId: string
): Promise<Communication[]> {
  return await fhirClient.searchResources<Communication>({
    resourceType: 'Communication',
    searchParams: [
      {
        name: 'sender',
        value: (type === 'provider' ? 'Practitioner/' : 'Organization/') + ownerId,
      },
    ],
  });
}
