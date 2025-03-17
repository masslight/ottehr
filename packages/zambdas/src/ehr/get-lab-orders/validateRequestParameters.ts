import { DEFAULT_LABS_ITEMS_PER_PAGE, GetLabOrdersParameters } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export type GetZambdaLabOrdersParams = GetLabOrdersParameters & { secrets: any };

export function validateRequestParameters(input: ZambdaInput): GetZambdaLabOrdersParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const {
    encounterId,
    patientId,
    testType,
    visitDate,
    itemsPerPage = DEFAULT_LABS_ITEMS_PER_PAGE,
    pageIndex = 0,
  } = JSON.parse(input.body);

  if (!encounterId && !patientId) {
    throw new Error('Missing required parameter: either encounterId or patientId must be provided');
  }

  if (typeof itemsPerPage !== 'number' || isNaN(itemsPerPage) || itemsPerPage < 1) {
    throw new Error('Invalid parameter: itemsPerPage must be a number greater than 0');
  }

  if (typeof pageIndex !== 'number' || isNaN(pageIndex) || pageIndex < 0) {
    throw new Error('Invalid parameter: pageIndex must be a number greater than or equal to 0');
  }

  return {
    encounterId,
    patientId,
    testType,
    visitDate,
    itemsPerPage,
    pageIndex,
    secrets: input.secrets,
  };
}
