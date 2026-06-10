import { APIGatewayProxyResult } from 'aws-lambda';
import { PlanDefinition, Task } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { reconcileDraftTasksWithConfig } from '../../scheduled-outreach/producers/shared/produce-outreach-tasks';
import {
  buildPlanDefinitionFromActions,
  getOrCreateOutreachConfig,
  parseNotificationsTimeRestriction,
  parsePlanDefinitionToActions,
  preserveConfiguredAtExtension,
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

    // Parse old actions before overwriting so we can reconcile draft tasks
    const oldActions = parsePlanDefinitionToActions(existing);

    // Build the updated PlanDefinition from the submitted actions
    const updatedPlanDef: PlanDefinition = {
      ...buildPlanDefinitionFromActions(validated.actions, validated.notificationsTimeRestriction),
      id: existing.id,
    };
    // Preserve the immutable activation timestamp across edits (stamps one now for legacy configs).
    updatedPlanDef.extension = preserveConfiguredAtExtension(updatedPlanDef.extension, existing);

    // Parse new actions from the built PlanDefinition to get stable IDs
    const newActions = parsePlanDefinitionToActions(updatedPlanDef);

    // Build task reconciliation requests (cancel removed, update modified)
    const reconcileResult = await reconcileDraftTasksWithConfig(oystehr, oldActions, newActions);

    if (reconcileResult.requests.length > 0) {
      // Execute PlanDefinition update + task patches in a single FHIR transaction
      await oystehr.fhir.transaction<PlanDefinition | Task>({
        requests: [
          {
            method: 'PUT',
            url: `/PlanDefinition/${existing.id}`,
            resource: updatedPlanDef,
          },
          ...reconcileResult.requests,
        ],
      });
      console.log(
        `save-scheduled-outreach-config: atomic transaction — ` +
          `PlanDefinition updated, cancelled=${reconcileResult.cancelled}, updated=${reconcileResult.updated}`
      );
    } else {
      // No task changes, just update the PlanDefinition
      await oystehr.fhir.update<PlanDefinition>(updatedPlanDef);
      console.log('save-scheduled-outreach-config: PlanDefinition updated, no draft tasks to reconcile');
    }

    // Re-read the saved PlanDefinition to return canonical state
    const saved = await oystehr.fhir.get<PlanDefinition>({
      resourceType: 'PlanDefinition',
      id: existing.id!,
    });
    const actions = parsePlanDefinitionToActions(saved);
    const notificationsTimeRestriction = parseNotificationsTimeRestriction(saved);

    return {
      statusCode: 200,
      body: JSON.stringify({ planDefinition: saved, actions, notificationsTimeRestriction }),
    };
  }
);
