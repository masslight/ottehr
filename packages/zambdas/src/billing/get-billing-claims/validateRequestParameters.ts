import { INVALID_INPUT_ERROR } from 'utils';
import { ZambdaInput } from '../../shared';

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

function toNonNegativeInt(value: unknown, name: string): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw INVALID_INPUT_ERROR(`"${name}" must be a non-negative integer`);
  return n;
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
