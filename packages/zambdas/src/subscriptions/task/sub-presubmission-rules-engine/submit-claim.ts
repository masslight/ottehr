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

// Submission seam, called once every rule has passed (no Hold). Deliberately a no-op so the engine
// runs end-to-end; only this function changes when the backend is wired.
// TODO: implement real submission against the chosen backend.
export function submitClaim(input: SubmitClaimInput): Promise<SubmitClaimResult> {
  const claimId = input.model.claim.id ?? 'unknown';
  console.log(`[rules-engine] submitClaim is a no-op stub; Claim/${claimId} not actually submitted yet.`);
  return Promise.resolve({
    submitted: false,
    statusReason: 'Rules passed; claim ready to submit (submission backend not yet wired).',
  });
}
