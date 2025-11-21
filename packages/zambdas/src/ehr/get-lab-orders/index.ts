import { APIGatewayProxyResult } from 'aws-lambda';
import { EMPTY_PAGINATION, getSecret, PdfAttachmentDTO, ReflexLabDTO, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import {
  checkForDiagnosticReportDrivenResults,
  getLabResources,
  mapResourcesToDrLabDTO,
  mapResourcesToLabOrderDTOs,
} from './helpers';
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

    console.log('searchBy:', JSON.stringify(searchBy));

    // todo labs future can probably refactor to do less data massaging for when this is being called from the table view
    let drDrivenResults: (ReflexLabDTO | PdfAttachmentDTO)[] = [];

    // for reflex results, should only be called from the detail page
    if (searchBy.field === 'diagnosticReportId') {
      const drResources = await checkForDiagnosticReportDrivenResults({
        oystehr,
        searchBy: { search: 'detail', drId: searchBy.value },
        environment: secrets.ENVIRONMENT,
      });
      if (!drResources) throw Error(`could not find resources for ${JSON.stringify(searchBy)}`);
      const drDrivenResults = await mapResourcesToDrLabDTO(drResources, m2mToken);
      console.log('search param is diagnosticReportId, returning drDrivenResults only');
      return {
        statusCode: 200,
        body: JSON.stringify({
          data: [],
          drDrivenResults,
          pagination: EMPTY_PAGINATION,
        }),
      };
    }

    const {
      serviceRequests,
      tasks,
      diagnosticReports,
      diagnosticReportDrivenResultResources,
      practitioners,
      pagination,
      encounters,
      locations,
      appointments,
      provenances,
      organizations,
      questionnaires,
      labGeneratedResults,
      resultPDFs,
      labelPDF,
      orderPDF,
      abnPDFsByRequisitionNumber,
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
      labGeneratedResults,
      resultPDFs,
      labelPDF,
      orderPDF,
      abnPDFsByRequisitionNumber,
      specimens,
      appointmentScheduleMap,
      ENVIRONMENT
    );

    if (diagnosticReportDrivenResultResources) {
      drDrivenResults = await mapResourcesToDrLabDTO(diagnosticReportDrivenResultResources, m2mToken);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: labOrders,
        drDrivenResults,
        pagination,
        ...(patientLabItems && { patientLabItems }),
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-lab-orders', error, ENVIRONMENT);
  }
});
