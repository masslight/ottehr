import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import {
  getSecret,
  Secrets,
  SecretsKeys,
  UpdateProcedureQuickPickInput,
  UpdateProcedureQuickPickResponse,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { activityDefinitionToQuickPick, quickPickToActivityDefinition } from '../admin-get-procedure-quick-picks';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'admin-update-procedure-quick-pick';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
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
  params: UpdateProcedureQuickPickInput & { secrets: Secrets }
): Promise<UpdateProcedureQuickPickResponse> => {
  const { quickPickId, quickPick } = params;

  console.log(`Updating procedure quick pick: ${quickPickId}`);

  const activityDefinition = quickPickToActivityDefinition(quickPick, quickPickId);

  const updated = await oystehr.fhir.update<ActivityDefinition>(activityDefinition);
  console.log(`Updated ActivityDefinition with id: ${updated.id}`);

  const updatedQuickPick = activityDefinitionToQuickPick(updated);

  return {
    message: `Successfully updated procedure quick pick: ${quickPick.name}`,
    quickPick: updatedQuickPick,
  };
};
