import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CreatePatientInstructionsPdfInputValidated,
  CreatePatientInstructionsPdfResponse,
  progressNoteChartDataRequestedFields,
  Secrets,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { makePatientInstructionsPdfDocumentReference } from '../../shared/pdf/make-patient-instructions-document-reference';
import { createPatientInstructionsPdf } from '../../shared/pdf/patient-instructions-pdf';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { getChartData } from '../get-chart-data';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'create-patient-instructions-pdf',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    console.log(`create-patient-instructions-pdf started, input: ${JSON.stringify(input)}`);

    let validatedParameters: CreatePatientInstructionsPdfInputValidated;

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

    const { appointmentId, secrets } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, appointmentId, secrets);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  appointmentId: string,
  secrets: Secrets | null
): Promise<CreatePatientInstructionsPdfResponse> => {
  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
  }

  const { encounter, patient, listResources } = visitResources;

  const [chartDataResult, additionalChartDataResult] = await Promise.all([
    getChartData(oystehr, m2mToken, encounter.id!),
    getChartData(oystehr, m2mToken, encounter.id!, progressNoteChartDataRequestedFields),
  ]);

  const chartData = chartDataResult.response;
  const additionalChartData = additionalChartDataResult.response;

  console.log('Chart data received');
  const { pdfInfo } = await createPatientInstructionsPdf(
    {
      allChartData: { chartData, additionalChartData },
      appointmentPackage: visitResources,
    },
    secrets,
    m2mToken
  );

  if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
  console.log('Creating patient instructions PDF document reference');
  const documentReference = await makePatientInstructionsPdfDocumentReference(
    oystehr,
    pdfInfo,
    patient.id,
    appointmentId,
    encounter.id!,
    listResources
  );
  const documentId = documentReference.id ?? '';

  return {
    message: 'Patient Instructions PDF created.',
    documentId,
  };
};
