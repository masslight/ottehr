import { ClaimResponse } from 'fhir/r4b';
import {
  ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY,
  ClaimPaymentSummary,
  extractClaimResponseAmounts,
  extractRemitAdjustments,
  extractReportedCharge,
  sortClaimResponsesByRecency,
} from './claim-amounts';

// A claim's balances computed as a fold over its remits: readRemitAmounts reads what one remit
// says, applyRemit folds it into the running ClaimBalances, and each step's balances can be
// inspected on their own (see claimBalanceSteps). Same results as summarizeClaimPayments.

// CARC 23: "payment adjusted because charges have been paid by another payer" — a secondary
// restating what prior payers paid or adjusted, not a write-off of its own.
const PRIOR_PAYER_IMPACT_REASON_CODE = '23';

// What one remit says, read once: everything applyRemit needs from it.
export interface RemitAmounts {
  paid: number;
  // undefined = not reported on this remit
  allowed: number | undefined;
  // the PR adjustments' sum; undefined = the remit carries none, so it doesn't say what the patient owes
  patientResp: number | undefined;
  // non-PR adjustments (CO/OA/PI/CR), excluding prior-payer impact
  writeOffs: number;
  // the part of writeOffs that is this remit's billed-to-allowed reduction; 0 without an allowed amount
  reductionToAllowed: number;
  // the rest of writeOffs, e.g. CO-253 sequestration taken after allowed; all of them without an
  // allowed amount
  writeOffsBeyondAllowed: number;
}

// `billed` stands in for a remit that reports no charge.
//
// The reduction to allowed (charge - allowed) is only taken to the extent the remit's adjustments
// actually carry it: an 835 balances (charge = paid + every adjustment), so whatever a manually
// keyed remit leaves unbalanced is taken to be the unreported part of that reduction. Clamped
// toward zero in the direction of the reduction, so a reversal (every amount negated) still
// cancels its original.
export function readRemitAmounts(claimResponse: ClaimResponse, billed?: number): RemitAmounts {
  const { paid, allowed, patientResp } = extractClaimResponseAmounts(claimResponse);
  const adjustments = extractRemitAdjustments(claimResponse);
  const writeOffs = adjustments
    .filter(
      (adjustment) =>
        adjustment.groupCode !== ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY &&
        adjustment.reasonCode !== PRIOR_PAYER_IMPACT_REASON_CODE
    )
    .reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const withReduction = (reductionToAllowed: number): RemitAmounts => ({
    paid,
    allowed,
    patientResp,
    writeOffs,
    reductionToAllowed,
    writeOffsBeyondAllowed: writeOffs - reductionToAllowed,
  });

  if (allowed === undefined) return withReduction(0);
  const charge = extractReportedCharge(claimResponse) ?? billed;
  // without a charge the reduction is unknowable; take the write-offs to be exactly it
  if (charge === undefined) return withReduction(writeOffs);

  const reduction = charge - allowed;
  // nothing for the write-offs to be absorbed into, whichever direction they run (a reversal's are
  // negative); the clamping below would otherwise floor those to 0
  if (reduction === 0) return withReduction(0);
  const sign = reduction < 0 ? -1 : 1;
  const allAdjustments = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const unreported = charge - paid - allAdjustments;
  const reportedReduction = Math.min(Math.max(sign * (reduction - unreported), 0), sign * reduction);
  return withReduction(sign * Math.min(reportedReduction, Math.max(sign * writeOffs, 0)));
}

// A claim's insurance-side balances after applying its remits in order (see applyRemit).
export interface ClaimBalances {
  billed: number;
  // the latest allowed amount reported; undefined until a remit reports one
  allowed: number | undefined;
  // every remit's paid, summed: reversals net out with their negative amounts
  insurancePaid: number;
  // the latest remit's PR; undefined when that remit carries none
  reportedPatientResp: number | undefined;
  // summed over remits that report allowed
  writeOffsBeyondAllowed: number;
  // summed over remits that report allowed: how much of the claim's reduction to allowed they carried
  reductionCarried: number;
  // summed over remits that report no allowed amount
  writeOffsWithoutAllowed: number;
  // what the patient owes per the remits so far (see resolvePatientResp)
  patientResp: number;
}

export function initialClaimBalances(billed: number): ClaimBalances {
  return {
    billed,
    allowed: undefined,
    insurancePaid: 0,
    reportedPatientResp: undefined,
    writeOffsBeyondAllowed: 0,
    reductionCarried: 0,
    writeOffsWithoutAllowed: 0,
    patientResp: 0,
  };
}

