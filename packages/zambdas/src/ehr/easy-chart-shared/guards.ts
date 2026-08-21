// Server-side guards. Each of these exists because the model did the wrong thing in a measured run.
//
// Everything here runs BEFORE the client ever sees an action, and nothing here is silent: an action
// a guard refuses is returned in `rejected[]` with a reason the UI shows as "skipped because…".
// Silent no-ops are the single worst failure mode in this product.

import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { ActionKind, PLANNABLE_VITAL_FIELDS, PlannableVitalField, RawAction } from 'utils/lib/easy-chart/actions';
import { PlannedAction, RejectedAction, TriggerReport } from 'utils/lib/easy-chart/api';
import {
  isCptShaped,
  isHcpcsShaped,
  isPersonalHistoryCode,
  scanIcd10Codes,
  unsupportedEtiologyQualifiers,
} from 'utils/lib/easy-chart/codes';
import { IcdSearchFn, repairUnsupportedEtiology, resolveIcd } from 'utils/lib/easy-chart/icd-resolve';
import { findingPolarity, rosPolarity, verifiedSourceText } from 'utils/lib/easy-chart/provenance';
import { allowedFields, isActionKind, missingRequiredFields } from 'utils/lib/easy-chart/registry';
import { coerceNumericFields } from 'utils/lib/easy-chart/schema';
import { detectSpeakerLabels, sniffIcdCodeScoped } from 'utils/lib/easy-chart/sniffers';
import { parseVitalDisplay, recoverVitalReading, sniffVitalsFromNarrative } from 'utils/lib/easy-chart/vitals';
import { createTerminologyIcdSearch } from './icd-search';

export interface GuardContext {
  oystehr: Oystehr;
  narrative: string;
  /** Display strings of items already on the chart. A remove-* may only target one of these. */
  chartedItems: string[];
  logPrefix: string;
  /**
   * True when the note is already written and this narrative only adds to it. The primary-diagnosis
   * invariant reads it: an addendum's new diagnoses are additions, never usurpers of an existing primary.
   */
  incremental?: boolean;
  /**
   * Promote the first diagnosis to primary when the plan marked none — a WHOLE-PLAN invariant, so only
   * the planning surface may ask for it.
   *
   * The review surface must not: it is guarded one suggestion at a time, and its "secondary-dx" card
   * deliberately adds a single diagnosis with isPrimary:false. Blanket promotion there would turn every
   * such card into a primary-diagnosis change the provider never asked for. Review's own primary problem
   * is the SWAP case, and `carrySwapPrimaryFromChartState` handles that from the chart state instead.
   */
  promoteMissingPrimary?: boolean;
  /**
   * Injected so tests resolve codes against fixtures instead of the network. Built from `oystehr` when
   * absent — one instance per invocation, because it carries the warm-call cache.
   */
  icdSearch?: IcdSearchFn;
}

/** The context every guard actually runs against: the search function is resolved exactly once. */
interface ResolvedGuardContext extends GuardContext {
  icdSearch: IcdSearchFn;
  /** Code-shaped transcript tokens that are speaker tags, not diagnoses. Computed once per plan. */
  speakerLabels: Set<string>;
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
  const resolved: ResolvedGuardContext = {
    ...context,
    icdSearch: context.icdSearch ?? createTerminologyIcdSearch(context.oystehr),
    speakerLabels: detectSpeakerLabels(context.narrative),
  };
  const actions: PlannedAction[] = [];
  const rejected: RejectedAction[] = [];

  for (const item of raw) {
    const outcome = await guardOne(item, resolved);
    if ('rejected' in outcome) rejected.push(outcome.rejected);
    else actions.push(outcome.action);
  }

  const deduped = enforceDiagnosisInvariants(actions, rejected, {
    promoteMissingPrimary: context.promoteMissingPrimary === true,
    incremental: context.incremental === true,
    chartedItems: context.chartedItems,
  });
  const complete = applyBackstops(deduped, resolved);
  return { actions: complete, rejected, triggers: buildTriggerReports(context.narrative, complete) };
}

type GuardOutcome = { action: PlannedAction } | { rejected: RejectedAction };

