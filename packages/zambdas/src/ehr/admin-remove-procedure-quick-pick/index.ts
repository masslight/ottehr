import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import {
  getSecret,
  RemoveProcedureQuickPickInput,
  RemoveProcedureQuickPickResponse,
  Secrets,
  SecretsKeys,
} from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'admin-remove-procedure-quick-pick';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    const oystehr = createOystehrClient(input.accessToken!, validatedParameters.secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, validatedParameters);
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

export const performEffect = async (
  oystehr: Oystehr,
  params: RemoveProcedureQuickPickInput & { secrets: Secrets }
): Promise<RemoveProcedureQuickPickResponse> => {
  const { quickPickId } = params;

  console.log(`Removing procedure quick pick: ${quickPickId}`);

  // Read the existing resource first
  const existing = await oystehr.fhir.get<ActivityDefinition>({
    resourceType: 'ActivityDefinition',
    id: quickPickId,
  });

  if (!existing) {
    throw new Error(`ActivityDefinition with id ${quickPickId} not found`);
  }

  // Set status to retired instead of deleting
  existing.status = 'retired';

  await oystehr.fhir.update(existing);
  console.log(`Set ActivityDefinition ${quickPickId} status to retired`);

  return {
    message: `Successfully removed procedure quick pick`,
  };
};
