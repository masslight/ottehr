import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import {
  CreateDischargeSummaryInputValidated,
  CreateDischargeSummaryResponse,
} from 'utils/lib/types/api/create-discharge-summary/create-discharge-summary.types';
import { PATIENT_EDUCATION_DOC_TYPE_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { Secrets } from 'utils/lib/secrets';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { fetchErxPharmacies } from '../../shared/erx';
import { createDischargeSummaryPdf } from '../../shared/pdf/discharge-summary-pdf';
import { getUpcomingFollowUps } from '../../shared/pdf/get-upcoming-follow-ups';
import { makeDischargeSummaryPdfDocumentReference } from '../../shared/pdf/make-discharge-summary-document-reference';
import { countPdfPages, downloadPdfBytes, mergePdfDocuments } from '../../shared/pdf/merge-pdfs';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { getChartData } from '../get-chart-data';
import { getMedicationOrders } from '../get-medication-orders';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'create-discharge-summary',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    console.log(`create-discharge-summary started, input: ${JSON.stringify(input)}`);

    let validatedParameters: CreateDischargeSummaryInputValidated;

    try {
      validatedParameters = validateRequestParameters(input);
    } catch (error: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `Invalid request parameters. ${error.message || error}`,
        }),
      };
    }

    const { appointmentId, timezone, secrets } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, appointmentId, secrets, timezone);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  appointmentId: string,
  secrets: Secrets | null,
  timezone?: string
): Promise<CreateDischargeSummaryResponse> => {
  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }
  if (timezone) {
    // if the timezone is provided, it will be taken as the tz to use here rather than the location's schedule
    // this allows the provider to specify their working location in the case of virtual encounters
    visitResources.timezone = timezone;
  }
  const { encounter, patient, listResources } = visitResources;

  const chartDataPromise = getChartData(oystehr, m2mToken, encounter.id!);
  const additionalChartDataPromise = getChartData(
    oystehr,
    m2mToken,
    encounter.id!,
    progressNoteChartDataRequestedFields
  );

  const medicationOrdersPromise = getMedicationOrders(oystehr, {
    searchBy: {
      field: 'encounterId',
      value: encounter.id!,
    },
  });

  const followUpParentEncounterId = encounter.partOf?.reference?.split('/')[1] ?? encounter.id!;
  const upcomingFollowUpsPromise = getUpcomingFollowUps(
    oystehr,
    followUpParentEncounterId,
    visitResources.timezone,
    encounter.id
  );

  const [chartDataResult, additionalChartDataResult, medicationOrdersData, upcomingFollowUps] = await Promise.all([
    chartDataPromise,
    additionalChartDataPromise,
    medicationOrdersPromise,
    upcomingFollowUpsPromise,
  ]);
  const chartData = chartDataResult.response;
  const additionalChartData = additionalChartDataResult.response;
  const medicationOrders = medicationOrdersData?.orders.filter((order) => order.status !== 'cancelled');

  console.log('Chart data received');
  const erxPharmacies = await fetchErxPharmacies(oystehr, additionalChartData?.prescribedMedications);

  const { pdfInfo, attached } = await createDischargeSummaryPdf(
    {
      allChartData: {
        chartData,
        additionalChartData,
        medicationOrders,
      },
      appointmentPackage: visitResources,
      upcomingFollowUps,
      erxPharmacies,
    },
    secrets,
    m2mToken
  );

  if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);

  // Append patient education PDFs if any exist
  try {
    const educationDocRefs = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'encounter', value: `Encounter/${encounter.id}` },
          { name: 'type', value: PATIENT_EDUCATION_DOC_TYPE_CODE },
          { name: 'status', value: 'current' },
        ],
      })
    ).unbundle();

    if (educationDocRefs.length > 0) {
      console.log(`Found ${educationDocRefs.length} patient education PDF(s) to append`);

      const dischargeBytes = await downloadPdfBytes(pdfInfo.uploadURL, m2mToken);
      const parts: Uint8Array[] = [dischargeBytes];

      for (const docRef of educationDocRefs) {
        const z3Url = docRef.content?.[0]?.attachment?.url;
        if (!z3Url) continue;
        try {
          const eduBytes = await downloadPdfBytes(z3Url, m2mToken);

          // parses the document so a malformed PDF is caught (and skipped) here rather than at merge time
          await countPdfPages(eduBytes);

          parts.push(eduBytes);
          console.log(`Appended education PDF from DocumentReference/${docRef.id}`);
        } catch (err) {
          console.error(`Failed to append education PDF DocumentReference/${docRef.id}:`, err);
          captureException(err);
        }
      }

      // Re-upload the merged PDF to the same Z3 URL
      const { bytes: mergedBytes } = await mergePdfDocuments(parts);
      const uploadUrl = await createPresignedUrl(m2mToken, pdfInfo.uploadURL, 'upload');
      await uploadObjectToZ3(mergedBytes, uploadUrl);
      console.log('Re-uploaded merged discharge summary with education PDFs');
    }
  } catch (err) {
    console.error('Failed to merge education PDFs into discharge summary:', err);
    captureException(err);
    // Non-fatal: proceed with the discharge summary without education PDFs
  }

  console.log(`Creating discharge summary pdf Document Reference`);
  const documentReference = await makeDischargeSummaryPdfDocumentReference(
    oystehr,
    pdfInfo,
    patient.id,
    appointmentId,
    encounter.id!,
    listResources,
    attached
  );
  const dischargeSummaryDocumentId = documentReference.id ?? '';

  return {
    message: 'Discharge Summary created.',
    documentId: dischargeSummaryDocumentId,
  };
};
