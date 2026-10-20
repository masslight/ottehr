import { BILLING_CLAIMS_DATASET_ID } from 'utils/lib/types/adhoc/datasets/billing-claims';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { AdHocReportRequest, validateAdHocReportRequest } from '../../shared/adhoc-report';
import { ZambdaInput } from '../../shared/types/common';

export const BILLING_ADHOC_DATASET_IDS: readonly string[] = [BILLING_CLAIMS_DATASET_ID];

export function validateRequestParameters(input: ZambdaInput): AdHocReportRequest {
  const params = validateAdHocReportRequest(input);

  if ('datasetId' in params && !BILLING_ADHOC_DATASET_IDS.includes(params.datasetId)) {
    throw INVALID_INPUT_ERROR(
      `Unknown billing dataset "${params.datasetId}". Known: ${BILLING_ADHOC_DATASET_IDS.join(', ')}`
    );
  }

  return params;
}
