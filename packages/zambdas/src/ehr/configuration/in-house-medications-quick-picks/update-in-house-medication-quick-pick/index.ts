import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { ActivityDefinition } from 'fhir/r4b';
import { getSecret, INVALID_INPUT_ERROR, SecretsKeys, UpdateInHouseMedicationQuickPickInput } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-update-in-house-medication-quick-pick',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { quickPickID, status, name, secrets } = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

      const oystehr = createOystehrClient(m2mToken, secrets);
      console.log('Created Oystehr client');

      const response = await performEffect(oystehr, { quickPickID, name, status });
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-update-in-house-medication-quick-pick', error, ENVIRONMENT);
    }
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  updateDetail: UpdateInHouseMedicationQuickPickInput
): Promise<ActivityDefinition> => {
  const { quickPickID, name, status } = updateDetail;
  const quickPick = await oystehr.fhir.get<ActivityDefinition>({
    resourceType: 'ActivityDefinition',
    id: quickPickID,
  });
  if (!quickPick) {
    throw new Error(`Quick Pick ID ${quickPickID} not found`);
  }

  const patchOperations: Operation[] = [];

  const quickPickName = quickPick.title;
  if (name !== undefined && name !== quickPickName) {
    const quickPickWithName = await getQuickPickWithName(oystehr, name);
    if (quickPickWithName) {
      throw INVALID_INPUT_ERROR(`Quick Pick with name ${name} already exists.`);
    }
    patchOperations.push({
      op: 'replace',
      path: `/title`,
      value: name,
    });
  }

  const quickPickStatus = quickPick.status;

  if (status !== undefined && status !== quickPickStatus) {
    patchOperations.push({
      op: quickPick.status ? 'replace' : 'add',
      path: '/status',
      value: status === 'inactive' ? 'draft' : status,
    });
  }

  if (patchOperations.length > 0) {
    return await oystehr.fhir.patch<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: quickPickID,
      operations: patchOperations,
    });
  }
  return quickPick;
};

export async function getQuickPickWithName(oystehr: Oystehr, name: string): Promise<ActivityDefinition | undefined> {
  const quickPickSearch = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        {
          name: 'title',
          value: name,
        },
      ],
    })
  ).unbundle();
  const quickPickTitle = quickPickSearch.find((temp) => temp.title === name);
  return quickPickTitle;
}
