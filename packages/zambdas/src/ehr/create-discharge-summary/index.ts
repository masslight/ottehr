import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CreateDischargeSummaryInputValidated,
  CreateDischargeSummaryResponse,
  getProgressNoteChartDataRequestedFields,
  getSecret,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { composeAndCreateDischargeSummaryPdf } from '../../shared/pdf/discharge-summary-pdf';
import { makeDischargeSummaryPdfDocumentReference } from '../../shared/pdf/make-discharge-summary-document-reference';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { getChartData } from '../get-chart-data';
import { getInHouseResources } from '../get-in-house-orders/helpers';
import { getLabResources } from '../get-lab-orders/helpers';
import { getRadiologyOrders } from '../radiology/order-list';
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

    try {
      const { appointmentId, timezone, secrets } = validatedParameters;

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);
      console.log('Created Oystehr client');

      const response = await performEffect(oystehr, appointmentId, secrets, timezone);
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      await topLevelCatch('create-discharge-summary', error, ENVIRONMENT);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: `Error processing request: ${error.message || error}`,
        }),
      };
    }
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
    getProgressNoteChartDataRequestedFields()
  );

  const radiologyOrdersPromise = getRadiologyOrders(oystehr, {
    encounterIds: [encounter.id!],
  });

  const externalLabOrdersPromise = getLabResources(
    oystehr,
    {
      searchBy: { field: 'encounterId', value: encounter.id! },
      itemsPerPage: 10,
      pageIndex: 0,
      secrets,
    },
    m2mToken,
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
    m2mToken
  );

  const [chartDataResult, additionalChartDataResult, radiologyData, externalLabsData, inHouseOrdersData] =
    await Promise.all([
      chartDataPromise,
      additionalChartDataPromise,
      radiologyOrdersPromise,
      externalLabOrdersPromise,
      inHouseOrdersPromise,
    ]);
  const chartData = chartDataResult.response;
  const additionalChartData = additionalChartDataResult.response;

  console.log('Chart data received');
  const pdfInfo = await composeAndCreateDischargeSummaryPdf(
    { chartData, additionalChartData, radiologyData, externalLabsData, inHouseOrdersData },
    visitResources,
    secrets,
    m2mToken
  );
  if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
  console.log(`Creating discharge summary pdf Document Reference`);
  const documentReference = await makeDischargeSummaryPdfDocumentReference(
    oystehr,
    pdfInfo,
    patient.id,
    appointmentId,
    encounter.id!,
    listResources
  );

  return {
    message: 'Discharge Summary created.',
    documentId: documentReference.id ?? '',
  };
};
