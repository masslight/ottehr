import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Task, TaskInput as FhirTaskInput } from 'fhir/r4b';
import {
  getCoding,
  getFullestAvailableName,
  getSecret,
  getTestNameOrCodeFromDr,
  LAB_DR_TYPE_TAG,
  LAB_ORDER_TASK,
  LabType,
  NonNormalResult,
  Secrets,
  SecretsKeys,
  TaskAlertCode,
} from 'utils';
import { diagnosticReportSpecificResultType, nonNonNormalTagsContained } from '../../../ehr/shared/labs';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { addDocsToLabList, getLabListResource } from '../../../shared/pdf/lab-pdf-utils';
import {
  createExternalLabResultPDF,
  createExternalLabResultPDFBasedOnDr,
} from '../../../shared/pdf/labs-results-form-pdf';
import { createTask, getTaskLocation, TaskInput } from '../../../shared/tasks';
import { fetchRelatedResources, getCodeForNewTask } from './helpers';
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
    const isUnsolicited = specificDrTypeFromTag === LAB_DR_TYPE_TAG.code.unsolicited;
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
    const { tasks, patient, labOrg, encounter, attachments } = await fetchRelatedResources(diagnosticReport, oystehr);

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

    const taskInput: TaskInput[] | FhirTaskInput[] | undefined = preSubmissionTask?.input
      ? preSubmissionTask.input
      : [
          {
            type: LAB_ORDER_TASK.input.testName,
            valueString: getTestNameOrCodeFromDr(diagnosticReport),
          },
          {
            type: LAB_ORDER_TASK.input.labName,
            valueString: labOrg?.name,
          },
          {
            type: LAB_ORDER_TASK.input.receivedDate,
            valueString: diagnosticReport.effectiveDateTime,
          },
          {
            type: LAB_ORDER_TASK.input.patientName,
            valueString: patient ? getFullestAvailableName(patient) : undefined,
          },
          {
            type: LAB_ORDER_TASK.input.appointmentId,
            valueString: appointmentId ? appointmentId : undefined,
          },
        ];

    if (specificDrTypeFromTag && taskInput) {
      taskInput.push({
        type: LAB_ORDER_TASK.input.drTag,
        valueString: specificDrTypeFromTag,
      });
    }

    const nonNormalResult = nonNonNormalTagsContained(diagnosticReport);
    if (nonNormalResult) console.log('nonNormalResult:', nonNormalResult);
    if (nonNormalResult?.includes(NonNormalResult.Abnormal)) {
      taskInput.push({
        type: LAB_ORDER_TASK.input.alert,
        valueString: TaskAlertCode.abnormalLabResult,
      });
    }

    // Don't show "preliminary" result task on the tasks board
    // we do need to show tasks for if the preliminary result is unsolicited otherwise theres no way for users to see it
    const showTaskOnBoard = diagnosticReport.status !== 'preliminary' || isUnsolicited;
    console.log('showTaskOnBoard', showTaskOnBoard);

    const code = getCodeForNewTask(diagnosticReport, isUnsolicited, isUnsolicitedAndMatched);

    // copied and adjusted from /apps/ehr/src/features/visits/in-person/hooks/useTasks.ts:fhirTaskToTask
    let title = '';
    const testName = taskInput.find((input) => input.type === LAB_ORDER_TASK.input.testName)?.valueString;
    const labName = taskInput.find((input) => input.type === LAB_ORDER_TASK.input.labName)?.valueString;
    const fullTestName = testName + (labName ? ' / ' + labName : '');
    const patientName = taskInput.find((input) => input.type === LAB_ORDER_TASK.input.patientName)?.valueString;
    const labTypeString = specificDrTypeFromTag || '';

    if (
      serviceRequestId &&
      (code === LAB_ORDER_TASK.code.reviewFinalResult || code === LAB_ORDER_TASK.code.reviewCorrectedResult)
    ) {
      title = `Review results for “${fullTestName}” for ${patientName}`;
    }
    if (code === LAB_ORDER_TASK.code.matchUnsolicitedResult) {
      title = 'Match unsolicited test results';
    }
    if (
      code === LAB_ORDER_TASK.code.reviewFinalResult ||
      code === LAB_ORDER_TASK.code.reviewCorrectedResult ||
      code === LAB_ORDER_TASK.code.reviewPreliminaryResult
    ) {
      if (labTypeString === LabType.unsolicited && !serviceRequestId) {
        title = `Review unsolicited test results for “${fullTestName}” for ${patientName}`;
      }
      if (labTypeString === LabType.reflex) {
        title = `Review reflex results for “${fullTestName}” for ${patientName}`;
      }
    }

    const newTask = createTask(
      {
        category: LAB_ORDER_TASK.category,
        title,
        code: {
          system: LAB_ORDER_TASK.system,
          code,
        },
        encounterId: preSubmissionTask?.encounter?.reference?.split('/')[1] ?? '',
        basedOn: [
          `DiagnosticReport/${diagnosticReport.id}`,
          ...(serviceRequestId ? [`ServiceRequest/${serviceRequestId}`] : []),
        ],
        location: preSubmissionTask ? getTaskLocation(preSubmissionTask) : undefined,
        input: taskInput,
      },
      showTaskOnBoard
    );
    if (diagnosticReport.status === 'cancelled') {
      newTask.status = 'completed';
    }

    requests.push({
      method: 'POST',
      url: '/Task',
      resource: newTask,
    });
    console.log('creating a new task with code: ', JSON.stringify(newTask.code));

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
      if (isUnsolicitedAndMatched || specificDrTypeFromTag === LabType.reflex) {
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

    // we should add attachments to the patient lab folder for any solicited result, or matched unsolicited results
    if (attachments && patient && (isUnsolicitedAndMatched || !isUnsolicited)) {
      console.log('adding attachments to patient lab folder');
      const attachmentDocRefReferences = attachments.map((attachment) => `DocumentReference/${attachment.id}`);
      const labList = await getLabListResource(oystehr, patient.id!, secrets);
      if (labList) {
        await addDocsToLabList(oystehr, labList, attachmentDocRefReferences, secrets);
      }
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
