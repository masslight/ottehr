import { DEFAULT_LABS_ITEMS_PER_PAGE, GetInHouseOrdersParameters } from 'utils';
import { ZambdaInput } from '../../shared';

export type GetZambdaInHouseOrdersParams = GetInHouseOrdersParameters & {
  secrets: any;
  userToken: string;
};

export function validateRequestParameters(input: ZambdaInput): GetZambdaInHouseOrdersParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  let params: GetInHouseOrdersParameters;

  try {
    params = JSON.parse(input.body) as GetInHouseOrdersParameters;
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }

  const { searchBy, visitDate, itemsPerPage = DEFAULT_LABS_ITEMS_PER_PAGE, pageIndex = 0 } = params;

  if (!searchBy?.field || !searchBy?.value) {
    throw new Error(`Missing searchBy field or value: ${JSON.stringify(searchBy)}`);
  }

  const validFields = ['encounterId', 'patientId', 'serviceRequestId'];
  if (!validFields.includes(searchBy.field)) {
    throw new Error(`Invalid searchBy field. Must be one of: ${validFields.join(', ')}`);
  }

  if (typeof itemsPerPage !== 'number' || isNaN(itemsPerPage) || itemsPerPage < 1) {
    throw new Error('Invalid parameter: itemsPerPage must be a number greater than 0');
  }

  if (typeof pageIndex !== 'number' || isNaN(pageIndex) || pageIndex < 0) {
    throw new Error('Invalid parameter: pageIndex must be a number greater than or equal to 0');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  if (!userToken) {
    throw new Error('Invalid Authorization header format');
  }

  return {
    searchBy,
    visitDate,
    itemsPerPage,
    pageIndex,
    secrets: input.secrets,
    userToken,
  };
}
