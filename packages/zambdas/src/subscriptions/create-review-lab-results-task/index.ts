import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Task } from 'fhir/r4b';
import { Secrets } from 'utils';
import { ZambdaInput } from '../../shared/types';
import { validateRequestParameters } from './validateRequestParameters';
import { LAB_ORDER_TASK } from 'utils';
import { createOystehrClient } from '../../shared/helpers';
import { getAuth0Token } from '../../shared';

export interface ReviewLabResultSubscriptionInput {
  diagnosticReport: DiagnosticReport;
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input, undefined, 2)}`);

  const { diagnosticReport, secrets } = validateRequestParameters(input);

  if (!zapehrToken) {
    console.log('getting token');
    zapehrToken = await getAuth0Token(secrets);
  } else {
    console.log('already have token');
  }

  const oystehr = createOystehrClient(zapehrToken, secrets);
  // See if the diagnosticReport has any existing tasks associated in the
  // if there were existing in-progress or ready tasks, then those should be set to 'cancelled' (two l's)
  // these should also specifically be Result review tasks which is captured by code-RPRT or RFRT.
  // {
  //   system: 'external-lab-task',
  //   code: 'PST' | 'RPRT' | 'RFRT',
  // },
  if (!diagnosticReport.id) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Triggering DiagnosticReport did not have an id. ${diagnosticReport}` }),
    };
  }

  // const bundle = await oystehr.fhir.search<Task>({
  //   resourceType: 'Task',
  //   params: [
  //     { name: 'basedOn', value: `DiagnosticReport/${diagnosticReport.id}` },
  //     { name: 'code:not', value: LAB_ORDER_TASK.code.presubmission },
  //   ],
  // });

  // console.log(`>>> This is the task bundle, ${JSON.stringify(bundle, undefined, 2)}`);

  // make a Task with status = ready, owner = undefined
  // If DR.status == ‘preliminary’, Task.code = RPRT
  // If the DR.status == ‘final’, Task.code = RFRT
  if (!['preliminary', 'final'].includes(diagnosticReport.status)) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Triggering DiagnosticReport.status was not preliminary or final. ${diagnosticReport}`,
      }),
    };
  }

  const task: Task = {
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

  const createdTask = await oystehr.fhir.create<Task>(task);

  const response = {
    message: `Successfully created task, ${JSON.stringify(createdTask)}`,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};
