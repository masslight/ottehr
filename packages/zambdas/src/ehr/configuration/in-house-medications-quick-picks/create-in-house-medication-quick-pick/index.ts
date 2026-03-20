import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition, Medication } from 'fhir/r4b';
import {
  getSecret,
  IN_HOUSE_MEDICATION_QUICK_PICK_CODE,
  IN_HOUSE_MEDICATION_QUICK_PICK_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  QUICK_PICK_NAME_EXISTS_ERROR,
  searchRouteByCode,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { getQuickPickWithName } from '../update-in-house-medication-quick-pick';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-create-in-house-medication-quick-pick',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { name, medicationID, dose, units, route, instructions, secrets } = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

      const oystehr = createOystehrClient(m2mToken, secrets);
      console.log('Created Oystehr client');

      const response = await performEffect(oystehr, name, medicationID, dose, units, route, instructions);
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-create-in-house-medication-quick-pick', error, ENVIRONMENT);
    }
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  name: string,
  medicationID: string,
  dose: number,
  units: string,
  route: string,
  instructions?: string
): Promise<ActivityDefinition | undefined> => {
  const medication = await oystehr.fhir.get<Medication>({
    resourceType: 'Medication',
    id: medicationID,
  });
  if (!medication) {
    throw new Error('Medication not found');
  }

  const quickPickWithName = await getQuickPickWithName(oystehr, name);
  if (quickPickWithName) {
    throw QUICK_PICK_NAME_EXISTS_ERROR(`Quick Pick with name ${name} already exists.`);
  }

  const routeTemp = searchRouteByCode(route);

  return oystehr.fhir.create<ActivityDefinition>({
    resourceType: 'ActivityDefinition',
    meta: {
      tag: [
        {
          system: IN_HOUSE_MEDICATION_QUICK_PICK_SYSTEM,
          code: IN_HOUSE_MEDICATION_QUICK_PICK_CODE,
        },
      ],
    },
    title: name,
    status: 'active',
    productReference: {
      reference: `Medication/${medicationID}`,
    },
    dosage: [
      {
        patientInstruction: instructions,
        route: {
          coding: [
            {
              code: route,
              system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
              display: routeTemp?.display,
            },
          ],
        },
        doseAndRate: [
          {
            doseQuantity: {
              value: dose,
              unit: units,
              system: MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
            },
          },
        ],
      },
    ],
  });
};
