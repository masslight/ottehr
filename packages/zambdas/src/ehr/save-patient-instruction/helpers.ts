import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { PATIENT_INSTRUCTIONS_TEMPLATE_CODE } from 'utils';
import { fillMeta } from '../../shared/helpers';

export async function checkIfProvidersInstruction(
  communicationId: string,
  myUserProfile: string,
  oystehr: Oystehr
): Promise<void> {
  const resource: Communication = await oystehr.fhir.get({
    resourceType: 'Communication',
    id: communicationId,
  });
  const communicationSender = resource.sender?.reference;
  if (communicationSender) {
    if (myUserProfile !== communicationSender) throw new Error('This resource belongs to another practitioner');
  }
}

export async function createCommunicationResource(
  text: string,
  practitionerProfile: string,
  oystehr: Oystehr
): Promise<Communication> {
  const communicationResource: Communication = {
    resourceType: 'Communication',
    status: 'completed',
    sender: { reference: practitionerProfile },
    payload: [
      {
        contentString: text,
      },
    ],
    meta: fillMeta(PATIENT_INSTRUCTIONS_TEMPLATE_CODE, PATIENT_INSTRUCTIONS_TEMPLATE_CODE),
  };
  return await oystehr.fhir.create(communicationResource);
}

export async function updateCommunicationResource(
  communicationId: string,
  text: string,
  oystehr: Oystehr
): Promise<Communication> {
  return await oystehr.fhir.patch<Communication>({
    id: communicationId,
    resourceType: 'Communication',
    operations: [
      {
        op: 'replace',
        path: '/payload/0/contentString',
        value: text,
      },
    ],
  });
}
