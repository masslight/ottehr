import { Claim } from 'fhir/r4b';
import { AR_STAGE, CLAIM_STATUS_FIELDS_BY_KEY, getClaimStatusFieldValue } from 'utils';
import { applyClaimStatusFieldClearingHold } from '../../../billing/provenance';
import { assertValidClaimStatusField, fetchById } from '../../../billing/shared';
import { FinalizeRunInput, FinalizeRunResult } from './finalize';

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

  await oystehr.rcm.submitClaim({ claimId });

  const value = assertValidClaimStatusField('insuranceArStatus', 'submitted');
  // Re-fetch so the status patch locks against the version the engine just wrote.
  const submitted = await fetchById<Claim>(oystehr, 'Claim', claimId);
  await applyClaimStatusFieldClearingHold(oystehr, submitted, 'insuranceArStatus', value, agent);

  return { statusReason: 'Rules passed; claim submitted to payer.' };
}
