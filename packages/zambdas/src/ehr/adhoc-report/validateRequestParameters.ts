import { AdHocReportRequest, validateAdHocReportRequest } from '../../shared/adhoc-report';
import { ZambdaInput } from '../../shared/types/common';

export type ValidatedParams = AdHocReportRequest;

export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  return validateAdHocReportRequest(input);
}
