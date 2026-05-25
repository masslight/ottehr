import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { Secrets, UpdateProcedureQuickPickInput, UpdateProcedureQuickPickResponse } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { PROCEDURE_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { activityDefinitionToQuickPick, quickPickToActivityDefinition } from '../shared/quick-pick-helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'admin-update-procedure-quick-pick';

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
  params: UpdateProcedureQuickPickInput & { secrets: Secrets }
): Promise<UpdateProcedureQuickPickResponse> => {
  const { quickPickId, quickPick } = params;

  console.log(`Updating procedure quick pick: ${quickPickId}`);

  const activityDefinition = quickPickToActivityDefinition(quickPick, PROCEDURE_QUICK_PICK_CATEGORY, quickPickId);

  const updated = await oystehr.fhir.update<ActivityDefinition>(activityDefinition);
  console.log(`Updated ActivityDefinition with id: ${updated.id}`);

  const updatedQuickPick = activityDefinitionToQuickPick(updated, PROCEDURE_QUICK_PICK_CATEGORY);

  return {
    message: `Successfully updated procedure quick pick: ${quickPick.name}`,
    quickPick: updatedQuickPick,
  };
};
