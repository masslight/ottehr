import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Patient, Task } from 'fhir/r4b';
import { getFullestAvailableName, getSecret, LAB_ORDER_TASK, LabType, Secrets, SecretsKeys } from 'utils';
import { diagnosticReportSpecificResultType, getTestNameOrCodeFromDr } from '../../../ehr/shared/labs';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import {
  createExternalLabResultPDF,
  createExternalLabResultPDFBasedOnDr,
} from '../../../shared/pdf/labs-results-form-pdf';
import { createTask, getTaskLocationId } from '../../../shared/tasks';
import { getCodeForNewTask, isUnsolicitedResult } from './helpers';
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

    const specificDrTypeFromTag = diagnosticReportSpecificResultType(diagnosticReport);
    const isUnsolicited = isUnsolicitedResult(specificDrTypeFromTag, diagnosticReport);
    const isUnsolicitedAndMatched = isUnsolicited && !!diagnosticReport.subject?.reference?.startsWith('Patient/');

    const serviceRequestID = diagnosticReport?.basedOn
      ?.find((temp) => temp.reference?.startsWith('ServiceRequest/'))
      ?.reference?.split('/')[1];

    console.log('specificDrTypeFromTag', specificDrTypeFromTag);
    console.log('isUnsolicitedAndMatched:', isUnsolicitedAndMatched);
    console.log('isUnsolicited', isUnsolicited);
    console.log('diagnosticReport: ', diagnosticReport.id);
    console.log('serviceRequestID:', serviceRequestID);

    if (!serviceRequestID && specificDrTypeFromTag === undefined) {
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

    const preSubmissionTask = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: 'based-on', value: `ServiceRequest/${serviceRequestID}` },
          { name: 'code', value: LAB_ORDER_TASK.system + '|' + LAB_ORDER_TASK.code.preSubmission },
        ],
      })
    ).unbundle()[0];
    const patientId = diagnosticReport.subject?.reference?.split('/')[1];
    const patient = patientId
      ? await oystehr.fhir.get<Patient>({
          resourceType: 'Patient',
          id: patientId,
        })
      : undefined;

    const newTask = createTask({
      category: LAB_ORDER_TASK.category,
      code: {
        system: LAB_ORDER_TASK.system,
        code: getCodeForNewTask(diagnosticReport, isUnsolicited, isUnsolicitedAndMatched),
      },
      encounterId: preSubmissionTask?.encounter?.reference?.split('/')[1] ?? '',
      basedOn: [
        `DiagnosticReport/${diagnosticReport.id}`,
        ...(serviceRequestID ? [`ServiceRequest/${serviceRequestID}`] : []),
      ],
      locationId: preSubmissionTask ? getTaskLocationId(preSubmissionTask) : undefined,
      input: preSubmissionTask
        ? preSubmissionTask.input
        : [
            {
              type: LAB_ORDER_TASK.input.testName,
              value: getTestNameOrCodeFromDr(diagnosticReport),
            },
            {
              type: LAB_ORDER_TASK.input.receivedDate,
              value: diagnosticReport.effectiveDateTime,
            },
            {
              type: LAB_ORDER_TASK.input.patientName,
              value: patient ? getFullestAvailableName(patient) : 'Unknown',
            },
          ],
    });
    if (diagnosticReport.status === 'cancelled') {
      newTask.status = 'completed';
    }

    // no task will be created for an unsolicited result pdf attachment
    // no result pdf can be created until it is matched and it should come in with at least one other DR that will trigger the task
    // after the matching is complete we can create the review task / generate the pdf
    const skipTaskCreation =
      specificDrTypeFromTag === LabType.pdfAttachment && isUnsolicited && !isUnsolicitedAndMatched;

    if (!skipTaskCreation) {
      requests.push({
        method: 'POST',
        url: '/Task',
        resource: newTask,
      });
      console.log('creating a new task with code: ', JSON.stringify(newTask.code));
    } else {
      console.log('skipTaskCreation', skipTaskCreation);
    }

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

    if (serviceRequestID) {
      await createExternalLabResultPDF(oystehr, serviceRequestID, diagnosticReport, false, secrets, oystehrToken);
    } else if (specificDrTypeFromTag !== undefined) {
      // unsolicited result pdfs will be created after matching to a patient
      if (
        (isUnsolicitedAndMatched || [LabType.reflex, LabType.pdfAttachment].includes(specificDrTypeFromTag)) &&
        !skipTaskCreation
      ) {
        if (!diagnosticReport.id) throw Error('unable to parse id from diagnostic report');
        console.log(`creating pdf for ${specificDrTypeFromTag} result`);
        await createExternalLabResultPDFBasedOnDr(
          oystehr,
          specificDrTypeFromTag,
          diagnosticReport.id,
          false,
          secrets,
          oystehrToken
        );
      } else {
        console.log(
          'skipping pdf creating for unsolicited result since it is not matched',
          diagnosticReport.id,
          isUnsolicited,
          isUnsolicitedAndMatched,
          specificDrTypeFromTag
        );
      }
    } else {
      console.log('skipping pdf creation'); // shouldn't reach this tbh
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('handle-lab-result', error, ENVIRONMENT);
  }
});
