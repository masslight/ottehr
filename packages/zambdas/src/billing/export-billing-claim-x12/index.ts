import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim } from 'fhir/r4b';
import { describeClaimSubmissionError } from 'utils/lib/helpers/rcm/claim-submission-error';
import { ExportClaimX12InputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { ExportClaimX12Response } from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_NOT_READY_FOR_X12_EXPORT, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { truncateForLog } from '../../shared/logging';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { createBillingClient } from '../shared';

type ExportClaimX12Params = ValidatedZambdaInput<typeof ExportClaimX12InputSchema>;

let m2mToken: string;
const ZAMBDA_NAME = 'export-billing-claim-x12';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateWithSchema(ExportClaimX12InputSchema, input);
  const { secrets } = params;
  console.groupEnd();

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(params, oystehr);
  console.groupEnd();
  console.debug('performEffect success', truncateForLog(response));

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(params: ExportClaimX12Params, oystehr: Oystehr): Promise<ExportClaimX12Response> {
  const { claimId, submissionType, submissionInsurance, payerClaimControlNumber } = params;
  try {
    const { x12 } = await oystehr.rcm.claimToX12({
      claimId,
      action: submissionType,
      insurance: submissionInsurance,
      payerClaimControlNumber,
    });
    return { x12 };
  } catch (error) {
    console.error(`X12 generation failed for claim ${claimId}`, error);
    if (error instanceof Oystehr.OystehrSdkError && String(error.code) === '4006') {
      // Tell the user which value the claim is missing, in billing-app terms rather than as a FHIR path.
      // The claim lets insurances and service lines be named as the claim screens name them.
      throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(
        error.message
          ? describeClaimSubmissionError(error.message, await readClaimForErrorLabels(oystehr, claimId))
          : CLAIM_NOT_READY_FOR_X12_EXPORT.message
      );
    }
    throw error;
  }
}

// Best effort: without the claim the error still reads, just with raw sequence/position labels.
async function readClaimForErrorLabels(oystehr: Oystehr, claimId: string): Promise<Claim | undefined> {
  try {
    return await oystehr.fhir.get<Claim>({ resourceType: 'Claim', id: claimId });
  } catch (error) {
    console.warn(`Could not read Claim/${claimId} to describe its X12 export error`, error);
    return undefined;
  }
}
