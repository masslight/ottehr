import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Medication, MedicationAdministration } from 'fhir/r4b';
import {
  CreateImmunizationOrderInput,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  PRACTITIONER_ORDERED_MEDICATION_CODE,
  searchMedicationLocation,
  searchRouteByCode,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createMedicationCopy } from '../create-update-medication-order/helpers';

let m2mToken: string;

const ZAMBDA_NAME = 'create-immunization-order';
const CONTAINED_MEDICATION_ID = 'medicationId';

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
  const { encounterId, medicationId, dose, units, orderedProviderId, route, location, instructions } = input;
  const routeCoding = route ? searchRouteByCode(route) : undefined;
  const locationCoding = location ? searchMedicationLocation(location) : undefined;
  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterId,
  });
  if (!encounter.subject) {
    throw new Error(`Encounter ${encounterId} has no subject`);
  }
  const medication = await oystehr.fhir.get<Medication>({
    resourceType: 'Medication',
    id: medicationId,
  });
  const medicationLocalCopy = createMedicationCopy(medication, {});
  const medicationAdministration = await oystehr.fhir.create<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    subject: encounter.subject,
    medicationReference: { reference: `#${CONTAINED_MEDICATION_ID}` },
    context: { reference: `Encounter/${encounterId}` },
    status: 'in-progress',
    dosage: {
      dose: {
        unit: units,
        value: dose,
        system: MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
      },
      route: routeCoding
        ? {
            coding: [
              {
                code: routeCoding.code,
                system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
                display: routeCoding.display,
              },
            ],
          }
        : undefined,
      site: locationCoding
        ? {
            coding: [
              {
                system: locationCoding.system,
                code: locationCoding.code,
                display: locationCoding.display,
              },
            ],
          }
        : undefined,
      text: instructions,
    },
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
      {
        actor: { reference: `Practitioner/${orderedProviderId}` },
        function: {
          coding: [
            {
              system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
              code: PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
            },
          ],
        },
      },
    ],
    contained: [
      {
        ...medicationLocalCopy,
        id: CONTAINED_MEDICATION_ID,
      },
    ],
  });
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
