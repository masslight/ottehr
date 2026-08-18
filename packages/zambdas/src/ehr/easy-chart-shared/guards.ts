// Server-side guards. Each of these exists because the model did the wrong thing in a measured run.
//
// Everything here runs BEFORE the client ever sees an action, and nothing here is silent: an action
// a guard refuses is returned in `rejected[]` with a reason the UI shows as "skipped because…".
// Silent no-ops are the single worst failure mode in this product.

import Oystehr from '@oystehr/sdk';
import { ActionKind, PLANNABLE_VITAL_FIELDS, PlannableVitalField, RawAction } from 'utils/lib/easy-chart/actions';
import { PlannedAction, RejectedAction, TriggerReport } from 'utils/lib/easy-chart/api';
import {
  isCptShaped,
  isHcpcsShaped,
  isIcd10Shaped,
  isPersonalHistoryCode,
  unsupportedEtiologyQualifiers,
} from 'utils/lib/easy-chart/codes';
import { findingPolarity, rosPolarity, verifiedSourceText } from 'utils/lib/easy-chart/provenance';
import { isActionKind, missingRequiredFields } from 'utils/lib/easy-chart/registry';
import { coerceNumericFields } from 'utils/lib/easy-chart/schema';
import { parseVitalDisplay, recoverVitalReading } from 'utils/lib/easy-chart/vitals';

export interface GuardContext {
  oystehr: Oystehr;
  narrative: string;
  /** Display strings of items already on the chart. A remove-* may only target one of these. */
  chartedItems: string[];
  logPrefix: string;
}

export interface GuardResult {
  actions: PlannedAction[];
  rejected: RejectedAction[];
  triggers: TriggerReport[];
}

const isVitalField = (value: unknown): value is PlannableVitalField =>
  typeof value === 'string' && (PLANNABLE_VITAL_FIELDS as readonly string[]).includes(value);

/**
 * Run every guard over the model's raw actions.
 *
 * Order matters: shape first (so a malformed action is rejected cheaply), then per-kind semantics,
 * then the cross-action invariants that can only be judged with the whole list (duplicate diagnoses,
 * exactly one primary).
 */
export async function applyGuards(raw: RawAction[], context: GuardContext): Promise<GuardResult> {
  const actions: PlannedAction[] = [];
  const rejected: RejectedAction[] = [];

  for (const item of raw) {
    const outcome = await guardOne(item, context);
    if ('rejected' in outcome) rejected.push(outcome.rejected);
    else actions.push(outcome.action);
  }

  const deduped = enforceDiagnosisInvariants(actions, rejected);
  return { actions: deduped, rejected, triggers: buildTriggerReports(context.narrative, deduped) };
}

type GuardOutcome = { action: PlannedAction } | { rejected: RejectedAction };

async function guardOne(input: RawAction, context: GuardContext): Promise<GuardOutcome> {
  const action = { ...input } as PlannedAction;

  // Undo the digit-loop guard: every numeric field arrived as a string. A value that does not parse
  // is DELETED, so the required-fields gate below rejects it honestly instead of charting NaN.
  coerceNumericFields(action as unknown as Record<string, unknown>);

  if (!isActionKind(action.kind)) {
    return { rejected: { kind: String(action.kind), reason: `"${action.kind}" is not an action this build knows` } };
  }
  const kind: ActionKind = action.kind;

  // Provenance: verify the quote actually occurs in the narrative. A quote that is not real is
  // dropped, and the item is then honestly marked inferred rather than carrying a fabricated
  // citation. Do this before anything else so every later rejection reason is quote-free.
  action.sourceText = verifiedSourceText(action.sourceText, context.narrative);

  const missing = missingRequiredFields(kind, action);
  if (missing.length > 0 && kind !== 'set-vital') {
    return {
      rejected: {
        kind,
        display: action.display,
        reason: `the assistant did not supply ${missing.join(' and ')}, so this could not be charted`,
      },
    };
  }

  switch (kind) {
    case 'set-vital':
      return guardVital(action, context);
    case 'add-diagnosis':
    case 'add-condition':
      return guardDiagnosisLike(action, context);
    case 'set-em-code':
      return guardEmCode(action, context);
    case 'add-cpt':
      return guardCpt(action, context);
    case 'add-exam-finding':
    case 'remove-exam-finding':
      return guardExamFinding(action, kind);
    case 'add-ros-finding':
    case 'remove-ros-finding':
      return guardRosFinding(action);
    case 'remove-allergy':
    case 'remove-condition':
    case 'remove-medication':
    case 'remove-surgical-history':
    case 'remove-hospitalization':
    case 'remove-diagnosis':
      return guardRemoval(action, kind, context);
    default:
      return { action };
  }
}

