import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Encounter, Location, Patient, Practitioner, ServiceRequest, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_ASSIGNED_DATE_TIME_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { encodeRadiologyReport } from 'utils/lib/fhir/radiology';
import { Secrets } from 'utils/lib/secrets';
import { SaveRadiologyReportZambdaOutput } from 'utils/lib/types/api/radiology';
import { RADIOLOGY_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { resolveCallerPractitionerRef } from '../../../shared/practitioners';
import {
  buildPreliminaryReportSnapshot,
  takeMostRecentPreliminaryReport,
  takeTheBestFinalDiagnosticReport,
} from '../../../shared/radiology';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { configReviewResultTask, parseRadiologyResourcesForTask, validateResourcesAgainstDR } from '../shared';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'save-final-report';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const output = await performEffect(validatedInput, secrets, oystehr);

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
  secrets: Secrets,
  oystehr: Oystehr
): Promise<SaveRadiologyReportZambdaOutput> {
  const { serviceRequestId, report: finalReport } = validatedInput.body;

  console.group('Fetching Fhir Resources from Oystehr');

  const [searchResults, author] = await Promise.all([
    (
      await oystehr.fhir.search<DiagnosticReport | ServiceRequest | Patient | Encounter | Practitioner | Location>({
        resourceType: 'DiagnosticReport',
        params: [
          {
            name: 'based-on',
            value: `ServiceRequest/${serviceRequestId}`,
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
    resolveCallerPractitionerRef(validatedInput.callerAccessToken, secrets, oystehr),
  ]);

  console.groupEnd();
  console.debug('Resources fetched successfully');

  const { diagnosticReports, ...additionalResources } = parseRadiologyResourcesForTask(searchResults);

  // The search is no longer filtered to `preliminary`, because finalizing now leaves a preliminary snapshot
  // behind — so refuse outright if this order already has a final read rather than finalizing that snapshot.
  if (takeTheBestFinalDiagnosticReport(diagnosticReports)) {
    throw RADIOLOGY_ERROR('This order already has a final read, please refresh the page.');
  }

  const diagnosticReport = takeMostRecentPreliminaryReport(diagnosticReports);

  if (!diagnosticReport || !diagnosticReport.id) {
    throw Error(
      `Cannot save final report - unable to retrieve DiagnosticReport for ServiceRequest/${serviceRequestId}`
    );
  }

  const resourcesForTask = validateResourcesAgainstDR({ ...additionalResources, diagnosticReport });
  const reviewTaskBaseConfig = configReviewResultTask(resourcesForTask);

  const taskOwner: Task['owner'] = {
    ...author,
    extension: [
      {
        url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
        valueDateTime: DateTime.now().toISO(),
      },
    ],
  };
  // Assigned to the author but left open: writing the read and signing off on it are separate acts, and the
  // order has to pass through `final` for the read to be correctable before it is locked at `reviewed`.
  const reviewTaskConfig: Task = { ...reviewTaskBaseConfig, status: 'ready', owner: taskOwner };

  const reviewTaskPostRequest: BatchInputPostRequest<Task> = {
    method: 'POST',
    url: 'Task/',
    resource: reviewTaskConfig,
  };

  // Preserve the preliminary read before the patch below overwrites it.
  const preliminarySnapshotPostRequest: BatchInputPostRequest<DiagnosticReport> = {
    method: 'POST',
    url: 'DiagnosticReport/',
    resource: buildPreliminaryReportSnapshot(diagnosticReport),
  };

  const reportAsBase64 = encodeRadiologyReport(finalReport);
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
        // Records that this read was written here rather than by teleradiology, and by whom — only that
        // practitioner may correct it afterwards.
        op: diagnosticReport.performer ? 'replace' : 'add',
        path: '/performer',
        value: [author],
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
  await oystehr.fhir.transaction({
    requests: [reviewTaskPostRequest, preliminarySnapshotPostRequest, diagnosticReportPatchRequest],
  });
  console.groupEnd();
  console.debug('Transaction successfully made');

  return {};
}