// Remits must be applied oldest first (sortClaimResponsesByRecency).
export function applyRemit(balances: ClaimBalances, remit: RemitAmounts): ClaimBalances {
  const reportsAllowed = remit.allowed !== undefined;
  const next: ClaimBalances = {
    ...balances,
    allowed: remit.allowed ?? balances.allowed,
    insurancePaid: balances.insurancePaid + remit.paid,
    reportedPatientResp: remit.patientResp,
    writeOffsBeyondAllowed: balances.writeOffsBeyondAllowed + (reportsAllowed ? remit.writeOffsBeyondAllowed : 0),
    reductionCarried: balances.reductionCarried + remit.reductionToAllowed,
    writeOffsWithoutAllowed: balances.writeOffsWithoutAllowed + (reportsAllowed ? 0 : remit.writeOffs),
  };
  return { ...next, patientResp: resolvePatientResp(next) };
}

// Patient responsibility is what the latest remit's PR says the patient owes: after COB the last
// payer's PR already accounts for what prior payers paid, so summing PR across payers would
// double-count the share of the primary's PR the secondary covered. Without PR on the latest remit
// it's derived (see derivePatientResp). Ceilinged to 0 either way: a reversal reports what it took
// back as negative PR, and the patient owes nothing rather than less than nothing — otherwise a
// payment they made counts twice as credit.
function resolvePatientResp(balances: ClaimBalances): number {
  return Math.max(balances.reportedPatientResp ?? derivePatientResp(balances), 0);
}

// basis - insurancePaid - whatever payers wrote off on top of the basis. The basis is the latest
// allowed amount, or billed when no remit reports one (AMT*B6 is optional, and manual ERAs may
// leave it blank).
//
// Remits reporting allowed count only their write-offs beyond their own reduction to allowed, so a
// secondary repeating the primary's allowed doesn't drop the primary's post-allowed write-offs. The
// basis already excludes the claim's reduction (billed - allowed), so whatever part of it those
// remits didn't carry is taken out of the write-offs of remits without an allowed amount (a
// primary's CO-45 when only a later remit reports allowed) before the rest of those count, e.g. a
// secondary writing off what it didn't pay.
function derivePatientResp(balances: ClaimBalances): number {
  const basis = balances.allowed ?? balances.billed;
  const uncarriedReduction = Math.max(balances.billed - basis - balances.reductionCarried, 0);
  // floored only when there is a reduction to absorb, so net-negative (reversed) write-offs still
  // count otherwise
  const writeOffsWithoutAllowed =
    uncarriedReduction > 0
      ? Math.max(balances.writeOffsWithoutAllowed - uncarriedReduction, 0)
      : balances.writeOffsWithoutAllowed;
  return basis - balances.insurancePaid - balances.writeOffsBeyondAllowed - writeOffsWithoutAllowed;
}

export interface ClaimBalanceStep {
  claimResponseId: string | undefined;
  remit: RemitAmounts;
  // the balances after applying this remit
  balances: ClaimBalances;
}

// Every step of the fold, oldest remit first: what each remit said and the balances it left, for
// logging and investigating a claim's balance.
export function claimBalanceSteps(claimResponses: ClaimResponse[], billed: number): ClaimBalanceStep[] {
  const steps: ClaimBalanceStep[] = [];
  let balances = initialClaimBalances(billed);
  for (const claimResponse of sortClaimResponsesByRecency(claimResponses)) {
    const remit = readRemitAmounts(claimResponse, billed);
    balances = applyRemit(balances, remit);
    steps.push({ claimResponseId: claimResponse.id, remit, balances });
  }
  return steps;
}

// summarizeClaimPayments computed through the fold.
export function summarizeClaimBalances(
  claimResponses: ClaimResponse[],
  billed: number,
  patientPaid = 0,
  writeOffsTotal = 0
): ClaimPaymentSummary {
  const steps = claimBalanceSteps(claimResponses, billed);
  const balances = steps.at(-1)?.balances;
  if (!balances) {
    return {
      allowed: 0,
      insurancePaid: 0,
      patientResp: 0,
      patientPaid,
      writeOffsTotal,
      balance: billed - patientPaid - writeOffsTotal,
      adjudicated: false,
    };
  }

  return {
    allowed: balances.allowed ?? 0,
    insurancePaid: balances.insurancePaid,
    patientResp: balances.patientResp,
    patientPaid,
    writeOffsTotal,
    balance: balances.patientResp - patientPaid - writeOffsTotal,
    adjudicated: true,
  };
}