// ---------------------------------------------------------------------------------------------
// 4.2 / 4.3 / 4.4 — units, value recovery, plausibility
// ---------------------------------------------------------------------------------------------

function guardVital(action: PlannedAction, context: GuardContext): GuardOutcome {
  if (!isVitalField(action.field)) {
    return { rejected: { kind: 'set-vital', display: action.display, reason: `"${action.field}" is not a vital` } };
  }
  const field = action.field;

  // 4.3 — the model is inconsistent about populating optional fields and will emit a set-vital with
  // no display at all. Recover the reading from the provider's OWN words, for EVERY vital.
  let display = action.display?.trim();
  if (!display) {
    display = recoverVitalReading(field, context.narrative);
    if (display) action.display = display;
  }
  if (!display) {
    return {
      rejected: {
        kind: 'set-vital',
        display: field,
        reason: `no reading for ${field} was given, and none could be found in the dictation`,
      },
    };
  }

  const parsed = parseVitalDisplay(field, display);
  switch (parsed.status) {
    case 'ok':
      action.value = parsed.value;
      if (parsed.unit) action.unit = parsed.unit;
      if (parsed.caution) action.caution = parsed.caution;
      return { action };
    case 'ok-bp':
      action.systolic = parsed.systolic;
      action.diastolic = parsed.diastolic;
      return { action };
    // 4.4 — do NOT chart it and do NOT silently reinterpret it. Ask.
    case 'implausible':
    case 'unrecognized-unit':
    case 'missing-unit':
    case 'no-value':
      return { rejected: { kind: 'set-vital', display, reason: parsed.reason } };
  }
}

// ---------------------------------------------------------------------------------------------
// 4.1 — diagnosis codes
// ---------------------------------------------------------------------------------------------

/**
 * Validate the code against the real terminology service — the same search the EHR picker uses.
 * Shape-check first, then confirm; if the code is not real, fall back to searching the model's
 * display/searchTerms.
 *
 * THE CHARTED {code, display} PAIR MUST COME FROM ONE TERMINOLOGY ROW. Never a model code with a
 * searched display, or vice versa — that is how a note ends up asserting a condition whose code says
 * something else.
 */
async function guardDiagnosisLike(action: PlannedAction, context: GuardContext): Promise<GuardOutcome> {
  const kind = action.kind as 'add-diagnosis' | 'add-condition';
  const row = await resolveIcd10Row(action, context);
  if (!row) {
    return {
      rejected: {
        kind,
        display: action.display,
        reason: `no ICD-10 code could be confirmed for "${action.display}", so it was not charted`,
      },
    };
  }

  // A code carrying an organism/aetiology qualifier the narrative does not support.
  const unsupported = unsupportedEtiologyQualifiers(row.display, context.narrative);
  if (unsupported.length > 0) {
    return {
      rejected: {
        kind,
        display: row.display,
        reason: `${row.code} asserts "${unsupported.join('", "')}", which the visit does not describe`,
      },
    };
  }

  // A "history of…" Z-code used when the visit describes a CURRENT problem. add-condition may
  // legitimately record past history; a visit diagnosis may not.
  if (
    kind === 'add-diagnosis' &&
    isPersonalHistoryCode(row.code) &&
    !/\bhistory\b|\bh\/o\b|\bprior\b|\bpast\b/i.test(context.narrative)
  ) {
    return {
      rejected: {
        kind,
        display: row.display,
        reason: `${row.code} is a personal-history code, but the visit describes a current problem`,
      },
    };
  }

  action.code = row.code;
  action.display = row.display;
  return { action };
}

async function resolveIcd10Row(
  action: PlannedAction,
  context: GuardContext
): Promise<{ code: string; display: string } | undefined> {
  const candidate = action.code?.trim().toUpperCase();
  if (isIcd10Shaped(candidate)) {
    const exact = await searchIcd10(context, candidate!, 'code', true);
    // Exactly one row means the code is real and billable; take BOTH fields from that row.
    if (exact.length === 1) return exact[0];
  }

  // The code was absent, malformed or not real. Fall back to searching what the model called it.
  const queries = [action.display, ...(action.searchTerms ?? [])].filter((q): q is string => !!q?.trim());
  for (const query of queries) {
    const hits = await searchIcd10(context, query, 'description', false);
    if (hits.length > 0) return hits[0];
  }
  return undefined;
}

