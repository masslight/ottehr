import { INVALID_INPUT_ERROR } from 'utils';
import { ZambdaInput } from '../../shared';
import { toNonNegativeInt } from '../shared';

export interface GetBillingClaimsParams {
  searchText?: string;
  status?: string;
  dosFrom?: string;
  dosTo?: string;
  payerName?: string;
  payerId?: string;
  patientId?: string;
  offset?: number;
  pageSize?: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingClaimsParams {
  if (!input.body) return { secrets: input.secrets };

  let body: any;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  return {
    searchText: body.searchText,
    status: body.status,
    dosFrom: body.dosFrom,
    dosTo: body.dosTo,
    payerName: body.payerName,
    payerId: body.payerId,
    patientId: body.patientId,
    offset: toNonNegativeInt(body.offset, 'offset'),
    pageSize: toNonNegativeInt(body.pageSize, 'pageSize'),
    secrets: input.secrets,
  };
}
