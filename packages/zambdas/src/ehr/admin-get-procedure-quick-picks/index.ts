import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { GetProcedureQuickPicksResponse, getSecret, ProcedureQuickPickData, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'admin-get-procedure-quick-picks';
export const PROCEDURE_QUICK_PICK_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/quick-pick-category';
export const PROCEDURE_QUICK_PICK_TAG_CODE = 'procedure-quick-pick';
export const PROCEDURE_QUICK_PICK_CONFIG_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/quick-pick-config';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Stringified error: ' + JSON.stringify(error));
    console.error('Error: ' + error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

export function activityDefinitionToQuickPick(ad: ActivityDefinition): ProcedureQuickPickData {
  const configExtension = ad.extension?.find((ext) => ext.url === PROCEDURE_QUICK_PICK_CONFIG_EXTENSION_URL);
  if (!configExtension?.valueString) {
    throw new Error(`ActivityDefinition ${ad.id} is missing quick pick config extension`);
  }
  const config = JSON.parse(configExtension.valueString) as Omit<ProcedureQuickPickData, 'id' | 'name'>;
  return {
    id: ad.id,
    name: ad.title ?? ad.name ?? '',
    ...config,
  };
}

export function quickPickToActivityDefinition(
  quickPick: Omit<ProcedureQuickPickData, 'id'>,
  existingId?: string
): ActivityDefinition {
  const { name, ...configData } = quickPick;

  const ad: ActivityDefinition = {
    resourceType: 'ActivityDefinition',
    status: 'active',
    name: name.replace(/[^a-zA-Z0-9]/g, '_'),
    title: name,
    meta: {
      tag: [
        {
          system: PROCEDURE_QUICK_PICK_TAG_SYSTEM,
          code: PROCEDURE_QUICK_PICK_TAG_CODE,
        },
      ],
    },
    extension: [
      {
        url: PROCEDURE_QUICK_PICK_CONFIG_EXTENSION_URL,
        valueString: JSON.stringify(configData),
      },
    ],
  };

  if (existingId) {
    ad.id = existingId;
  }

  return ad;
}

export const performEffect = async (oystehr: Oystehr): Promise<GetProcedureQuickPicksResponse> => {
  console.log('Searching for procedure quick pick ActivityDefinitions');

  const activityDefinitions = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: `${PROCEDURE_QUICK_PICK_TAG_SYSTEM}|${PROCEDURE_QUICK_PICK_TAG_CODE}` },
        { name: 'status', value: 'active' },
      ],
    })
  ).unbundle();

  console.log(`Found ${activityDefinitions.length} procedure quick pick ActivityDefinitions`);

  const quickPicks = activityDefinitions.map((ad) => activityDefinitionToQuickPick(ad));

  return {
    message: `Found ${quickPicks.length} procedure quick picks`,
    quickPicks,
  };
};