async function searchIcd10(
  context: GuardContext,
  query: string,
  searchType: 'code' | 'description',
  strictMatch: boolean
): Promise<{ code: string; display: string }[]> {
  try {
    const response = await context.oystehr.terminology.searchIcd10({ query, searchType, limit: 10, strictMatch });
    return response.codes;
  } catch (error) {
    // Terminology being down must not turn into a hallucinated code reaching the chart.
    console.log(`[${context.logPrefix}] ICD-10 ${searchType} lookup failed`);
    void error;
    return [];
  }
}

async function guardEmCode(action: PlannedAction, context: GuardContext): Promise<GuardOutcome> {
  const code = action.code?.trim();
  if (!isCptShaped(code)) {
    return { rejected: { kind: 'set-em-code', display: code, reason: `"${code}" is not a CPT-shaped E&M code` } };
  }
  const row = await searchCpt(context, code!);
  if (!row) {
    return { rejected: { kind: 'set-em-code', display: code, reason: `E&M code ${code} is not a real CPT code` } };
  }
  action.code = row.code;
  action.display = row.display;
  return { action };
}

async function guardCpt(action: PlannedAction, context: GuardContext): Promise<GuardOutcome> {
  const code = action.code?.trim().toUpperCase();
  if (!isCptShaped(code) && !isHcpcsShaped(code)) {
    return { rejected: { kind: 'add-cpt', display: code, reason: `"${code}" is not a CPT or HCPCS code shape` } };
  }
  const row = isHcpcsShaped(code) ? await searchHcpcs(context, code!) : await searchCpt(context, code!);
  if (!row) {
    return { rejected: { kind: 'add-cpt', display: code, reason: `${code} is not a real CPT/HCPCS code` } };
  }
  action.code = row.code;
  action.display = row.display;
  return { action };
}

async function searchCpt(context: GuardContext, code: string): Promise<{ code: string; display: string } | undefined> {
  try {
    const response = await context.oystehr.terminology.searchCpt({
      query: code,
      searchType: 'code',
      limit: 10,
      strictMatch: true,
    });
    return response.codes.length === 1 ? response.codes[0] : undefined;
  } catch (error) {
    console.log(`[${context.logPrefix}] CPT lookup failed`);
    void error;
    return undefined;
  }
}

