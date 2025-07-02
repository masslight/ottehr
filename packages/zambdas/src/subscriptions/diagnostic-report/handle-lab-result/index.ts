import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getSecret, LAB_ORDER_TASK, Secrets, SecretsKeys } from 'utils';
import { getAuth0Token, topLevelCatch } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import { createExternalLabResultPDF } from '../../../shared/pdf/labs-results-form-pdf';
import { ZambdaInput } from '../../../shared/types';
import { validateRequestParameters } from './validateRequestParameters';

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

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const serviceRequestID = diagnosticReport?.basedOn
      ?.find((temp) => temp.reference?.startsWith('ServiceRequest/'))
      ?.reference?.split('/')[1];
    if (!serviceRequestID) {
      throw new Error('ServiceRequest id is not found');
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
          { name: 'code:not', value: LAB_ORDER_TASK.code.preSubmission },
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
      authoredOn: diagnosticReport.effectiveDateTime ?? DateTime.now().toUTC().toISO(), // the effective date is also UTC
      intent: 'order',
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
                : diagnosticReport.status === 'corrected'
                ? LAB_ORDER_TASK.code.reviewCorrectedResult
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

    await createExternalLabResultPDF(oystehr, serviceRequestID, diagnosticReport, false, secrets, zapehrToken);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('handle-lab-result', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
