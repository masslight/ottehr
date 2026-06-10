import {
  DeleteAdHocReportInput,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): DeleteAdHocReportInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { reportId } = JSON.parse(input.body);

  if (typeof reportId !== 'string' || reportId.trim().length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['reportId']);
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  return { reportId, secrets: input.secrets };
}