async function searchHcpcs(
  context: GuardContext,
  code: string
): Promise<{ code: string; display: string } | undefined> {
  try {
    const response = await context.oystehr.terminology.searchHcpcs({
      query: code,
      searchType: 'code',
      limit: 10,
      strictMatch: true,
    });
    return response.codes.length === 1 ? response.codes[0] : undefined;
  } catch (error) {
    console.log(`[${context.logPrefix}] HCPCS lookup failed`);
    void error;
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// 4.5 — exam and ROS
// ---------------------------------------------------------------------------------------------

/**
 * A negated finding ("no wheezing", "lungs clear", "non-tender") is NOT an abnormal finding: it must
 * not produce one, and it must not remove the matching normal either, since it AGREES with it.
 * Match on polarity, not on the keyword.
 */
function guardExamFinding(action: PlannedAction, kind: 'add-exam-finding' | 'remove-exam-finding'): GuardOutcome {
  const polarity = findingPolarity(action.display ?? '');
  if (kind === 'add-exam-finding' && polarity !== 'positive') {
    return {
      rejected: {
        kind,
        display: action.display,
        reason:
          polarity === 'negated'
            ? `"${action.display}" is a negative — exam findings are positive observations only, so nothing was charted`
            : `"${action.display}" asserts a normal rather than an abnormality`,
      },
    };
  }
  if (kind === 'remove-exam-finding' && polarity === 'negated') {
    return {
      rejected: {
        kind,
        display: action.display,
        reason: `"${action.display}" is a negative, which agrees with the charted normal — nothing was removed`,
      },
    };
  }
  return { action };
}

/**
 * ROS records both positives and negatives, and carries the polarity in the display text. A finding
 * with neither verb cannot be filed with the right polarity, so it is rejected rather than guessed.
 */
function guardRosFinding(action: PlannedAction): GuardOutcome {
  const polarity = rosPolarity(action.display ?? '', action.finding);
  if (!polarity) {
    return {
      rejected: {
        kind: action.kind,
        display: action.display,
        reason: `"${action.display}" does not say whether the patient reports or denies it`,
      },
    };
  }
  action.finding = polarity;
  return { action };
}

/**
 * A remove-* may only target something actually on the chart. With several plausible matches the
 * CLIENT asks rather than deleting the first substring match; here we only refuse removals that
 * match nothing at all, so the step reports a reason instead of quietly doing nothing.
 */
function guardRemoval(action: PlannedAction, kind: ActionKind, context: GuardContext): GuardOutcome {
  if (context.chartedItems.length === 0) {
    return {
      rejected: { kind, display: action.display, reason: 'the chart is empty, so there was nothing to remove' },
    };
  }
  const needle = (action.display ?? '').toLowerCase().trim();
  const matches = context.chartedItems.filter((item) => {
    const hay = item.toLowerCase();
    return hay.includes(needle) || needle.includes(hay);
  });
  if (matches.length === 0) {
    return {
      rejected: {
        kind,
        display: action.display,
        reason: `"${action.display}" is not on the chart, so nothing was removed`,
      },
    };
  }
  return { action };
}

// ---------------------------------------------------------------------------------------------
// Cross-action invariants
// ---------------------------------------------------------------------------------------------

/** The same diagnosis cannot be charted twice, and there is never more than one primary. */
function enforceDiagnosisInvariants(actions: PlannedAction[], rejected: RejectedAction[]): PlannedAction[] {
  const seenCodes = new Set<string>();
  let primaryTaken = false;
  const kept: PlannedAction[] = [];

  for (const action of actions) {
    if (action.kind !== 'add-diagnosis') {
      kept.push(action);
      continue;
    }
    const code = (action.code ?? action.display ?? '').toUpperCase();
    if (seenCodes.has(code)) {
      rejected.push({
        kind: 'add-diagnosis',
        display: action.display,
        reason: `${action.display} was already charted in this plan, so the duplicate was dropped`,
      });
      continue;
    }
    seenCodes.add(code);

    if (action.isPrimary) {
      if (primaryTaken) {
        // Demote rather than drop: the diagnosis is real, only the primary flag is wrong, and a note
        // that loses a secondary diagnosis is worse than one with a demoted flag.
        action.isPrimary = false;
        action.caution = 'a primary diagnosis was already set, so this was charted as secondary';
      } else {
        primaryTaken = true;
      }
    }
    kept.push(action);
  }
  return kept;
}

// ---------------------------------------------------------------------------------------------
// Deterministic triggers (7.2)
// ---------------------------------------------------------------------------------------------

/**
 * Report BOTH whether the trigger fired and whether the model complied. Without the pair you cannot
 * distinguish "the guard never fired" from "the guard fired and the model ignored it" — opposite
 * bugs with the same symptom. Counts and pattern labels only, never narrative text.
 */
function buildTriggerReports(narrative: string, actions: PlannedAction[]): TriggerReport[] {
  const text = narrative.toLowerCase();
  const reports: TriggerReport[] = [];

  const dispositionLanguage =
    /\bfollow(?:\s|-)?up\b|\breturn (?:to|here|if)\b|\brefer(?:ral)?\b|\bgo to the (?:er|ed|emergency)\b|\bcall 911\b|\bdischarge\b/.test(
      text
    );
  reports.push({
    trigger: 'disposition-language-without-disposition',
    fired: dispositionLanguage,
    complied: actions.some((a) => a.kind === 'set-disposition'),
  });

  const emRequired = actions.length > 0;
  reports.push({
    trigger: 'em-code-always-required',
    fired: emRequired,
    complied: actions.some((a) => a.kind === 'set-em-code'),
  });

  const prescriptionCommitment = /\bi'?ll send\b|\blet me get you on\b|\bwe'?ll start\b|\bi'?m going to treat\b/.test(
    text
  );
  reports.push({
    trigger: 'voiced-prescription-commitment',
    fired: prescriptionCommitment,
    complied: actions.some((a) => a.kind === 'add-medication' || a.kind === 'provider-note'),
  });

  return reports;
}
