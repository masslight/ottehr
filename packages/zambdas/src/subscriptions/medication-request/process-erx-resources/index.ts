import { APIGatewayProxyResult } from 'aws-lambda';
import { Identifier, MedicationRequest, MedicationStatement } from 'fhir/r4b';
import {
  ERX_MEDICATION_META_TAG_CODE,
  getSecret,
  MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  fillMeta,
  makeMedicationResource,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): {
  medicationRequest: MedicationRequest;
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const medicationRequest = JSON.parse(input.body);

  if (medicationRequest.resourceType !== 'MedicationRequest') {
    throw new Error(`resource parsed should be a medication request but was a ${medicationRequest.resourceType}`);
  }

  if (
    !medicationRequest.identifier?.find(
      (id: Identifier) => id.system === 'https://identifiers.fhir.oystehr.com/erx-prescription-id'
    )
  ) {
    throw new Error('MedicationRequest does not have an erx prescription id');
  }

  return {
    medicationRequest: medicationRequest as MedicationRequest,
    secrets: input.secrets,
  };
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'process-erx-resources';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const { medicationRequest, secrets } = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.log('Created zapToken and fhir client');

    console.log(`Medication request id: ${medicationRequest.id}`);

    const encounterReference = medicationRequest.encounter?.reference;
    const encounterId = encounterReference?.split('/')[1];
    const patientReference = medicationRequest.subject?.reference;
    const patientId = patientReference?.split('/')[1];
    const practitionerReference = medicationRequest.requester?.reference;
    const practitionerId = practitionerReference?.split('/')[1];

    console.log(`Encounter ref: ${encounterReference}`);
    console.log(`Patient ref: ${patientReference}`);

    const medData = medicationRequest.medicationCodeableConcept?.coding?.find(
      (coding) => coding.system === MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM
    );
    console.log('Patching MedicationRequest and create MedicationStatement');
    await Promise.all([
      oystehr.fhir.patch({
        resourceType: medicationRequest.resourceType,
        id: medicationRequest.id!,
        operations: [
          {
            op: 'add',
            path: '/meta',
            value: fillMeta(ERX_MEDICATION_META_TAG_CODE, ERX_MEDICATION_META_TAG_CODE),
          },
        ],
      }),
      encounterId &&
        patientId &&
        practitionerId &&
        oystehr.fhir.create<MedicationStatement>(
          makeMedicationResource(
            encounterId,
            patientId,
            practitionerId,
            {
              status: 'active',
              name: medData?.display || '',
              id: medData?.code,
              intakeInfo: {
                dose: medicationRequest.dispenseRequest?.quantity?.value
                  ? `${medicationRequest.dispenseRequest?.quantity?.value}${
                      ' ' + medicationRequest.dispenseRequest?.quantity?.unit || ''
                    }`
                  : undefined,
              },
              type: 'scheduled',
            },
            'prescribed-medication'
          )
        ),
    ]);

    return {
      statusCode: 200,
      body: `Successfully processed erx MedicationRequest ${medicationRequest.id}`,
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('Process ERX MedicationRequest error', error, ENVIRONMENT);
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
});
