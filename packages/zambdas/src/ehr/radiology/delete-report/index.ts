import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, FhirResource, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PRELIMINARY_READ_DELETED_PROVENANCE_ACTIVITY_CODING } from 'utils/lib/fhir/constants';
import { ADVAPACS_FHIR_BASE_URL, ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { DeleteRadiologyReportZambdaOutput } from 'utils/lib/types/api/radiology';
import { RADIOLOGY_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import {
  fetchOrderResources,
  getPacsReportId,
  isRadiologyOrderReviewed,
  resolveReportForCaller,
  takeTheBestFinalDiagnosticReport,
} from '../../../shared/radiology';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { throwIfNotOk } from '../shared/advapacs';
import { buildTeleradiologyStripOperations } from './helpers';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'radiology-delete-report';

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
): Promise<DeleteRadiologyReportZambdaOutput> {
  const { serviceRequestId, reportType } = validatedInput.body;

  console.group('Fetching the order and its reports from Oystehr');
  const { serviceRequest, diagnosticReports, encounter, tasks } = await fetchOrderResources(serviceRequestId, oystehr);
  console.groupEnd();

  if (isRadiologyOrderReviewed(tasks, serviceRequestId)) {
    throw RADIOLOGY_ERROR('This order has already been reviewed, its reads can no longer be deleted.');
  }

  const { report: diagnosticReport, callerPractitionerId } = await resolveReportForCaller(
    reportType,
    diagnosticReports,
    serviceRequest,
    encounter,
    { callerAccessToken: validatedInput.callerAccessToken, secrets },
    'delete'
  );

  const hasFinalRead = !!takeTheBestFinalDiagnosticReport(diagnosticReports);
  const advaPacsReportId = hasFinalRead ? undefined : getPacsReportId(diagnosticReport);

  if (hasFinalRead) {
    console.log(
      `ServiceRequest/${serviceRequestId} has a final read, which owns the AdvaPACS report; deleting only our preliminary read.`
    );
  } else if (advaPacsReportId) {
    console.group('Deleting the DiagnosticReport in AdvaPACS');
    await deleteReportInAdvaPACS(advaPacsReportId, secrets);
    console.groupEnd();
    console.debug('AdvaPACS DiagnosticReport deleted successfully');
  } else {
    console.warn(
      `DiagnosticReport/${diagnosticReport.id} carries no AdvaPACS identifier; skipping the AdvaPACS delete.`
    );
  }

  console.group('Deleting the DiagnosticReport in Oystehr');
  const reportIdsToDelete = await collectReportIdsToDelete(
    diagnosticReport,
    serviceRequestId,
    advaPacsReportId,
    oystehr
  );
  const requests: BatchInputRequest<FhirResource>[] = reportIdsToDelete.map((reportId) => ({
    method: 'DELETE',
    url: `DiagnosticReport/${reportId}`,
  }));

  const teleradiologyStripOperations = hasFinalRead ? [] : buildTeleradiologyStripOperations(serviceRequest);
  if (teleradiologyStripOperations.length > 0) {
    requests.push({
      method: 'PATCH',
      url: `ServiceRequest/${serviceRequestId}`,
      operations: teleradiologyStripOperations,
    });
  }

  requests.push({
    method: 'POST',
    url: '/Provenance',
    resource: {
      resourceType: 'Provenance',
      target: [
        { reference: `DiagnosticReport/${diagnosticReport.id}` },
        { reference: `ServiceRequest/${serviceRequestId}` },
      ],
      recorded: DateTime.now().toISO(),
      agent: [{ who: { reference: `Practitioner/${callerPractitionerId}` } }],
      activity: { coding: [PRELIMINARY_READ_DELETED_PROVENANCE_ACTIVITY_CODING] },
    } as Provenance,
  });

  await oystehr.fhir.transaction({ requests });
  console.groupEnd();
  console.debug('DiagnosticReport deleted successfully');

  return {};
}

const collectReportIdsToDelete = async (
  diagnosticReport: DiagnosticReport,
  serviceRequestId: string,
  advaPacsReportId: string | undefined,
  oystehr: Oystehr
): Promise<string[]> => {
  if (!advaPacsReportId) {
    return [diagnosticReport.id].filter((reportId): reportId is string => !!reportId);
  }

  const mirroredReports = (
    await oystehr.fhir.search<DiagnosticReport>({
      resourceType: 'DiagnosticReport',
      params: [
        { name: 'based-on', value: `ServiceRequest/${serviceRequestId}` },
        { name: 'identifier', value: `${ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM}|${advaPacsReportId}` },
      ],
    })
  ).unbundle();

  const reportIds = [
    ...new Set(
      [diagnosticReport.id, ...mirroredReports.map((report) => report.id)].filter(
        (reportId): reportId is string => !!reportId
      )
    ),
  ];

  if (reportIds.length > 1) {
    console.log(
      `Deleting ${
        reportIds.length
      } DiagnosticReports mirroring AdvaPACS DiagnosticReport/${advaPacsReportId}: ${reportIds.join(', ')}`
    );
  }

  return reportIds;
};

const deleteReportInAdvaPACS = async (advaPacsReportId: string, secrets: Secrets): Promise<void> => {
  const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
  const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
  const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

  const response = await fetch(`${ADVAPACS_FHIR_BASE_URL}/DiagnosticReport/${advaPacsReportId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/fhir+json',
      Authorization: advapacsAuthString,
    },
  });

  if (response.status === 404 || response.status === 410) {
    console.warn(`AdvaPACS DiagnosticReport/${advaPacsReportId} was already gone (${response.status}).`);
    return;
  }

  await throwIfNotOk(response, 'delete');
};
