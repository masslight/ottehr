import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { CreateProcedureQuickPickInput, CreateProcedureQuickPickResponse, Secrets } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { activityDefinitionToQuickPick, quickPickToActivityDefinition } from '../admin-get-procedure-quick-picks';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'admin-create-procedure-quick-pick';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

  const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
  console.log('Created Oystehr client');

  const response = await performEffect(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export const performEffect = async (
  oystehr: Oystehr,
  params: CreateProcedureQuickPickInput & { secrets: Secrets }
): Promise<CreateProcedureQuickPickResponse> => {
  const { quickPick } = params;

  console.log(`Creating procedure quick pick: ${quickPick.name}`);

  const activityDefinition = quickPickToActivityDefinition(quickPick);

  const created = await oystehr.fhir.create<ActivityDefinition>(activityDefinition);
  console.log(`Created ActivityDefinition with id: ${created.id}`);

  const createdQuickPick = activityDefinitionToQuickPick(created);

  return {
    message: `Successfully created procedure quick pick: ${quickPick.name}`,
    quickPick: createdQuickPick,
  };
};
