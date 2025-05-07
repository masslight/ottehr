import { GetInHouseOrdersParameters } from 'utils';
import { ZambdaInput } from '../../shared';

export type GetZambdaInHouseOrdersParams = GetInHouseOrdersParameters & { secrets: any; userToken: string };

export function validateRequestParameters(input: ZambdaInput): GetZambdaInHouseOrdersParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const params = JSON.parse(input.body) as GetInHouseOrdersParameters;

  if (!params.searchBy.field || !params.searchBy.value) {
    throw new Error(`Missing searchBy field or value: ${JSON.stringify(params.searchBy)}`);
  }

  if (typeof params.itemsPerPage !== 'number' || isNaN(params.itemsPerPage) || params.itemsPerPage < 1) {
    throw new Error('Invalid parameter: itemsPerPage must be a number greater than 0');
  }

  if (typeof params.pageIndex !== 'number' || isNaN(params.pageIndex) || params.pageIndex < 0) {
    throw new Error('Invalid parameter: pageIndex must be a number greater than or equal to 0');
  }

  // todo: validate params

  return {
    ...params,
    secrets: input.secrets,
    userToken: input.headers.Authorization.replace('Bearer ', ''),
  };
}
