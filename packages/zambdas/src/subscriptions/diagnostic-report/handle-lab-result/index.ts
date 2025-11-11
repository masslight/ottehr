import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Task, TaskInput } from 'fhir/r4b';
import {
  getCoding,
  getFullestAvailableName,
  getSecret,
  getTestNameOrCodeFromDr,
  LAB_ORDER_TASK,
  LabType,
  Secrets,
  SecretsKeys,
} from 'utils';
import { diagnosticReportSpecificResultType } from '../../../ehr/shared/labs';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import {
  createExternalLabResultPDF,
  createExternalLabResultPDFBasedOnDr,
} from '../../../shared/pdf/labs-results-form-pdf';
import { createTask, getTaskLocation } from '../../../shared/tasks';
import { fetchRelatedResources, getCodeForNewTask, isUnsolicitedResult } from './helpers';
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

    const serviceRequestId = diagnosticReport?.basedOn
      ?.find((temp) => temp.reference?.startsWith('ServiceRequest/'))
      ?.reference?.split('/')[1];

    console.log('specificDrTypeFromTag', specificDrTypeFromTag);
    console.log('isUnsolicitedAndMatched:', isUnsolicitedAndMatched);
    console.log('isUnsolicited', isUnsolicited);
    console.log('diagnosticReport: ', diagnosticReport.id);
    console.log('serviceRequestId:', serviceRequestId);

    if (!serviceRequestId && specificDrTypeFromTag === undefined) {
      throw new Error('ServiceRequest id is not found');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);
    const { tasks, patient, labOrg, encounter } = await fetchRelatedResources(diagnosticReport, oystehr);

    const requests: BatchInputRequest<Task>[] = [];

    // See if the diagnosticReport has any existing tasks associated in the
    // if there were existing in-progress or ready tasks, then those should be set to 'cancelled' (two l's)
    tasks.forEach((task) => {
      if (
        ['ready', 'in-progress'].includes(task.status) &&
        getCoding(task.code, LAB_ORDER_TASK.system)?.code != LAB_ORDER_TASK.code.preSubmission
      ) {
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
      }
    });

    const preSubmissionTask = tasks.find(
      (task) => getCoding(task.code, LAB_ORDER_TASK.system)?.code == LAB_ORDER_TASK.code.preSubmission
    );

    const appointmentRef = encounter?.appointment?.[0].reference;
    const appointmentId = appointmentRef?.startsWith('Appointment/')
      ? appointmentRef?.replace('Appointment/', '')
      : undefined;

    const taskInput: { type: string; value?: string }[] | TaskInput[] | undefined = preSubmissionTask?.input
      ? preSubmissionTask.input
      : [
          {
            type: LAB_ORDER_TASK.input.testName,
            value: getTestNameOrCodeFromDr(diagnosticReport),
          },
          {
            type: LAB_ORDER_TASK.input.labName,
            value: labOrg?.name,
          },
          {
            type: LAB_ORDER_TASK.input.receivedDate,
            value: diagnosticReport.effectiveDateTime,
          },
          {
            type: LAB_ORDER_TASK.input.patientName,
            value: patient ? getFullestAvailableName(patient) : undefined,
          },
          {
            type: LAB_ORDER_TASK.input.appointmentId,
            value: appointmentId ? appointmentId : undefined,
          },
        ];

    if (specificDrTypeFromTag && taskInput) {
      taskInput.push({
        type: LAB_ORDER_TASK.input.drTag,
        value: specificDrTypeFromTag,
      });
    }

    const newTask = createTask({
      category: LAB_ORDER_TASK.category,
      code: {
        system: LAB_ORDER_TASK.system,
        code: getCodeForNewTask(diagnosticReport, isUnsolicited, isUnsolicitedAndMatched),
      },
      encounterId: preSubmissionTask?.encounter?.reference?.split('/')[1] ?? '',
      basedOn: [
        `DiagnosticReport/${diagnosticReport.id}`,
        ...(serviceRequestId ? [`ServiceRequest/${serviceRequestId}`] : []),
      ],
      location: preSubmissionTask ? getTaskLocation(preSubmissionTask) : undefined,
      input: taskInput,
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

    if (serviceRequestId) {
      await createExternalLabResultPDF(oystehr, serviceRequestId, diagnosticReport, false, secrets, oystehrToken);
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
