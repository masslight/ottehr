import Oystehr from '@oystehr/sdk';
import { Claim } from 'fhir/r4b';
import {
  AR_STAGE,
  CLAIM_STATUS_FIELDS_BY_KEY,
  getClaimStatusFieldValue,
} from 'utils/lib/types/data/billing/claim-status';
import { applyClaimStatusFieldClearingHold } from '../../../billing/provenance';
import { assertValidClaimStatusField, fetchById } from '../../../billing/shared';
import { FinalizeRunInput, FinalizeRunResult } from './finalize';

// Oystehr rejected the submission for a request-level reason (an adjudication-outcome error, or an
// HTTP 400 from the submit-claim call itself — e.g. a duplicate diagnosis code). This is a normal,
// anticipated business outcome, not a rules-engine bug: index.ts's catch recognizes this type and
// completes the Task as "failed" (claim held, error recorded in claim history) instead of treating
// it like an unexpected crash.
export class ClaimSubmissionRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimSubmissionRejectedError';
  }
}

// The Claim Submission engine's success effect. Submits via the Oystehr claim service: only
// Insurance-Payer-AR claims are submittable; on success the Insurance AR Status moves to Submitted —
// with the Hold tag lifted in the same commit — recorded in the claim history with the rules-engine
// agent.
export async function submitClaim(input: FinalizeRunInput): Promise<FinalizeRunResult> {
  const { oystehr, model, agent } = input;
  const claimId = model.claim.id;
  if (!claimId) throw new Error('Claim id missing from the rules-engine model');

  if (getClaimStatusFieldValue(model.claim, CLAIM_STATUS_FIELDS_BY_KEY.arStage) !== AR_STAGE.insurancePayer) {
    return { statusReason: 'Rules passed; claim was not submitted because it is not in Insurance Payer AR.' };
  }

  let claimResponse;
  try {
    claimResponse = await oystehr.rcm.submitClaim({ claimId });
  } catch (error) {
    // The submit-claim endpoint rejects some claims outright (HTTP 400) instead of returning a 200
    // with outcome: 'error' — a duplicate diagnosis code is one example. Same category of expected
    // rejection as the outcome check below, so it gets the same non-crashing treatment. Other status
    // codes (401/403 auth, 404, 5xx, ...) are not requests the payer rejected — let those crash.
    const sdkError = error as Partial<Oystehr.OystehrSdkError>;
    if (sdkError.code && (sdkError.code === 400 || (sdkError.code >= 4000 && sdkError.code < 5000))) {
      throw new ClaimSubmissionRejectedError(sdkError.message || 'Claim submission was rejected by Oystehr.');
    }
    throw error;
  }
  if (claimResponse.outcome === 'error') {
    throw new ClaimSubmissionRejectedError(
      claimResponse.error
        ?.map((e) => e.code.text ?? '')
        .filter(Boolean)
        .join(', ') ?? 'An unknown error occurred'
    );
  }

  const value = assertValidClaimStatusField('insuranceArStatus', 'submitted');
  // Re-fetch so the status patch locks against the version the engine just wrote.
  const submitted = await fetchById<Claim>(oystehr, 'Claim', claimId);
  await applyClaimStatusFieldClearingHold(oystehr, submitted, 'insuranceArStatus', value, agent);

  return { statusReason: 'Rules passed; claim submitted to payer.' };
}
