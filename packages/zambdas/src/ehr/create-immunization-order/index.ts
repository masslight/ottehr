import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { MedicationAdministration } from 'fhir/r4b';
import {
  CreateImmunizationOrderInput,
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  searchMedicationLocation,
  searchRouteByCode,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'create-immunization-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const practitionerId = 'todo'; // await practitionerIdFromZambdaInput(input, validatedParameters.secrets);
    const response = await createImmunizationOrder(oystehr, validatedParameters, practitionerId);
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
  practitionerIdCalledZambda: string
): Promise<any> {
  const { encounterId, medicationId, dose, units, orderedProviderId, route, location, instructions } = input;
  console.log(practitionerIdCalledZambda, medicationId, orderedProviderId);
  const routeCoding = route ? searchRouteByCode(route) : undefined;
  const locationCoding = location ? searchMedicationLocation(location) : undefined;
  const medicationAdministration = await oystehr.fhir.create<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    subject: { reference: `Patient/` }, // todo
    medicationReference: { reference: `#${IN_HOUSE_CONTAINED_MEDICATION_ID}` },
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
