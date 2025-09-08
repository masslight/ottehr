import { APIGatewayProxyResult } from 'aws-lambda';
import { EMPTY_PAGINATION, getSecret, ReflexLabDTO, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getLabResources, mapReflexResourcesToDrLabDTO, mapResourcesToLabOrderDTOs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('get-lab-orders', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, searchBy } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const {
      serviceRequests,
      tasks,
      diagnosticReports,
      reflexDRsAndRelatedResources,
      practitioners,
      pagination,
      encounters,
      locations,
      appointments,
      provenances,
      organizations,
      questionnaires,
      resultPDFs,
      labelPDF,
      orderPDF,
      specimens,
      patientLabItems,
      appointmentScheduleMap,
    } = await getLabResources(oystehr, validatedParameters, m2mToken, {
      searchBy: validatedParameters.searchBy,
    });

    if (!serviceRequests.length) {
      console.log('no serviceRequests found, returning empty data array');
      return {
        statusCode: 200,
        body: JSON.stringify({
          data: [],
          pagination: EMPTY_PAGINATION,
        }),
      };
    }

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    const labOrders = mapResourcesToLabOrderDTOs(
      { searchBy },
      serviceRequests,
      tasks,
      diagnosticReports,
      practitioners,
      encounters,
      locations,
      appointments,
      provenances,
      organizations,
      questionnaires,
      resultPDFs,
      labelPDF,
      orderPDF,
      specimens,
      appointmentScheduleMap,
      ENVIRONMENT
    );

    // todo future can probably refactor to do less data massaging for when this is being called from the table view
    let reflexLabDTOs: ReflexLabDTO[] = [];
    if (reflexDRsAndRelatedResources) {
      reflexLabDTOs = await mapReflexResourcesToDrLabDTO(reflexDRsAndRelatedResources, m2mToken);
    }
    console.log('reflexLabDTOs', JSON.stringify(reflexLabDTOs));

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: labOrders,
        reflexResults: reflexLabDTOs,
        pagination,
        ...(patientLabItems && { patientLabItems }),
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('get-lab-orders', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error fetching external lab orders: ${error}` }),
    };
  }
});
