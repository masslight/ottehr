import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { InstructionType } from 'utils/lib/types/api/patient-instructions/patient-instructions.types';
import { PATIENT_INSTRUCTIONS_TEMPLATE_CODE } from 'utils/lib/types/api/chart-data/chart-data.types';

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
