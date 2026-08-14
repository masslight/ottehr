import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { DiagnosticReport, Encounter, ServiceRequest, Task } from 'fhir/r4b';
import { DiagnosticReport as DiagnosticReport5 } from 'fhir/r5';
import {
  ADVAPACS_FHIR_BASE_URL,
  ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM,
  encodeRadiologyReport,
} from 'utils/lib/fhir/radiology';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { UpdateRadiologyReportZambdaOutput } from 'utils/lib/types/api/radiology';
import { RADIOLOGY_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import {
  getOrderingProviderIds,
  getReportAuthorId,
  isRadiologyOrderReviewed,
  takeMostRecentPreliminaryReport,
  takeTheBestFinalDiagnosticReport,
} from '../../../shared/radiology';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'radiology-update-report';

/**
 * Corrects a read that was already saved. The DiagnosticReport is edited in place — its status, its `issued`
 * time and the order's history rows all stay as they were, because the read is being fixed, not re-issued.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(unsafeInput.secrets);

  const validatedInput = await validateInput(unsafeInput);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const output = await performEffect(validatedInput, secrets, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({ output }),
  };
});

async function performEffect(
  validatedInput: ValidatedInput,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<UpdateRadiologyReportZambdaOutput> {
  const { serviceRequestId, report, reportType } = validatedInput.body;

  console.group('Fetching the order and its reports from Oystehr');
  const { serviceRequest, diagnosticReports, encounter, tasks } = await fetchOrderResources(serviceRequestId, oystehr);
  console.groupEnd();

  // Both reads stay correctable right up until a provider signs off on the final read. After that the order
  // is the record of what was reviewed, and editing either read would rewrite it.
  if (isRadiologyOrderReviewed(tasks, serviceRequestId)) {
    throw RADIOLOGY_ERROR('This order has already been reviewed, its reads can no longer be edited.');
  }

  const diagnosticReport =
    reportType === 'preliminary'
      ? resolvePreliminaryReportToEdit(diagnosticReports)
      : await resolveFinalReportToEdit(diagnosticReports, serviceRequest, encounter, {
          callerAccessToken: validatedInput.callerAccessToken,
          secrets,
        });

  // The preliminary read is the one teleradiology works from, so the PACS copy is corrected first: if that
  // write fails the two stores are still in agreement on the original text and the edit can be retried.
  if (reportType === 'preliminary') {
    const advaPacsReportId = diagnosticReport.identifier?.find(
      (identifier) => identifier.system === ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM
    )?.value;
    if (advaPacsReportId) {
      console.group('Updating the DiagnosticReport in AdvaPACS');
      await updateReportInAdvaPACS(advaPacsReportId, report, secrets);
      console.groupEnd();
      console.debug('AdvaPACS DiagnosticReport updated successfully');
    } else {
      // Nothing to diverge from: a report with no AdvaPACS identifier was never pushed there.
      console.warn(
        `DiagnosticReport/${diagnosticReport.id} carries no AdvaPACS identifier; skipping the AdvaPACS update.`
      );
    }
  }

  console.group('Updating the DiagnosticReport in Oystehr');
  const reportAsBase64 = encodeRadiologyReport(report);
  const presentedFormOperation: Operation = {
    op: diagnosticReport.presentedForm ? 'replace' : 'add',
    path: '/presentedForm',
    value: [
      {
        contentType: 'text/html',
        data: reportAsBase64,
        size: Buffer.byteLength(reportAsBase64),
      },
    ],
  };
  await oystehr.fhir.patch<DiagnosticReport>({
    resourceType: 'DiagnosticReport',
    id: diagnosticReport.id!,
    operations: [presentedFormOperation],
  });
  console.groupEnd();
  console.debug('DiagnosticReport updated successfully');

  return {};
}

const fetchOrderResources = async (
  serviceRequestId: string,
  oystehr: Oystehr
): Promise<{
  serviceRequest: ServiceRequest;
  diagnosticReports: DiagnosticReport[];
  encounter: Encounter | undefined;
  tasks: Task[];
}> => {
  const resources = (
    await oystehr.fhir.search<ServiceRequest | DiagnosticReport | Encounter | Task>({
      resourceType: 'ServiceRequest',
      params: [
        { name: '_id', value: serviceRequestId },
        { name: '_revinclude', value: 'DiagnosticReport:based-on' },
        { name: '_revinclude', value: 'Task:based-on' },
        // The encounter carries the attending participant, one of the two ordering-provider identities.
        { name: '_include', value: 'ServiceRequest:encounter' },
      ],
    })
  ).unbundle();

  const serviceRequest = resources.find(
    (resource): resource is ServiceRequest => resource.resourceType === 'ServiceRequest'
  );
  if (!serviceRequest) {
    throw RADIOLOGY_ERROR('This radiology order could not be found.');
  }

  return {
    serviceRequest,
    diagnosticReports: resources.filter(
      (resource): resource is DiagnosticReport =>
        resource.resourceType === 'DiagnosticReport' &&
        resource.status !== 'entered-in-error' &&
        !!resource.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequestId}`)
    ),
    encounter: resources.find((resource): resource is Encounter => resource.resourceType === 'Encounter'),
    tasks: resources.filter((resource): resource is Task => resource.resourceType === 'Task'),
  };
};

/**
 * Once the final read arrives, the preliminary read lives on as its own snapshot resource (see
 * `buildPreliminaryReportSnapshot`) and that is what gets resolved here. The snapshot has no AdvaPACS
 * identifier, so correcting it after finalization stays local — by then the PACS copy holds the final read.
 */
const resolvePreliminaryReportToEdit = (diagnosticReports: DiagnosticReport[]): DiagnosticReport => {
  const preliminaryReport = takeMostRecentPreliminaryReport(diagnosticReports);
  if (!preliminaryReport?.id) {
    throw RADIOLOGY_ERROR('This order has no preliminary read to edit.');
  }

  return preliminaryReport;
};

/**
 * Only the provider who ordered the study and wrote the read may correct a final read. Teleradiology's
 * reports arrive from AdvaPACS with no author of ours recorded, which is what keeps them out of reach here.
 * The order list decides the same thing for the UI affordance; see `canCallerEditFinalReport`.
 */
const resolveFinalReportToEdit = async (
  diagnosticReports: DiagnosticReport[],
  serviceRequest: ServiceRequest,
  encounter: Encounter | undefined,
  auth: { callerAccessToken: string; secrets: Secrets }
): Promise<DiagnosticReport> => {
  const finalReport = takeTheBestFinalDiagnosticReport(diagnosticReports);
  if (!finalReport?.id) {
    throw RADIOLOGY_ERROR('This order has no final read to edit.');
  }

  const callerPractitionerId = await getMyPractitionerId(auth.callerAccessToken, auth.secrets);
  const wroteIt = getReportAuthorId(finalReport) === callerPractitionerId;
  const orderedIt = getOrderingProviderIds(serviceRequest, encounter).includes(callerPractitionerId);

  if (!wroteIt || !orderedIt) {
    throw RADIOLOGY_ERROR('Only the ordering provider who wrote this final read can edit it.');
  }

  return finalReport;
};

/**
 * Replays the whole AdvaPACS DiagnosticReport with a new `presentedForm` — AdvaPACS is a plain FHIR server,
 * so a read-modify-PUT is the update, the same shape cancel-order uses to revoke a ServiceRequest. No retry
 * wrapper: a provider is waiting on this click and the UI surfaces the failure (see `advaPacsFetch`).
 */
const updateReportInAdvaPACS = async (advaPacsReportId: string, report: string, secrets: Secrets): Promise<void> => {
  const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
  const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
  const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;
  const url = `${ADVAPACS_FHIR_BASE_URL}/DiagnosticReport/${advaPacsReportId}`;
  const headers = {
    'Content-Type': 'application/fhir+json',
    Authorization: advapacsAuthString,
  };

  const getResponse = await fetch(url, { method: 'GET', headers });
  await throwIfNotOk(getResponse, 'fetch');
  const advaPacsReport: DiagnosticReport5 = await getResponse.json();

  const reportAsBase64 = encodeRadiologyReport(report);
  const putResponse = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      ...advaPacsReport,
      presentedForm: [
        {
          contentType: 'text/html',
          data: reportAsBase64,
          // AdvaPACS speaks FHIR R5, where Attachment.size is an integer64 — serialized as a string.
          size: `${Buffer.byteLength(reportAsBase64)}`,
        },
      ],
    }),
  });
  await throwIfNotOk(putResponse, 'update');
};

const throwIfNotOk = async (response: Response, attempted: string): Promise<void> => {
  if (response.ok) return;
  throw new Error(
    `AdvaPACS DiagnosticReport ${attempted} errored out with statusCode ${response.status}, status text ${
      response.statusText
    }, and body ${JSON.stringify(await response.json(), null, 2)}`
  );
};
