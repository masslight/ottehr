import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, MedicationAdministration } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createReference,
  CreateUpdateImmunizationOrderInput,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  PRACTITIONER_ORDERED_MEDICATION_CODE,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { IMMUNIZATION_ORDER_CREATED_DATE_EXTENSION_URL, updateOrderDetails, validateOrderDetails } from '../common';

let m2mToken: string;

const ZAMBDA_NAME = 'create-update-immunization-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const oystehrCurrentUser = createOystehrClient(userToken, validatedParameters.secrets);
    const userPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    let response;
    if (validatedParameters.orderId) {
      response = await updateImmunizationOrder(oystehr, validatedParameters);
    } else {
      response = await createImmunizationOrder(oystehr, validatedParameters, userPractitionerId);
    }
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', error);
    console.log('Stringified error: ', JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error creating order: ${JSON.stringify(error)}` }),
    };
  }
});

async function createImmunizationOrder(
  oystehr: Oystehr,
  input: CreateUpdateImmunizationOrderInput,
  userPractitionerId: string
): Promise<any> {
  const { encounterId, orderDetails } = input;
  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterId,
  });
  if (!encounter.subject) {
    throw new Error(`Encounter ${encounter.id} has no subject`);
  }
  const medicationAdministration: MedicationAdministration = {
    resourceType: 'MedicationAdministration',
    subject: encounter.subject,
    context: createReference(encounter),
    status: 'in-progress',
    performer: [
      {
        actor: { reference: `Practitioner/${userPractitionerId}` },
        function: {
          coding: [
            {
              system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
              code: PRACTITIONER_ORDERED_MEDICATION_CODE,
            },
          ],
        },
      },
    ],
    effectiveDateTime: DateTime.now().toISO(),
    extension: [
      {
        url: IMMUNIZATION_ORDER_CREATED_DATE_EXTENSION_URL,
        valueDate: DateTime.now().toISO(),
      },
    ],
  };
  await updateOrderDetails(medicationAdministration, orderDetails, oystehr);
  const createdMedicationAdministration = await oystehr.fhir.create(medicationAdministration);
  return {
    message: 'Order was created',
    id: createdMedicationAdministration.id,
  };
}

async function updateImmunizationOrder(oystehr: Oystehr, input: CreateUpdateImmunizationOrderInput): Promise<any> {
  const { orderId, orderDetails } = input;
  const medicationAdministration = await oystehr.fhir.get<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    id: orderId!,
  });
  await updateOrderDetails(medicationAdministration, orderDetails, oystehr);
  await oystehr.fhir.update(medicationAdministration);
  return {
    id: medicationAdministration.id,
  };
}

export function validateRequestParameters(
  input: ZambdaInput
): CreateUpdateImmunizationOrderInput & Pick<ZambdaInput, 'secrets'> {
  const { orderId, encounterId, orderDetails } = validateJsonBody(input);

  const missingFields: string[] = [];
  if (!encounterId) missingFields.push('encounterId');
  missingFields.push(...validateOrderDetails(orderDetails));
  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    orderId,
    encounterId,
    orderDetails,
    secrets: input.secrets,
  };
}
