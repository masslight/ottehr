import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CLAIM_NOT_READY_FOR_X12_EXPORT, ExportClaimX12Response, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { ExportClaimX12Params, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'export-billing-claim-x12';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...paramsToLog } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', paramsToLog);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(params, oystehr);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(params: ExportClaimX12Params, oystehr: Oystehr): Promise<ExportClaimX12Response> {
  const { claimId } = params;
  try {
    const { x12 } = await oystehr.rcm.claimToX12({ claimId });
    return { x12 };
  } catch (error) {
    console.error(`X12 generation failed for claim ${claimId}`, error);
    if (error instanceof Oystehr.OystehrSdkError && String(error.code) === '4006') {
      // i want the user to see the actual fhir error (e.g. missing extension)
      throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(error.message || CLAIM_NOT_READY_FOR_X12_EXPORT.message);
    }
    throw error;
  }
}
