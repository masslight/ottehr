import Oystehr from '@oystehr/sdk';
import { AuditEvent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';

export enum AuditableZambdaEndpoints {
  appointmentCancel = 'cancel-appointment',
  appointmentCheckIn = 'check-in',
  appointmentCreate = 'create-appointment',
  appointmentUpdate = 'update-appointment',
  paperworkUpdate = 'update-paperwork',
  submitPaperwork = 'submit-paperwork',
}

function getEventAction(endpoint: AuditableZambdaEndpoints): 'C' | 'U' {
  switch (endpoint) {
    case AuditableZambdaEndpoints.appointmentCancel:
    case AuditableZambdaEndpoints.appointmentCheckIn:
    case AuditableZambdaEndpoints.appointmentUpdate:
    case AuditableZambdaEndpoints.paperworkUpdate:
    case AuditableZambdaEndpoints.submitPaperwork:
      return 'U'; // update
    case AuditableZambdaEndpoints.appointmentCreate:
      return 'C'; // create
  }
}

export async function createAuditEvent(
  endpointName: AuditableZambdaEndpoints,
  oystehr: Oystehr,
  input: ZambdaInput,
  patientID: string,
  secrets: Secrets | null
): Promise<void> {
  const ORGANIZATION_ID = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

  console.log('creating audit event');
  const event = await oystehr.fhir.create<AuditEvent>({
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
    recorded: DateTime.now().toString(),
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
            valueString: JSON.stringify(input),
          },
        ],
      },
    ],
  });

  console.log('created audit event with id', event.id);
}
