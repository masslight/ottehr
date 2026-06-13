import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Encounter, Patient, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ORDER_TYPE_CODE_SYSTEM, SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL } from 'utils';
import { createOystehrClient, getAuth0Token, searchAllFhirAsync, wrapHandler, ZambdaInput } from '../../shared';

interface RadiologyStudyReportItem {
  serviceRequestId: string;
  patientName?: string;
  appointmentId: string;
}

let oystehrToken: string;

const ZAMBDA_NAME = 'daily-radiology-report';

/**
 * This zambda checks for any radiology studies that have been stuck in preliminary status to long and throws if it finds any
 * It provides observability into radiology studies that need attention
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  const { secrets } = input;

  // Get M2M token for FHIR access
  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }

  const oystehr = createOystehrClient(oystehrToken, secrets);

  const oneMonthAgo = DateTime.now().toUTC().minus({ days: 30 }).startOf('day');
  const now = DateTime.now().toUTC();

  console.log(`Fetching radiology studies for date range: ${oneMonthAgo.toISO()} to ${now.toISO()}`);

  // Fetch the full 30-day window in a single async-bulk FHIR search. The async-bulk workflow is
  // not subject to the response payload size limit, so it replaces the previous 3-day batching
  // workaround (and the associated cross-batch de-duplication).
  const allResources = await searchAllFhirAsync<ServiceRequest | DiagnosticReport | Encounter | Patient>(oystehr, {
    resourceType: 'ServiceRequest',
    params: [
      { name: '_tag', value: `${ORDER_TYPE_CODE_SYSTEM}|radiology` },
      { name: 'status:not', value: 'revoked' },
      { name: 'authored', value: `ge${oneMonthAgo.toISO()}` },
      { name: 'authored', value: `le${now.toISO()}` },
      { name: '_revinclude', value: 'DiagnosticReport:based-on' },
      { name: '_include', value: 'ServiceRequest:encounter' },
      { name: '_include', value: 'ServiceRequest:subject' },
    ],
  });

  const serviceRequests = allResources.filter((r): r is ServiceRequest => r.resourceType === 'ServiceRequest');
  const diagnosticReports = allResources.filter((r): r is DiagnosticReport => r.resourceType === 'DiagnosticReport');
  const encounters = allResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const patients = allResources.filter((r): r is Patient => r.resourceType === 'Patient');

  console.log(`Found ${serviceRequests.length} radiology studies`);

  if (serviceRequests.length === 0) {
    const message = `No radiology studies found since ${oneMonthAgo.toFormat('yyyy-MM-dd')}`;
    console.log(message);

    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  }

  // Parse studies into report items
  const studiesAwaitingFinalReportMoreThan24Hours: RadiologyStudyReportItem[] = serviceRequests
    .map((serviceRequest): RadiologyStudyReportItem | undefined => {
      if (!serviceRequest.id) {
        throw new Error('ServiceRequest is missing id');
      }
      const encounterId = serviceRequest.encounter?.reference?.split('/')[1];
      const encounter = encounters.find((e) => e.id === encounterId);
      const appointmentId = encounter?.appointment?.[0]?.reference?.split('/')[1] || '';

      const patientId = serviceRequest.subject?.reference?.split('/')[1];
      const patient = patients.find((p) => p.id === patientId);
      const patientName = patient?.name?.[0]
        ? `${patient.name[0].family}, ${patient.name[0].given?.[0] || ''}`
        : undefined;

      // Determine status based on service request and diagnostic reports
      const relatedDiagnosticReports = diagnosticReports.filter(
        (report) => report.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`)
      );

      const maybeNeedsToBeSentForTeleradTime = serviceRequest?.extension?.find(
        (ext) => ext.url === SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL
      )?.valueDateTime;

      if (!maybeNeedsToBeSentForTeleradTime) {
        return; // requesting telerad is optional, if it was not requested then all is well and the report can't be late.
      }

      const needsToBeSentTime = DateTime.fromISO(maybeNeedsToBeSentForTeleradTime).toUTC();
      const now = DateTime.now().toUTC();
      const timeSinceNeedsToBeSent = now.diff(needsToBeSentTime, 'hours').hours;

      const finalReport = relatedDiagnosticReports.find(
        (r) => r.status === 'final' || r.status === 'amended' || r.status === 'corrected'
      );

      if (!finalReport && timeSinceNeedsToBeSent > 24) {
        return {
          serviceRequestId: serviceRequest.id,
          patientName,
          appointmentId,
        };
      }

      return undefined;
    })
    .filter((maybeStudyReportItem) => maybeStudyReportItem !== undefined);

  if (studiesAwaitingFinalReportMoreThan24Hours.length > 0) {
    let outputStrings = '';
    outputStrings += 'Studies awaiting final report for more than 24 hours:';
    studiesAwaitingFinalReportMoreThan24Hours.forEach((study) => {
      outputStrings += `\nServiceRequest/${study.serviceRequestId}, Patient: ${
        study.patientName || 'Unknown'
      }, Appointment ID: ${study.appointmentId}`;
    });
    console.log(outputStrings);
    throw new Error(outputStrings);
  } else {
    console.log('No studies are awaiting final report for more than 24 hours.');
  }

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});
