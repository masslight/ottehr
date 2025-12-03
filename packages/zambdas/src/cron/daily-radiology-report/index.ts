import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Encounter, Patient, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getSecret, SecretsKeys } from 'utils';
import {
  DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL,
  ORDER_TYPE_CODE_SYSTEM,
} from '../../ehr/radiology/shared';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';

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

  try {
    // Get M2M token for FHIR access
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    const oneMonthAgo = DateTime.now().toUTC().minus({ days: 30 }).startOf('day');
    const dateRange = {
      start: oneMonthAgo.toISO()!,
      end: DateTime.now().toUTC().toISO()!,
    };

    console.log(`Fetching radiology studies for date range: ${dateRange.start} to ${dateRange.end}`);

    // Search for radiology service requests within the date range
    const searchParams: { name: string; value: string }[] = [
      { name: '_tag', value: `${ORDER_TYPE_CODE_SYSTEM}|radiology` },
      { name: 'status:not', value: 'revoked' },
      { name: 'authored', value: `ge${dateRange.start}` },
      { name: 'authored', value: `le${dateRange.end}` },
      { name: '_count', value: '1000' },
      { name: '_revinclude', value: 'DiagnosticReport:based-on' },
      { name: '_include', value: 'ServiceRequest:encounter' },
      { name: '_include', value: 'ServiceRequest:subject' },
    ];

    const searchResponse = await oystehr.fhir.search({
      resourceType: 'ServiceRequest',
      params: searchParams,
    });

    const allResources = searchResponse.unbundle();

    const serviceRequests = allResources.filter((r) => r.resourceType === 'ServiceRequest') as ServiceRequest[];
    const diagnosticReports = allResources.filter((r) => r.resourceType === 'DiagnosticReport') as DiagnosticReport[];
    const encounters = allResources.filter((r) => r.resourceType === 'Encounter') as Encounter[];
    const patients = allResources.filter((r) => r.resourceType === 'Patient') as Patient[];

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

        const preliminaryReport = relatedDiagnosticReports.find((r) => r.status === 'preliminary');
        const maybePreliminaryReportTime = preliminaryReport?.extension?.find(
          (ext) => ext.url === DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL
        )?.valueDateTime;

        if (!preliminaryReport) {
          return;
        }

        if (!maybePreliminaryReportTime) {
          throw new Error(
            `Preliminary report for ServiceRequest/${serviceRequest.id} is missing preliminary review time extension`
          );
        }

        const preliminaryReportTime = DateTime.fromISO(maybePreliminaryReportTime).toUTC();
        const now = DateTime.now().toUTC();
        const timeSincePreliminary = now.diff(preliminaryReportTime, 'hours').hours;

        const finalReport = relatedDiagnosticReports.find(
          (r) => r.status === 'final' || r.status === 'amended' || r.status === 'corrected'
        );

        if (preliminaryReport && !finalReport && timeSincePreliminary > 24) {
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
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
