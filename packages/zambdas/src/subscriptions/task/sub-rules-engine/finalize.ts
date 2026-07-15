import Oystehr from '@oystehr/sdk';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import {
  AR_STAGE,
  ArStageCode,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimStatusFieldKey,
  getClaimStatusFieldValue,
  RulesEngineType,
} from 'utils';
import { applyClaimStatusFieldClearingHold } from '../../../billing/provenance';
import { RulesEngineClaimModel } from '../../../billing/rules-engine/claim-model';
import { assertValidClaimStatusField, claimHasRealCoverage, fetchById } from '../../../billing/shared';
import { submitClaim } from './submit-claim';

// What happens after every rule passed, per engine: the Claim Submission engine submits the claim
// to the payer; the pre-invoice engines move their AR stage's status to Ready to invoice. Either
// way the passing run lifts the Hold tag in the same commit as its status move — a hold left by an
// earlier run or an AR stage change no longer applies.

export interface FinalizeRunInput {
  oystehr: Oystehr;
  model: RulesEngineClaimModel;
  agent: ProvenanceAgent;
}

export interface FinalizeRunResult {
  statusReason: string;
}

export async function finalizeEngineRun(engine: RulesEngineType, input: FinalizeRunInput): Promise<FinalizeRunResult> {
  switch (engine) {
    case 'claim-submission':
      return submitClaim(input);
    case 'non-insurance-payer-pre-invoice':
      return markReadyToInvoice(input, {
        requiredStage: AR_STAGE.nonInsurancePayer,
        stageLabel: 'Non-insurance Payer AR',
        statusField: 'nonInsuranceArStatus',
      });
    case 'patient-ar-pre-invoice':
      return markReadyToInvoice(input, {
        requiredStage: AR_STAGE.patient,
        stageLabel: 'Patient AR',
        statusField: 'patientArStatus',
        selfPayOnly: true,
      });
  }
}

interface ReadyToInvoiceOptions {
  requiredStage: ArStageCode;
  stageLabel: string;
  // The AR-stage progress field moved to ready-to-invoice.
  statusField: ClaimStatusFieldKey;
  // Patient AR pre-invoice rules only apply to self-pay (no-coverage) claims.
  selfPayOnly?: boolean;
}

// The pre-invoice engines' success effect. The claim may have changed stage (or gained coverage)
// between the kickoff and this run, so the eligibility that queued the engine is re-checked here —
// mirroring submitClaim, which only submits claims still in Insurance Payer AR.
async function markReadyToInvoice(input: FinalizeRunInput, opts: ReadyToInvoiceOptions): Promise<FinalizeRunResult> {
  const { oystehr, model, agent } = input;
  const claimId = model.claim.id;
  if (!claimId) throw new Error('Claim id missing from the rules-engine model');

  if (getClaimStatusFieldValue(model.claim, CLAIM_STATUS_FIELDS_BY_KEY.arStage) !== opts.requiredStage) {
    return {
      statusReason: `Rules passed; claim was not marked ready to invoice because it is not in ${opts.stageLabel}.`,
    };
  }
  if (opts.selfPayOnly && claimHasRealCoverage(model.claim.insurance)) {
    return { statusReason: 'Rules passed; claim was not marked ready to invoice because it is not self-pay.' };
  }

  const value = assertValidClaimStatusField(opts.statusField, 'ready-to-invoice');
  // Re-fetch so the status patch locks against the version the engine just wrote.
  const fresh = await fetchById<Claim>(oystehr, 'Claim', claimId);
  await applyClaimStatusFieldClearingHold(oystehr, fresh, opts.statusField, value, agent);

  return { statusReason: `Rules passed; ${opts.stageLabel} status moved to Ready to invoice.` };
}
