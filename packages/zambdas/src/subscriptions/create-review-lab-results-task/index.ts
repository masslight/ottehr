import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Task } from 'fhir/r4b';
import { Secrets } from 'utils';
import { ZambdaInput } from '../../shared/types';
import { validateRequestParameters } from './validateRequestParameters';
import { LAB_ORDER_TASK } from 'utils';
import { createOystehrClient } from '../../shared/helpers';
import { getAuth0Token, topLevelCatch } from '../../shared';

export interface ReviewLabResultSubscriptionInput {
  diagnosticReport: DiagnosticReport;
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input, undefined, 2)}`);

  try {
    const { diagnosticReport, secrets } = validateRequestParameters(input);

    if (!diagnosticReport.id)
      throw new Error(`Triggering DiagnosticReport did not have an id. ${JSON.stringify(diagnosticReport)}`);

    // TODO: in the future, this should probably also include 'corrected'. Corrected results only come in for final results,
    // so it can still make a RFRT or we can another task type for corrected results
    if (!['preliminary', 'final'].includes(diagnosticReport.status))
      throw new Error(
        `Triggering DiagnosticReport.status was not preliminary or final. ${JSON.stringify(diagnosticReport)}`
      );

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);
    const requests: BatchInputRequest<Task>[] = [];

    // See if the diagnosticReport has any existing tasks associated in the
    // if there were existing in-progress or ready tasks, then those should be set to 'cancelled' (two l's)
    const existingTasks = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: 'based-on', value: `DiagnosticReport/${diagnosticReport.id}` },
          { name: 'code:not', value: LAB_ORDER_TASK.code.presubmission },
          { name: 'status', value: 'ready,in-progress' },
        ],
      })
    ).unbundle();

    existingTasks.forEach((task) => {
      if (task.id)
        requests.push({
          url: `/Task/${task.id}`,
          method: 'PATCH',
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'cancelled',
            },
          ],
        });
    });

    // make the new task
    const newTask: Task = {
      resourceType: 'Task',
      intent: 'reflex-order', // TODO: should this be 'order' instead?
      basedOn: [
        {
          type: 'DiagnosticReport',
          reference: `DiagnosticReport/${diagnosticReport.id}`,
        },
      ],
      status: 'ready',
      code: {
        coding: [
          {
            system: LAB_ORDER_TASK.system,
            code:
              diagnosticReport.status === 'preliminary'
                ? LAB_ORDER_TASK.code.reviewPreliminaryResult
                : LAB_ORDER_TASK.code.reviewFinalResult,
          },
        ],
      },
    };

    requests.push({
      method: 'POST',
      url: '/Task',
      resource: newTask,
    });

    const oystehrResponse = await oystehr.fhir.transaction<Task>({ requests });

    const response: {
      [key: string]: Task[];
    } = {
      updatedTasks: [],
      createdTasks: [],
    };

    oystehrResponse.entry?.forEach((ent) => {
      if (ent.response?.outcome?.id === 'ok' && ent.resource) response.updatedTasks.push(ent.resource);
      else if (ent.response?.outcome?.id === 'created' && ent.resource) response.createdTasks.push(ent.resource);
    });

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('create-review-lab-results-task', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
