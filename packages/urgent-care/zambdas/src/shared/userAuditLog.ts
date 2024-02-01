import { FhirClient } from '@zapehr/sdk';
import { AuditEvent } from 'fhir/r4';
import { DateTime } from 'luxon';
import { Secrets, SecretsKeys, getSecret, ZambdaInput } from 'utils';

export enum AuditableZambdaEndpoints {
  appointmentCancel = 'cancel-appointment',
  appointmentCheckIn = 'check-in',
  appointmentCreate = 'create-appointment',
  appointmentUpdate = 'update-appointment',
  paperworkUpdate = 'update-paperwork',
}

function getEventAction(endpoint: AuditableZambdaEndpoints): 'C' | 'U' {
  switch (endpoint) {
    case AuditableZambdaEndpoints.appointmentCancel:
    case AuditableZambdaEndpoints.appointmentCheckIn:
    case AuditableZambdaEndpoints.appointmentUpdate:
    case AuditableZambdaEndpoints.paperworkUpdate:
      return 'U'; // update
    case AuditableZambdaEndpoints.appointmentCreate:
      return 'C'; // create
  }
}

export async function createAuditEvent(
  endpointName: AuditableZambdaEndpoints,
  fhirClient: FhirClient,
  input: ZambdaInput,
  patientID: string,
  secrets: Secrets | null,
): Promise<void> {
  const ORGANIZATION_ID = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

  console.log('creating audit event');
  const event = await fhirClient.createResource<AuditEvent>({
    resourceType: 'AuditEvent',
    type: {
      system: 'http://hl7.org/fhir/ValueSet/audit-event-type',
      code: '110110',
    },
    action: getEventAction(endpointName),
    outcome: '0',
    agent: [
      {
        who: {
          reference: `Patient/${patientID}`,
        },
        requestor: true,
      },
    ],
    recorded: DateTime.now().setZone('UTC').toString(),
    source: {
      observer: {
        reference: `Organization/${ORGANIZATION_ID}`,
      },
    },
    entity: [
      {
        name: endpointName,
        detail: [
          {
            type: 'requestJson',
            valueString: JSON.stringify(input.body),
          },
        ],
      },
    ],
  });

  console.log('created audit event with id', event.id);
}
