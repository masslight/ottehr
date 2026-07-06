import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter } from 'fhir/r4b';
import {
  FaxDocumentType,
  GetFaxDocumentsOutput,
  LAB_RESULT_DOC_REF_CODING_CODE,
  PATIENT_EDUCATION_DOC_TYPE_CODE,
  progressNoteChartDataRequestedFields,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createClinicalOystehrClient } from '../../shared/helpers';
import {
  hasPatientInstructionsContent,
  hasPrescriptionsContent,
  hasRadiologyResultsContent,
} from '../../shared/pdf/fax-documents-pdf';
import { AllChartData } from '../../shared/pdf/visit-details-pdf/types';
import { getChartData } from '../get-chart-data';
import { searchVisitDocumentReferences } from '../send-fax/helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-fax-documents';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters()');
  const { appointmentId, secrets } = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters() success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await performEffect(oystehr, appointmentId);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const performEffect = async (oystehr: Oystehr, appointmentId: string): Promise<GetFaxDocumentsOutput> => {
  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: 'appointment', value: `Appointment/${appointmentId}` }],
    })
  ).unbundle();
  // Follow-up encounters reference the main encounter via partOf; chart data lives on the main one.
  const encounter = encounters.find((candidate) => !candidate.partOf) ?? encounters[0];
  if (!encounter?.id) {
    throw new Error(`No encounter found for appointment ${appointmentId}`);
  }

  const [chartDataResult, additionalChartDataResult, labDocRefs, educationDocRefs] = await Promise.all([
    getChartData(oystehr, m2mToken, encounter.id),
    getChartData(oystehr, m2mToken, encounter.id, progressNoteChartDataRequestedFields),
    searchVisitDocumentReferences(
      oystehr,
      encounter.id,
      `${LAB_RESULT_DOC_REF_CODING_CODE.system}|${LAB_RESULT_DOC_REF_CODING_CODE.code}`
    ),
    searchVisitDocumentReferences(oystehr, encounter.id, PATIENT_EDUCATION_DOC_TYPE_CODE),
  ]);

  const allChartData: AllChartData = {
    chartData: chartDataResult.response,
    additionalChartData: additionalChartDataResult.response,
  };

  const hasPdfAttachment = (docRefs: Awaited<ReturnType<typeof searchVisitDocumentReferences>>): boolean =>
    docRefs.some(
      (docRef) =>
        docRef.content?.some(
          (content) =>
            content.attachment?.url &&
            (!content.attachment.contentType || content.attachment.contentType === 'application/pdf')
        )
    );

  const availableDocuments: FaxDocumentType[] = [
    // The discharge summary and visit note are generated on demand, so they can always be faxed.
    'discharge-summary',
    'visit-note',
    ...(hasPdfAttachment(labDocRefs) ? (['lab-results'] as const) : []),
    ...(hasRadiologyResultsContent(allChartData) ? (['radiology-results'] as const) : []),
    ...(hasPrescriptionsContent(allChartData) ? (['prescriptions'] as const) : []),
    ...(hasPatientInstructionsContent(allChartData) ? (['patient-instructions'] as const) : []),
    ...(hasPdfAttachment(educationDocRefs) ? (['patient-education'] as const) : []),
  ];

  return { availableDocuments };
};
