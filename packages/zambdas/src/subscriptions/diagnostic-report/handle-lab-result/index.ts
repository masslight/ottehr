import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getSecret, LAB_ORDER_TASK, Secrets, SecretsKeys } from 'utils';
import { diagnosticReportIsUnsolicited } from '../../../ehr/shared/labs';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { createExternalLabResultPDF } from '../../../shared/pdf/labs-results-form-pdf';
import { getCodeForNewTask, getStatusForNewTask } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'handle-lab-result';

export interface ReviewLabResultSubscriptionInput {
  diagnosticReport: DiagnosticReport;
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input, undefined, 2)}`);

  try {
    const { diagnosticReport, secrets } = validateRequestParameters(input);

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const isUnsolicited = diagnosticReportIsUnsolicited(diagnosticReport);
    const isUnsolicitedAndUnmatched = isUnsolicited && !diagnosticReport.subject?.reference?.startsWith('Patient/');

    const serviceRequestID = diagnosticReport?.basedOn
      ?.find((temp) => temp.reference?.startsWith('ServiceRequest/'))
      ?.reference?.split('/')[1];

    console.log('isUnsolicited:', isUnsolicited);
    console.log('isUnsolicitedAndUnmatched:', isUnsolicitedAndUnmatched);
    console.log('diagnosticReport: ', diagnosticReport.id);
    console.log('serviceRequestID:', serviceRequestID);

    if (!serviceRequestID && !isUnsolicited) {
      throw new Error('ServiceRequest id is not found');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);
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
              value: diagnosticReport.status === 'cancelled' ? 'rejected' : 'cancelled',
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
      status: getStatusForNewTask(diagnosticReport.status),
      code: getCodeForNewTask(diagnosticReport, isUnsolicitedAndUnmatched),
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

    // unsolicited result pdfs will be created after matching to a patient
    if (!isUnsolicitedAndUnmatched && serviceRequestID) {
      await createExternalLabResultPDF(oystehr, serviceRequestID, diagnosticReport, false, secrets, oystehrToken);
    } else {
      console.log('skipping pdf creation: ', isUnsolicited, isUnsolicitedAndUnmatched, serviceRequestID);
    }

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
});
