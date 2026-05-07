import { APIGatewayProxyResult } from 'aws-lambda';
import { PlanDefinition } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  buildPlanDefinitionFromActions,
  getOrCreateOutreachConfig,
  parsePlanDefinitionToActions,
  parseSmsTimeRestriction,
} from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'save-scheduled-outreach-config',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const validated = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validated.secrets);
    const oystehr = createOystehrClient(m2mToken, validated.secrets);

    // Get or create the singleton PlanDefinition
    const existing = await getOrCreateOutreachConfig(oystehr);

    // Build and update the PlanDefinition from the submitted actions
    const updated: PlanDefinition = {
      ...buildPlanDefinitionFromActions(validated.actions, validated.smsTimeRestriction),
      id: existing.id,
    };

    const saved = await oystehr.fhir.update<PlanDefinition>(updated);
    const actions = parsePlanDefinitionToActions(saved);
    const smsTimeRestriction = parseSmsTimeRestriction(saved);

    return {
      statusCode: 200,
      body: JSON.stringify({ planDefinition: saved, actions, smsTimeRestriction }),
    };
  }
);
