import Oystehr from '@oystehr/sdk';
import { RulesEngineClaimModel, Secrets } from 'utils';

export interface SubmitClaimInput {
  oystehr: Oystehr;
  model: RulesEngineClaimModel;
  secrets: Secrets;
}

export interface SubmitClaimResult {
  submitted: boolean;
  statusReason: string;
}

// ---------------------------------------------------------------------------
// Claim submission seam.
//
// The pre-submission rules engine calls this once every rule has passed (no Hold tag). Per the
// project decision ("abstract now, decide later"), the actual submission backend — the Oystehr claim
// service, or the existing Candid clearinghouse path used by the encounter flow — is not yet wired.
//
// This is deliberately a no-op that reports the claim as ready, so the engine runs end-to-end and the
// Task completes. The rest of the engine does not depend on which backend is chosen; only this
// function changes when the backend is implemented. By the time it is called the claim's working-copy
// resources are already fully prepared (including any payer re-pointing the rules applied to the
// working-copy Coverage / Claim.insurer), so this just needs to submit the claim as-is.
//
// TODO: implement real submission against the chosen backend (the Oystehr claim service or the
// existing Candid clearinghouse path).
// ---------------------------------------------------------------------------
export function submitClaim(input: SubmitClaimInput): Promise<SubmitClaimResult> {
  const claimId = input.model.claim.id ?? 'unknown';
  console.log(`[rules-engine] submitClaim is a no-op stub; Claim/${claimId} not actually submitted yet.`);
  return Promise.resolve({
    submitted: false,
    statusReason: 'Rules passed; claim ready to submit (submission backend not yet wired).',
  });
}
