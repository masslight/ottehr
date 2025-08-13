import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, MedicationAdministration } from 'fhir/r4b';
import {
  CreateImmunizationOrderInput,
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
import { updateOrderDetails } from '../common';

let m2mToken: string;

const ZAMBDA_NAME = 'create-immunization-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const oystehrCurrentUser = createOystehrClient(userToken, validatedParameters.secrets);
    const userPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    const response = await createImmunizationOrder(oystehr, validatedParameters, userPractitionerId);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', error);
    console.log('Stringified error: ', JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error creating/updating order: ${JSON.stringify(error)}` }),
    };
  }
});

async function createImmunizationOrder(
  oystehr: Oystehr,
  input: CreateImmunizationOrderInput,
  userPractitionerId: string
): Promise<any> {
  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: input.encounterId,
  });
  if (!encounter.subject) {
    throw new Error(`Encounter ${encounter.id} has no subject`);
  }
  const medicationAdministration = await oystehr.fhir.create<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    subject: encounter.subject,
    context: { reference: `Encounter/${encounter.id}` },
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
  });
  await updateOrderDetails(medicationAdministration, input, oystehr);
  return {
    id: medicationAdministration.id,
  };
}

export function validateRequestParameters(
  input: ZambdaInput
): CreateImmunizationOrderInput & Pick<ZambdaInput, 'secrets'> {
  const { encounterId, medicationId, dose, units, route, location, instructions, orderedProviderId } =
    validateJsonBody(input);

  const missingFields: string[] = [];
  if (!encounterId) missingFields.push('encounterId');
  if (!medicationId) missingFields.push('medicationId');
  if (!dose) missingFields.push('dose');
  if (!units) missingFields.push('units');
  if (!orderedProviderId) missingFields.push('orderedProviderId');
  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    encounterId,
    medicationId,
    dose,
    units,
    route,
    location,
    instructions,
    orderedProviderId,
    secrets: input.secrets,
  };
}
