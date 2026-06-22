import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Encounter, Location, Patient, Practitioner, ServiceRequest, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getFullestAvailableName,
  SaveRadiologyReportZambdaOutput,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  User,
  userMe,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  configReviewResultTask,
  getMostRecentReport,
  parseRadiologyResourcesForTask,
  validateResourcesAgainstDR,
} from '../shared';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'save-final-report';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);
    const callerUser = await userMe(validatedInput.callerAccessToken, secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const output = await performEffect(validatedInput, callerUser, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({ output }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
});

async function performEffect(
  validatedInput: ValidatedInput,
  callerUser: User,
  oystehr: Oystehr
): Promise<SaveRadiologyReportZambdaOutput> {
  const { serviceRequestId, report: finalReport } = validatedInput.body;

  console.group('Fetching Fhir Resources from Oystehr');

  const [searchResults, callerUserPractitioner] = await Promise.all([
    (
      await oystehr.fhir.search<DiagnosticReport | ServiceRequest | Patient | Encounter | Practitioner | Location>({
        resourceType: 'DiagnosticReport',
        params: [
          {
            name: 'based-on',
            value: `ServiceRequest/${serviceRequestId}`,
          },
          {
            name: 'status',
            value: 'preliminary',
          },
          {
            name: '_include',
            value: 'DiagnosticReport:based-on', // service request
          },
          {
            name: '_include',
            value: 'DiagnosticReport:subject', // patient
          },
          {
            name: '_include:iterate',
            value: 'ServiceRequest:encounter',
          },
          {
            name: '_include:iterate',
            value: 'ServiceRequest:requester',
          },
          {
            name: '_include:iterate',
            value: 'Encounter:location', // to get location name to record on task for displays
          },
        ],
      })
    ).unbundle(),
    await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: callerUser.profile.split('/')[1],
    }),
  ]);

  console.groupEnd();
  console.debug('Resources fetched successfully');

  const { diagnosticReports, ...additionalResources } = parseRadiologyResourcesForTask(searchResults);
  const diagnosticReport = getMostRecentReport(diagnosticReports);

  if (!diagnosticReport || !diagnosticReport.id) {
    throw Error(
      `Cannot save final report - unable to retrieve DiagnosticReport for ServiceRequest/${serviceRequestId}`
    );
  }

  const resourcesForTask = validateResourcesAgainstDR({ ...additionalResources, diagnosticReport });
  const reviewTaskBaseConfig = configReviewResultTask(resourcesForTask);

  const taskOwner: Task['owner'] = {
    reference: callerUser.profile,
    display: (callerUserPractitioner && getFullestAvailableName(callerUserPractitioner)) ?? callerUser.name,
    extension: [
      {
        url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
        valueDateTime: DateTime.now().toISO(),
      },
    ],
  };
  const reviewTaskConfig: Task = { ...reviewTaskBaseConfig, status: 'completed', owner: taskOwner };

  const reviewTaskPostRequest: BatchInputPostRequest<Task> = {
    method: 'POST',
    url: 'Task/',
    resource: reviewTaskConfig,
  };

  const reportAsBase64 = Buffer.from(finalReport.replace(/\n/g, '<br>')).toString('base64');
  const reportAsBase64Size = Buffer.byteLength(reportAsBase64);

  const diagnosticReportPatchRequest: BatchInputPatchRequest<DiagnosticReport> = {
    method: 'PATCH',
    url: `DiagnosticReport/${diagnosticReport.id}`,
    operations: [
      {
        op: diagnosticReport.presentedForm ? 'replace' : 'add',
        path: '/presentedForm',
        value: [
          {
            contentType: 'text/html',
            data: reportAsBase64,
            size: reportAsBase64Size,
          },
        ],
      },
      {
        op: diagnosticReport.issued ? 'replace' : 'add',
        path: '/issued',
        value: DateTime.now().toISO(),
      },
      {
        op: 'replace',
        path: '/status',
        value: 'final',
      },
    ],
  };

  // Update DiagnosticReport in Oystehr with the final report
  console.group('Patching DiagnosticReport & Creating Task in Oystehr');
  await oystehr.fhir.transaction({ requests: [reviewTaskPostRequest, diagnosticReportPatchRequest] });
  console.groupEnd();
  console.debug('Transaction successfully made');

  return {};
}
