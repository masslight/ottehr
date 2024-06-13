import { FhirClient } from '@zapehr/sdk';
import { Communication } from 'fhir/r4';
import { removePrefix } from '../shared/appointment/helpers';

export async function checkIfProvidersInstruction(
  communicationId: string,
  myPractitionerId: string,
  fhirClient: FhirClient,
): Promise<void> {
  const resource: Communication = await fhirClient.readResource({
    resourceType: 'Communication',
    resourceId: communicationId,
  });
  const communicationSender = resource.sender?.reference;
  if (communicationSender) {
    const referencePractitionerId = removePrefix('Practitioner/', communicationSender);
    if (myPractitionerId !== referencePractitionerId) throw new Error('This resource belongs to another practitioner');
  }
}

export async function createCommunicationResource(
  text: string,
  practitionerId: string,
  fhirClient: FhirClient,
): Promise<Communication> {
  const communicationResource: Communication = {
    resourceType: 'Communication',
    status: 'completed',
    sender: { reference: `Practitioner/${practitionerId}` },
    payload: [
      {
        contentString: text,
      },
    ],
  };
  return await fhirClient.createResource(communicationResource);
}

export async function updateCommunicationResource(
  communicationId: string,
  text: string,
  fhirClient: FhirClient,
): Promise<Communication> {
  return await fhirClient.patchResource<Communication>({
    resourceId: communicationId,
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
