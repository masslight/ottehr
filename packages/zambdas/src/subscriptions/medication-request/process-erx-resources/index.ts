import { APIGatewayProxyResult } from 'aws-lambda';
import { Identifier, MedicationRequest, MedicationStatement } from 'fhir/r4b';
import {
  ERX_MEDICATION_META_TAG_CODE,
  FHIR_EXTENSION,
  getBooleanExtensionValue,
  MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM,
  Secrets,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  fillMeta,
  makeMedicationResource,
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

export function makeMedicationStatementFromErxMedicationRequest(
  medicationRequest: MedicationRequest,
  encounterId: string,
  patientId: string,
  practitionerId: string
): MedicationStatement {
  const medData = medicationRequest.medicationCodeableConcept?.coding?.find(
    (coding) => coding.system === MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM
  );

  return makeMedicationResource(
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
      isRenewal: getBooleanExtensionValue(medicationRequest, FHIR_EXTENSION.MedicationRequest.isRenewal.url),
    },
    'prescribed-medication'
  );
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'process-erx-resources';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
        makeMedicationStatementFromErxMedicationRequest(medicationRequest, encounterId, patientId, practitionerId)
      ),
  ]);

  return {
    statusCode: 200,
    body: `Successfully processed erx MedicationRequest ${medicationRequest.id}`,
  };
});
