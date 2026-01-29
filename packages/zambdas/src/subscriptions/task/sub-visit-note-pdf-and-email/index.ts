import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  getAddressStringForScheduleResource,
  getPatientContactEmail,
  getSecret,
  InPersonCompletionTemplateData,
  isFollowupEncounter,
  OTTEHR_MODULE,
  progressNoteChartDataRequestedFields,
  Secrets,
  SecretsKeys,
  TelemedCompletionTemplateData,
  telemedProgressNoteChartDataRequestedFields,
} from 'utils';
import { getChartData } from '../../../ehr/get-chart-data';
import { getInHouseResources } from '../../../ehr/get-in-house-orders/helpers';
import { getLabResources } from '../../../ehr/get-lab-orders/helpers';
import { getMedicationOrders } from '../../../ehr/get-medication-orders';
import { getImmunizationOrders } from '../../../ehr/immunization/get-orders';
import { getNameForOwner } from '../../../ehr/schedules/shared';
import { getPresignedURLs } from '../../../patient/appointment/get-visit-details/helpers';
import {
  createOystehrClient,
  getAuth0Token,
  getEmailClient,
  makeAddressUrl,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
import { makeVisitNotePdfDocumentReference } from '../../../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference';
import { composeAndCreateVisitNotePdf } from '../../../shared/pdf/visit-details-pdf/visit-note-pdf-creation';
import { validateRequestParameters } from '../validateRequestParameters';

export interface TaskSubscriptionInput {
  task: Task;
  secrets: Secrets | null;
}

type TaskStatus =
  | 'draft'
  | 'requested'
  | 'received'
  | 'accepted'
  | 'rejected'
  | 'ready'
  | 'cancelled'
  | 'in-progress'
  | 'on-hold'
  | 'failed'
  | 'completed'
  | 'entered-in-error';

let oystehrToken: string;
let oystehr: Oystehr;
let taskId: string | undefined;

const ZAMBDA_NAME = 'sub-visit-note-pdf-and-email';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { task, secrets } = validatedParameters;
  console.log('task ID', task.id);
  if (!task.id) {
    throw new Error('Task ID is required');
  }
  taskId = task.id;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(secrets);
  } else {
    console.log('already have token');
  }

  oystehr = createOystehrClient(oystehrToken, secrets);

  console.log('getting appointment Id from the task');
  const appointmentId =
    task.focus?.type === 'Appointment' ? task.focus?.reference?.replace('Appointment/', '') : undefined;
  console.log('appointment ID parsed: ', appointmentId);

  if (!appointmentId) {
    console.log('no appointment ID found on task');
    throw new Error('no appointment ID found on task focus');
  }

  const visitResources = await getAppointmentAndRelatedResources(
    oystehr,
    appointmentId,
    true,
    task.encounter?.reference?.split('/')[1]
  );
  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }

  const { encounter, patient, appointment, location, listResources } = visitResources;

  if (encounter?.subject?.reference === undefined) {
    throw new Error(`No subject reference defined for encounter ${encounter?.id}`);
  }
  if (!patient) {
    throw new Error(`No patient found for encounter ${encounter.id}`);
  }

  const isInPersonAppointment = !!visitResources.appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

  // Check if this is a PDF-only task (for follow-ups) or regular PDF+email task
  const isPDFOnlyTask = isFollowupEncounter(encounter);

  const chartDataPromise = getChartData(oystehr, oystehrToken, visitResources.encounter.id!);
  const additionalChartDataPromise = getChartData(
    oystehr,
    oystehrToken,
    visitResources.encounter.id!,
    isInPersonAppointment ? progressNoteChartDataRequestedFields : telemedProgressNoteChartDataRequestedFields
  );

  const medicationOrdersPromise = getMedicationOrders(oystehr, {
    searchBy: {
      field: 'encounterId',
      value: visitResources.encounter.id!,
    },
  });

  const externalLabOrdersPromise = getLabResources(
    oystehr,
    {
      searchBy: { field: 'encounterId', value: encounter.id! },
      itemsPerPage: 10,
      pageIndex: 0,
      secrets,
    },
    oystehrToken,
    { searchBy: { field: 'encounterId', value: encounter.id! } }
  );

  const inHouseOrdersPromise = getInHouseResources(
    oystehr,
    {
      searchBy: { field: 'encounterId', value: encounter.id! },
      itemsPerPage: 10,
      pageIndex: 0,
      secrets,
      userToken: '',
    },
    { searchBy: { field: 'encounterId', value: encounter.id! } },
    oystehrToken
  );

  const [chartDataResult, additionalChartDataResult, externalLabsData, inHouseOrdersData, medicationOrdersData] =
    await Promise.all([
      chartDataPromise,
      additionalChartDataPromise,
      externalLabOrdersPromise,
      inHouseOrdersPromise,
      medicationOrdersPromise,
    ]);
  const immunizationOrders = (
    await getImmunizationOrders(oystehr, {
      encounterId: visitResources.encounter.id!,
    })
  ).orders;
  const chartData = chartDataResult.response;
  const additionalChartData = additionalChartDataResult.response;
  const medicationOrders = medicationOrdersData?.orders.filter((order) => order.status !== 'cancelled');

  console.log('Chart data received');
  try {
    const pdfInfo = await composeAndCreateVisitNotePdf(
      { chartData, additionalChartData, medicationOrders, immunizationOrders, externalLabsData, inHouseOrdersData },
      visitResources,
      secrets,
      oystehrToken
    );
    if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
    console.log(`Creating visit note pdf docRef`);
    await makeVisitNotePdfDocumentReference(oystehr, pdfInfo, patient.id, appointmentId, encounter.id!, listResources);

    const emailClient = getEmailClient(secrets);
    const emailEnabled = emailClient.getFeatureFlag();
    if (emailEnabled && !isPDFOnlyTask) {
      const patientEmail = getPatientContactEmail(patient);
      let prettyStartTime = '';
      let locationName = '';
      let address = '';
      if (appointment.start && visitResources.timezone) {
        prettyStartTime = DateTime.fromISO(appointment.start)
          .setZone(visitResources.timezone)
          .toFormat(DATETIME_FULL_NO_YEAR);
      }
      if (location) {
        locationName = getNameForOwner(location);
        address = getAddressStringForScheduleResource(location) ?? '';
      }
      const { presignedUrls } = await getPresignedURLs(oystehr, oystehrToken, visitResources.encounter.id!);
      const visitNoteUrl = presignedUrls['visit-note'].presignedUrl;

      if (isInPersonAppointment) {
        const missingData: string[] = [];
        if (!patientEmail) missingData.push('patient email');
        if (!appointment.id) missingData.push('appointment ID');
        if (!locationName) missingData.push('location name');
        if (!address) missingData.push('address');
        if (!prettyStartTime) missingData.push('appointment time');
        if (!visitNoteUrl) missingData.push('visit note URL');
        if (missingData.length === 0 && location && visitNoteUrl && patientEmail) {
          // note: it's assumed that location is the schedule owner here, which is incorrect for Provider schedules
          const templateData: InPersonCompletionTemplateData = {
            location: getNameForOwner(location),
            time: prettyStartTime,
            address,
            'address-url': makeAddressUrl(address),
            'visit-note-url': visitNoteUrl,
          };
          await emailClient.sendInPersonCompletionEmail(patientEmail, templateData);
        } else {
          console.error(
            `Not sending in-person completion email, missing the following data: ${missingData.join(', ')}`
          );
        }
      } else {
        const missingData: string[] = [];
        if (!patientEmail) missingData.push('patient email');
        if (!appointment.id) missingData.push('appointment ID');
        if (!locationName) missingData.push('location name');
        if (!visitNoteUrl) missingData.push('visit note URL');
        if (missingData.length === 0 && location && visitNoteUrl && patientEmail) {
          const templateData: TelemedCompletionTemplateData = {
            location: getNameForOwner(location),
            'visit-note-url': visitNoteUrl,
          };
          await emailClient.sendVirtualCompletionEmail(patientEmail, templateData);
        } else {
          console.error(`Not sending virtual completion email, missing the following data: ${missingData.join(', ')}`);
        }
      }
    }

    // update task status and status reason
    console.log('making patch request to update task status');
    const statusMessage = isPDFOnlyTask ? 'PDF created successfully' : 'PDF created and emailed successfully';
    const patchedTask = await patchTaskStatus(oystehr, task.id, 'completed', statusMessage);

    const response = {
      taskStatus: patchedTask.status,
      statusReason: patchedTask.statusReason,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    try {
      if (oystehr && taskId) await patchTaskStatus(oystehr, taskId, 'failed', JSON.stringify(error));
    } catch (patchError) {
      console.error('Error patching task status in top level catch:', patchError);
    }
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const patchTaskStatus = async (
  oystehr: Oystehr,
  taskId: string,
  status: TaskStatus,
  reason?: string
): Promise<Task> => {
  const patchedTask = await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: status,
      },
      {
        op: 'add',
        path: '/statusReason',
        value: {
          coding: [
            {
              system: 'status-reason',
              code: reason || 'no reason given',
            },
          ],
        },
      },
    ],
  });
  console.log('successfully patched task');
  console.log(JSON.stringify(patchedTask));
  return patchedTask;
};
