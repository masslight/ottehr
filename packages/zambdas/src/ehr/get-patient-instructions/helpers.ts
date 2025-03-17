import Oystehr from '@oystehr/sdk';
import { InstructionType, PATIENT_INSTRUCTIONS_TEMPLATE_CODE } from 'utils';
import { Communication } from 'fhir/r4b';

export async function getCommunicationResources(
  oystehr: Oystehr,
  type: InstructionType,
  ownerId: string
): Promise<Communication[]> {
  return (
    await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        {
          name: 'sender',
          value: (type === 'provider' ? 'Practitioner/' : 'Organization/') + ownerId,
        },
        {
          name: '_tag',
          value: PATIENT_INSTRUCTIONS_TEMPLATE_CODE,
        },
      ],
    })
  ).unbundle();
}
