import Oystehr from '@oystehr/sdk';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { AR_STAGE, CLAIM_STATUS_FIELDS_BY_KEY, getClaimStatusFieldValue, RulesEngineClaimModel } from 'utils';
import { applyClaimStatusField } from '../../../billing/provenance';
import { assertValidClaimStatusField, fetchById } from '../../../billing/shared';

export interface SubmitClaimInput {
  oystehr: Oystehr;
  model: RulesEngineClaimModel;
  agent: ProvenanceAgent;
}

export interface SubmitClaimResult {
  submitted: boolean;
  statusReason: string;
}

// Submit via the Oystehr claim service, mirroring submit-billing-claim: only Insurance-Payer-AR
// claims are submittable; on success the Insurance AR Status moves to Submitted, recorded in the
// claim history with the rules-engine agent.
export async function submitClaim(input: SubmitClaimInput): Promise<SubmitClaimResult> {
  const { oystehr, model, agent } = input;
  const claimId = model.claim.id;
  if (!claimId) throw new Error('Claim id missing from the rules-engine model');

  if (getClaimStatusFieldValue(model.claim, CLAIM_STATUS_FIELDS_BY_KEY.arStage) !== AR_STAGE.insurancePayer) {
    return {
      submitted: false,
      statusReason: 'Rules passed; claim was not submitted because it is not in Insurance Payer AR.',
    };
  }

  await oystehr.rcm.submitClaim({ claimId });

  const value = assertValidClaimStatusField('insuranceArStatus', 'submitted');
  // Re-fetch so the status patch locks against the version the engine just wrote.
  const submitted = await fetchById<Claim>(oystehr, 'Claim', claimId);
  await applyClaimStatusField(oystehr, submitted, 'insuranceArStatus', value, agent);

  return { submitted: true, statusReason: 'Rules passed; claim submitted to payer.' };
}