async function guardOne(input: RawAction, context: ResolvedGuardContext): Promise<GuardOutcome> {
  const action = { ...input } as PlannedAction;

  // Undo the digit-loop guard: every numeric field arrived as a string. A value that does not parse
  // is DELETED, so the required-fields gate below rejects it honestly instead of charting NaN.
  coerceNumericFields(action as unknown as Record<string, unknown>);

  if (!isActionKind(action.kind)) {
    return { rejected: { kind: String(action.kind), reason: `"${action.kind}" is not an action this build knows` } };
  }
  const kind: ActionKind = action.kind;

  // Strip fields this kind does not declare. A leak is not cosmetic: an add-diagnosis for a forehead
  // laceration arrived carrying `updates: [{field:'code', value:'S01.81XA'}]` — update-procedure's shape,
  // holding the code the model actually meant — while its own `code` field named an unrelated condition.
  // Whatever the model intended, a field the executor does not read for this kind can only mislead a
  // reader of the plan, and one that it DOES read under a different kind can change what gets charted.
  const allowed = new Set<string>(allowedFields(kind));
  const bag = action as unknown as Record<string, unknown>;
  const leaked = Object.keys(bag).filter((field) => !allowed.has(field) && field !== 'caution');
  // Salvage before stripping. A code-shaped value inside a leaked field is a candidate, not a decision:
  // it goes through the same terminology confirmation as any other, so a bad salvage is rejected by the
  // normal path. It matters because CODE lookup is reliable while DESCRIPTION search is not — the
  // S-chapter injury codes are effectively unreachable by description, so for a laceration the model's
  // own code is the only route to the right row, and it arrived in `updates` instead of `code`.
  if ((kind === 'add-diagnosis' || kind === 'add-condition') && !action.code?.trim()) {
    const salvaged = scanIcd10Codes(JSON.stringify(leaked.map((field) => bag[field])))[0];
    if (salvaged) {
      console.log(`[${context.logPrefix}] recovered ${salvaged} from a misplaced field on ${kind}`);
      action.code = salvaged;
    }
  }
  for (const field of leaked) delete bag[field];

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

function guardVital(action: PlannedAction, context: ResolvedGuardContext): GuardOutcome {
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
async function guardDiagnosisLike(action: PlannedAction, context: ResolvedGuardContext): Promise<GuardOutcome> {
  const kind = action.kind as 'add-diagnosis' | 'add-condition';

  // The model omits the code often enough to be worth one deterministic look first: narratives write
  // "Acute otitis media, right ear (H66.91)" with the code right there. A code-shaped token that is
  // really a speaker tag ("DOCTOR X31") is refused — that was the single most embarrassing miscode.
  if (!action.code?.trim()) {
    const sniffed = sniffIcdCodeScoped(
      context.narrative,
      action.display ?? '',
      action.searchTerms ?? [],
      context.speakerLabels
    );
    if (sniffed) action.code = sniffed;
  }
  if (action.code && context.speakerLabels.has(action.code.trim().toUpperCase())) {
    // Better to let the client picker resolve by display than to commit a transcript artefact.
    delete action.code;
  }

  const row = await resolveIcd(
    context.icdSearch,
    action.code,
    action.display ?? '',
    action.searchTerms ?? [],
    action.sourceText,
    context.narrative
  );
  if (!row) {
    return {
      rejected: {
        kind,
        display: action.display,
        reason: `no ICD-10 code could be confirmed for "${action.display}", so it was not charted`,
      },
    };
  }

  // An aetiology qualifier the narrative does not support makes a real code the WRONG code. REPAIR
  // FIRST: the condition is usually right and only the qualifier is wrong ("Gonococcal vulvovaginitis"
  // for a yeast narrative, "serous" otitis media for a purulent one), so refusing outright throws away
  // a correct finding. Only an unrepairable one is refused.
  const unsupported = unsupportedEtiologyQualifiers(row.display, context.narrative);
  if (unsupported.length > 0) {
    const repaired = await repairUnsupportedEtiology(context.icdSearch, row, context.narrative);
    if (!repaired) {
      // Codes and qualifier labels only — never narrative text.
      console.log(`[${context.logPrefix}] etiology guard refused ${row.code} (unsupported: ${unsupported.join(', ')})`);
      return {
        rejected: {
          kind,
          display: row.display,
          reason: `${row.code} asserts "${unsupported.join('", "')}", which the visit does not describe`,
        },
      };
    }
    console.log(
      `[${context.logPrefix}] etiology guard repaired ${row.code} (unsupported: ${unsupported.join(', ')}) -> ${
        repaired.code
      }`
    );
    row.code = repaired.code;
    row.display = repaired.display;
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

async function guardEmCode(action: PlannedAction, context: ResolvedGuardContext): Promise<GuardOutcome> {
  const code = action.code?.trim();
  if (!isCptShaped(code)) {
    return { rejected: { kind: 'set-em-code', display: code, reason: `"${code}" is not a CPT-shaped E&M code` } };
  }
  const row = await searchCpt(context, code!);
  if (row === 'degraded') return { action };
  if (!row) {
    return { rejected: { kind: 'set-em-code', display: code, reason: `E&M code ${code} is not a real CPT code` } };
  }
  action.code = row.code;
  action.display = row.display;
  return { action };
}

async function guardCpt(action: PlannedAction, context: ResolvedGuardContext): Promise<GuardOutcome> {
  const code = action.code?.trim().toUpperCase();
  if (!isCptShaped(code) && !isHcpcsShaped(code)) {
    return { rejected: { kind: 'add-cpt', display: code, reason: `"${code}" is not a CPT or HCPCS code shape` } };
  }
  const row = isHcpcsShaped(code) ? await searchHcpcs(context, code!) : await searchCpt(context, code!);
  if (row === 'degraded') return { action };
  if (!row) {
    return { rejected: { kind: 'add-cpt', display: code, reason: `${code} is not a real CPT/HCPCS code` } };
  }
  action.code = row.code;
  action.display = row.display;
  return { action };
}

/**
 * `undefined` = the service answered and the code is not real → drop it.
 * `degraded` = the service could not be reached → KEEP the model's code.
 *
 * The distinction is the whole point. Collapsing both into "drop" means a terminology outage silently
 * strips billing from every visit for as long as it lasts, and nobody notices until the invoices are
 * short. An unvalidated billing code for the duration of an outage is the lesser harm, so the outage is
 * reported to Sentry and the code is kept.
 */
type CodeLookup = { code: string; display: string } | undefined | 'degraded';

async function searchCpt(context: ResolvedGuardContext, code: string): Promise<CodeLookup> {
  try {
    const response = await context.oystehr.terminology.searchCpt({
      query: code,
      searchType: 'code',
      limit: 10,
      strictMatch: true,
    });
    return response.codes.length === 1 ? response.codes[0] : undefined;
  } catch (error) {
    console.warn(`[${context.logPrefix}] CPT terminology unavailable, keeping the model code as-is`);
    captureException(error);
    return 'degraded';
  }
}

async function searchHcpcs(context: ResolvedGuardContext, code: string): Promise<CodeLookup> {
  try {
    const response = await context.oystehr.terminology.searchHcpcs({
      query: code,
      searchType: 'code',
      limit: 10,
      strictMatch: true,
    });
    return response.codes.length === 1 ? response.codes[0] : undefined;
  } catch (error) {
    console.warn(`[${context.logPrefix}] HCPCS terminology unavailable, keeping the model code as-is`);
    captureException(error);
    return 'degraded';
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
function guardRemoval(action: PlannedAction, kind: ActionKind, context: ResolvedGuardContext): GuardOutcome {
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

/**
 * The same diagnosis cannot be charted twice, and there is EXACTLY one primary.
 *
 * Both halves matter and only one of them is about the model behaving badly. "No more than one primary"
 * cleans up over-marking; "at least one primary" fixes a measured 0-out-of-13: the prompt says "exactly
 * ONE isPrimary=true" and the model simply never emits the flag, so every note came out with no primary
 * diagnosis — which is billing-invalid, since the E&M code attaches to it. It cannot be fixed in the
 * response schema either: all action kinds share one flat object schema, so making `isPrimary` required
 * would force it onto every action of every kind. Deterministic promotion is the only place left.
 */
function enforceDiagnosisInvariants(
  actions: PlannedAction[],
  rejected: RejectedAction[],
  options: { promoteMissingPrimary: boolean; incremental: boolean; chartedItems: string[] }
): PlannedAction[] {
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

  const diagnoses = kept.filter((action) => action.kind === 'add-diagnosis');
  if (diagnoses.length === 0 || !options.promoteMissingPrimary) return kept;

  // INCREMENTAL guard: when the chart already carries a primary, an addendum's new diagnoses are
  // additions, never usurpers — "allergic reaction to amoxicillin" charted from a phone-call addendum
  // must not demote the visit's actual primary. The provider can still change it explicitly.
  const chartHasPrimary =
    options.incremental && options.chartedItems.some((item) => /\(primary\)|\[PRIMARY\]/i.test(item));
  if (chartHasPrimary) {
    for (const action of diagnoses) action.isPrimary = false;
    return kept;
  }
  if (!primaryTaken) {
    diagnoses[0].isPrimary = true;
    diagnoses[0].caution =
      diagnoses[0].caution ?? 'no primary diagnosis was marked, so the first one was charted as primary';
  }
  return kept;
}

// ---------------------------------------------------------------------------------------------
// Deterministic backstops — chart and flag beats silently missing
// ---------------------------------------------------------------------------------------------

/**
 * Things the model drops often enough that recovering them in code is cheaper than another prompt rule.
 * Each one is additive and visible: an appended step carries the sentence it came from, so the provider
 * reviewing it sees exactly why it is there.
 */
function applyBackstops(actions: PlannedAction[], context: ResolvedGuardContext): PlannedAction[] {
  const out = [...actions];

  // 1) Vitals sweep. The model reports the first reading and drops rechecks — most often the SECOND of
  //    two serial blood pressures, or a vital phrased indirectly ("slightly tachycardic at 115").
  const charted = new Set(
    out
      .filter((action) => action.kind === 'set-vital')
      .map((action) => `${action.field}|${action.systolic ?? ''}/${action.diastolic ?? ''}|${action.value ?? ''}`)
  );
  for (const sniffed of sniffVitalsFromNarrative(context.narrative)) {
    const signature = `${sniffed.field}|${sniffed.systolic ?? ''}/${sniffed.diastolic ?? ''}|${sniffed.value ?? ''}`;
    if (charted.has(signature)) continue;
    // A field the model already charted with a DIFFERENT value is the recheck case, which is exactly
    // what this sweep is for — so only an identical reading is skipped, never the whole field.
    charted.add(signature);
    if (!isVitalField(sniffed.field)) continue;
    out.push({
      kind: 'set-vital',
      field: sniffed.field,
      display: sniffed.display,
      ...(sniffed.systolic != null ? { systolic: sniffed.systolic } : {}),
      ...(sniffed.diastolic != null ? { diastolic: sniffed.diastolic } : {}),
      // A NUMBER, not a string. The digit-loop guard declares numeric fields as strings in the response
      // schema and coerceNumericFields undoes that in guardOne — which has already run by the time the
      // backstops append anything, so a stringified reading here would reach the chart write uncoerced.
      ...(sniffed.value != null ? { value: sniffed.value } : {}),
      ...(sniffed.unit ? { unit: sniffed.unit } : {}),
      sourceText: sniffed.sourceText,
      caution: 'recovered from the dictation — the plan did not include this reading',
    } as PlannedAction);
  }

  // 2) A test the narrative reports as ALREADY PERFORMED WITH A RESULT must not be re-ordered. The
  //    prompt says so and the model re-orders anyway (roughly two cases in three: rapid strep, rapid
  //    flu), so the order is converted into a provider-note quoting the sentence. The sentence has to be
  //    about a test being RUN — not epidemiology ("coworkers have confirmed influenza") and not a future
  //    order ("send the urine out for culture").
  const RESULT_MARKERS =
    /\b(?:was performed|were performed|came back|returned|resulted|is positive|is negative|was positive|was negative|positive for|negative for|show(?:s|ed|ing)?|reveal(?:s|ed|ing)?)\b/i;
  const TEST_CONTEXT =
    /\b(?:test|tests|tested|performed|rapid|in[- ]?house|in[- ]?clinic|specimen|swab|urinalysis|x[- ]?ray|ecg|ekg)\b/i;
  const sentences = context.narrative.split(/(?<=[.!?])\s+/);
  for (const action of out) {
    if (action.kind !== 'add-in-house-lab' && action.kind !== 'add-external-lab') continue;
    const needles = [action.display ?? '', ...(action.searchTerms ?? [])]
      .flatMap((term) => term.toLowerCase().split(/[^a-z0-9]+/))
      .filter((word) => word.length >= 4);
    const sentence = sentences.find(
      (candidate) =>
        RESULT_MARKERS.test(candidate) &&
        TEST_CONTEXT.test(candidate) &&
        needles.some((needle) => candidate.toLowerCase().includes(needle))
    );
    if (!sentence) continue;
    const label = action.display ?? 'test';
    const converted = action as PlannedAction & { kind: string; text?: string };
    converted.kind = 'provider-note';
    converted.text = `The ${label} was already performed — enter its result through the labs flow. Dictated: ${sentence.trim()}`;
    converted.sourceText = sentence.trim();
    delete (converted as { display?: string }).display;
    delete (converted as { searchTerms?: string[] }).searchTerms;
  }

  // 3) eRx reminder: the narrative says a prescription is being SENT, a medication was charted, and
  //    nothing tells the provider that easy-chart does not transmit scripts.
  const sending = /\b(?:send(?:ing)?|sent)\b[^.;]{0,60}\b(?:pharmacy|prescription|script)\b|\bsend that over\b/i.exec(
    context.narrative
  );
  const hasMedication = out.some((action) => action.kind === 'add-medication');
  const hasErxNote = out.some(
    (action) => action.kind === 'provider-note' && /erx|prescription|pharmacy/i.test(action.text ?? '')
  );
  if (sending && hasMedication && !hasErxNote) {
    out.push({
      kind: 'provider-note',
      text: 'Send the prescription via eRx — the medication was charted, but easy-chart does not transmit prescriptions.',
      sourceText: sending[0],
    } as PlannedAction);
  }

  // 4) Numeric junk the model attaches to steps that have no reading (value=0.0012 on a patient
  //    instruction), so it never leaks into a payload or a log.
  for (const action of out) {
    if (action.kind === 'set-vital' || action.kind === 'add-medication') continue;
    delete (action as { value?: unknown }).value;
    delete (action as { unit?: unknown }).unit;
  }

  return out;
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
