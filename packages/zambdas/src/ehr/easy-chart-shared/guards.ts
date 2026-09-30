// Server-side guards over the model's raw actions. Everything here runs before the client sees an
// action, and nothing is dropped silently: a refused action is returned in `rejected[]` with a reason
// the provider reads.

import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import {
  ActionKind,
  chartableFollowUpDays,
  PLANNABLE_VITAL_FIELDS,
  PlannableVitalField,
} from 'utils/lib/easy-chart/actions';
import { PlannedAction, RejectedAction, TriggerReport } from 'utils/lib/easy-chart/api';
import {
  isCptShaped,
  isPersonalHistoryCode,
  scanIcd10Codes,
  unsupportedEtiologyQualifiers,
} from 'utils/lib/easy-chart/codes';
import { IcdSearchFn, repairUnsupportedEtiology, resolveIcd } from 'utils/lib/easy-chart/icd-resolve';
import { findingPolarity, rosPolarity, verifiedSourceText } from 'utils/lib/easy-chart/provenance';
import {
  allowedFields,
  capabilityOf,
  declaredFields,
  isActionKind,
  missingRequiredFields,
  requiredFields,
} from 'utils/lib/easy-chart/registry';
import { detectDispositionLanguage, detectSpeakerLabels, sniffIcdCodeScoped } from 'utils/lib/easy-chart/sniffers';
import { parseVitalDisplay, recoverVitalReading, sniffVitalsFromNarrative } from 'utils/lib/easy-chart/vitals';
import { createTerminologyIcdSearch } from './icd-search';
import { ModelActionSchema } from './model-output';

export interface GuardContext {
  oystehr: Oystehr;
  narrative: string;
  /** The provider's edited narrative; a quote is verified against it when the narrative lacks it. */
  editedNarrative?: string;
  /** The narrative the provider reviewed; the only text readings the plan missed are recovered from. */
  dictation?: string;
  /** The ALREADY ON THE CHART block as the prompt showed it; a quote may cite one of its lines. */
  chartStateText?: string;
  logPrefix: string;
  /** Injected by tests; built from `oystehr` otherwise, once per invocation for its cache. */
  icdSearch?: IcdSearchFn;
  /**
   * What a code's aetiology qualifiers are judged against; defaults to the narrative. Never includes the
   * action's own display, since a qualifier the model invented must not excuse itself.
   */
  etiologyEvidence?: string;
}

interface ResolvedGuardContext extends GuardContext {
  icdSearch: IcdSearchFn;
  /** Code-shaped transcript tokens that are speaker tags ("DOCTOR X31"), not diagnoses. */
  speakerLabels: Set<string>;
}

export interface GuardResult {
  actions: PlannedAction[];
  rejected: RejectedAction[];
  triggers: TriggerReport[];
}

const isVitalField = (value: unknown): value is PlannableVitalField =>
  typeof value === 'string' && (PLANNABLE_VITAL_FIELDS as readonly string[]).includes(value);

/** Per-action guards first, then the invariants that need the whole list, then the backstops. */
export async function applyGuards(raw: unknown[], context: GuardContext): Promise<GuardResult> {
  const resolved: ResolvedGuardContext = {
    ...context,
    icdSearch: context.icdSearch ?? createTerminologyIcdSearch(context.oystehr),
    speakerLabels: detectSpeakerLabels(context.narrative),
  };
  const actions: PlannedAction[] = [];
  const rejected: RejectedAction[] = [];

  // The model repeats identical readings; each would chart as another observation. A genuine recheck
  // has a different value and is kept.
  const seenVitals = new Set<string>();
  for (const item of raw) {
    const outcome = await guardOne(item, resolved);
    if ('rejected' in outcome) {
      rejected.push(outcome.rejected);
      continue;
    }
    if (outcome.action.kind === 'set-vital') {
      const key = vitalReadingKey(outcome.action);
      if (seenVitals.has(key)) {
        console.log(`[${context.logPrefix}] dropped a repeated ${outcome.action.field} reading`);
        continue;
      }
      seenVitals.add(key);
    }
    actions.push(outcome.action);
  }

  const deduped = enforceDiagnosisInvariants(actions, rejected);
  const complete = applyBackstops(deduped, resolved);
  const provenance = complete.reduce(
    (counts, action) => {
      counts[action.sourceOrigin ?? 'none'] += 1;
      return counts;
    },
    { narrative: 0, 'edited-narrative': 0, chart: 0, none: 0 }
  );
  console.log(
    `[${context.logPrefix}] provenance: narrative=${provenance.narrative} edited-narrative=${provenance['edited-narrative']} chart=${provenance.chart} inferred=${provenance.none}`
  );
  return { actions: complete, rejected, triggers: buildTriggerReports(context.narrative, complete) };
}

type GuardOutcome = { action: PlannedAction } | { rejected: RejectedAction };

async function guardOne(input: unknown, context: ResolvedGuardContext): Promise<GuardOutcome> {
  const parsed = ModelActionSchema.safeParse(input);
  if (!parsed.success) {
    return { rejected: { kind: 'unknown', reason: 'the assistant returned a malformed action' } };
  }
  const bag: Record<string, unknown> = { ...parsed.data };

  const kind = bag.kind;
  if (!isActionKind(kind)) {
    return { rejected: { kind: String(kind), reason: `"${kind}" is not an action this build knows` } };
  }

  // Strip fields this kind does not declare: a field leaked from another kind's shape can change what
  // the executor charts. A code-shaped value in a leaked field is salvaged first, since code lookup is
  // far more reliable than description search (S-chapter injury codes especially).
  const allowed = new Set<string>(allowedFields(kind));
  const leaked = Object.keys(bag).filter((field) => !allowed.has(field));
  if ((kind === 'add-diagnosis' || kind === 'add-condition') && !(bag.code as string | undefined)?.trim()) {
    const salvaged = scanIcd10Codes(JSON.stringify(leaked.map((field) => bag[field])))[0];
    if (salvaged) {
      console.log(`[${context.logPrefix}] recovered ${salvaged} from a misplaced field on ${kind}`);
      bag.code = salvaged;
    }
  }
  for (const field of leaked) delete bag[field];
  const action = bag as unknown as PlannedAction;

  // Keep the quote only if it really occurs in the narrative, the edited narrative or the chart block,
  // in that order; otherwise the action is marked inferred.
  const fromNarrative = verifiedSourceText(action.sourceText, context.narrative);
  const fromEdited =
    fromNarrative === undefined && context.editedNarrative
      ? verifiedSourceText(action.sourceText, context.editedNarrative)
      : undefined;
  const fromChart =
    fromNarrative === undefined && fromEdited === undefined && context.chartStateText
      ? verifiedSourceText(action.sourceText, context.chartStateText)
      : undefined;
  action.sourceText = fromNarrative ?? fromEdited ?? fromChart;
  if (fromNarrative !== undefined) action.sourceOrigin = 'narrative';
  else if (fromEdited !== undefined) action.sourceOrigin = 'edited-narrative';
  else if (fromChart !== undefined) action.sourceOrigin = 'chart';

  // A set-vital without a display can still be recovered from the narrative in guardVital.
  const missing = missingRequiredFields(kind, action).filter((field) => kind !== 'set-vital' || field !== 'display');
  if (missing.length > 0) {
    return {
      rejected: {
        kind,
        display: action.display,
        reason: `the assistant did not supply ${missing.join(' and ')}, so this could not be charted`,
      },
    };
  }
  const unacceptable = checkValues(kind, bag, context.logPrefix);
  if (unacceptable) return { rejected: { kind, display: action.display, reason: unacceptable } };

  switch (kind) {
    case 'set-vital':
      return guardVital(action, context);
    case 'add-diagnosis':
    case 'add-condition':
      return guardDiagnosisLike(action, context);
    case 'set-em-code':
      return guardEmCode(action, context);
    case 'add-exam-finding':
      return guardExamFinding(action);
    case 'add-ros-finding':
      return guardRosFinding(action);
    case 'set-disposition':
      return guardDisposition(action);
    default:
      return { action };
  }
}

/**
 * The declared fields checked against the registry shape: the backup model decodes without the schema,
 * so an enum can come back as anything. A blank string counts as absent, as it does for required fields.
 * A bad optional value is dropped; a bad required one refuses the action. Valid values are kept as the
 * shape outputs them, so a guarded numeric becomes a number.
 */
function checkValues(kind: ActionKind, bag: Record<string, unknown>, logPrefix: string): string | undefined {
  const shape = capabilityOf(kind).shape.partial();
  for (const field of declaredFields(kind)) {
    if (typeof bag[field] === 'string' && (bag[field] as string).trim() === '') delete bag[field];
  }
  const present = declaredFields(kind).filter((field) => bag[field] !== undefined);
  const fields: Record<string, unknown> = Object.fromEntries(present.map((field) => [field, bag[field]]));
  let result = shape.safeParse(fields);
  if (!result.success) {
    const invalid = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    const required = new Set<string>(requiredFields(kind));
    const badRequired = invalid.find((field) => required.has(field));
    if (badRequired)
      return `${badRequired} "${String(bag[badRequired]).slice(0, 60)}" is not something the chart accepts`;
    console.log(`[${logPrefix}] dropped ${invalid.join(', ')} on ${kind}: values the chart does not accept`);
    for (const field of invalid) delete fields[field];
    result = shape.safeParse(fields);
    if (!result.success) return 'the assistant returned values the chart does not accept';
  }
  for (const field of present) delete bag[field];
  for (const [field, value] of Object.entries(result.data)) if (value !== undefined) bag[field] = value;
  return undefined;
}

/** The canonical reading of a guarded set-vital: field plus value in its canonical unit. */
function vitalReadingKey(action: PlannedAction): string {
  if (action.systolic != null && action.diastolic != null) {
    return `${action.field}|${action.systolic}/${action.diastolic}`;
  }
  return `${action.field}|${action.value}|${action.unit ?? ''}`;
}

function guardVital(action: PlannedAction, context: ResolvedGuardContext): GuardOutcome {
  if (!isVitalField(action.field)) {
    return { rejected: { kind: 'set-vital', display: action.display, reason: `"${action.field}" is not a vital` } };
  }
  const field = action.field;

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
    // Never chart or silently reinterpret an implausible or unit-less reading.
    case 'implausible':
    case 'unrecognized-unit':
    case 'missing-unit':
    case 'no-value':
      return { rejected: { kind: 'set-vital', display, reason: parsed.reason } };
  }
}

/**
 * Confirm the code against the terminology service, falling back to a search on the display. The
 * charted code and display always come from one terminology row, never a model code with a searched
 * display or vice versa.
 */
async function guardDiagnosisLike(action: PlannedAction, context: ResolvedGuardContext): Promise<GuardOutcome> {
  const kind = action.kind as 'add-diagnosis' | 'add-condition';
  // The model sometimes decorates the code ("ICD-10: J02.0", "(j02.0)"); keep the code itself.
  if (action.code) action.code = scanIcd10Codes(action.code.toUpperCase())[0] ?? action.code;

  // Narratives often carry the code inline ("Acute otitis media, right ear (H66.91)").
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

  // A qualifier the visit does not support ("gonococcal" for a yeast infection) makes the code wrong.
  // Repair to the unqualified sibling first; refuse only when there is none.
  const evidence = context.etiologyEvidence ?? context.narrative;
  const unsupported = unsupportedEtiologyQualifiers(row.display, evidence);
  if (unsupported.length > 0) {
    const repaired = await repairUnsupportedEtiology(context.icdSearch, row, evidence);
    if (!repaired) {
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

  // A "history of" Z-code is fine for past history (add-condition), not for a current visit diagnosis.
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
  // "99214 (moderate)" or "CPT 99214" is the code 99214.
  const code = /\b\d{5}\b/.exec(action.code ?? '')?.[0] ?? action.code?.trim();
  if (!code || !isCptShaped(code)) {
    return { rejected: { kind: 'set-em-code', display: code, reason: `"${code}" is not a CPT-shaped E&M code` } };
  }
  const row = await searchCpt(context, code);
  if (row === 'degraded') return { action };
  if (!row) {
    return { rejected: { kind: 'set-em-code', display: code, reason: `E&M code ${code} is not a real CPT code` } };
  }
  action.code = row.code;
  action.display = row.display;
  return { action };
}

/**
 * `undefined`: the service answered and the code is not real. `degraded`: the service could not be
 * reached, so the model's code is kept rather than silently stripping billing for the whole outage.
 */
async function searchCpt(
  context: ResolvedGuardContext,
  code: string
): Promise<{ code: string; display: string } | undefined | 'degraded'> {
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

/**
 * A normal exam finding charts only when the provider voiced it: its quote verified against the
 * narrative or the edited narrative. Abnormal findings are charted even when inferred.
 */
function guardExamFinding(action: PlannedAction): GuardOutcome {
  const voiced = action.sourceOrigin === 'narrative' || action.sourceOrigin === 'edited-narrative';
  if (findingPolarity(action.display ?? '') !== 'positive' && !voiced) {
    return {
      rejected: {
        kind: 'add-exam-finding',
        display: action.display,
        reason: `"${action.display}" is a normal finding nobody voiced — exam normals chart only when the provider said them`,
      },
    };
  }
  return { action };
}

/** ROS carries its polarity in the display verb; a finding with neither verb cannot be filed. */
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
 * The follow-up interval must be one the Disposition card offers for the type (the type itself is
 * checked against the registry). An interval it cannot show is dropped and stays in the disposition text.
 */
function guardDisposition(action: PlannedAction): GuardOutcome {
  if (action.followUpInDays != null && chartableFollowUpDays(action.dispositionType, action.followUpInDays) == null) {
    delete action.followUpInDays;
    action.caution = 'the chart has no follow-up option for that interval, so it is kept in the disposition text only';
  }
  return { action };
}

/**
 * No diagnosis twice, at most one primary and at least one: the model often marks none, and a note
 * without a primary is not billable.
 */
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
        action.isPrimary = false;
        action.caution = 'a primary diagnosis was already set, so this was charted as secondary';
      } else {
        primaryTaken = true;
      }
    }
    kept.push(action);
  }

  const firstDiagnosis = kept.find((action) => action.kind === 'add-diagnosis');
  if (firstDiagnosis && !primaryTaken) {
    firstDiagnosis.isPrimary = true;
    firstDiagnosis.caution ??= 'no primary diagnosis was marked, so the first one was charted as primary';
  }
  return kept;
}

/**
 * Deterministic recovery of what the model drops often enough to be worth code. Every appended action
 * carries the sentence it came from, so the provider sees why it is there.
 */
function applyBackstops(actions: PlannedAction[], context: ResolvedGuardContext): PlannedAction[] {
  const out = [...actions];

  // Vital readings the plan missed, most often the second of two serial measurements. Only an
  // identical reading counts as charted, never the whole field.
  const signature = (vital: { field?: string; systolic?: unknown; diastolic?: unknown; value?: unknown }): string =>
    `${vital.field}|${vital.systolic ?? ''}/${vital.diastolic ?? ''}|${vital.value ?? ''}`;
  const charted = new Set(out.filter((action) => action.kind === 'set-vital').map(signature));
  for (const sniffed of context.dictation ? sniffVitalsFromNarrative(context.dictation) : []) {
    if (charted.has(signature(sniffed)) || !isVitalField(sniffed.field)) continue;
    charted.add(signature(sniffed));
    out.push({
      kind: 'set-vital',
      field: sniffed.field,
      display: sniffed.display,
      ...(sniffed.systolic != null ? { systolic: sniffed.systolic } : {}),
      ...(sniffed.diastolic != null ? { diastolic: sniffed.diastolic } : {}),
      ...(sniffed.value != null ? { value: sniffed.value } : {}),
      ...(sniffed.unit ? { unit: sniffed.unit } : {}),
      sourceText: sniffed.sourceText,
      sourceOrigin: 'edited-narrative',
      caution: 'recovered from the dictation — the plan did not include this reading',
    });
  }

  // The narrative says a prescription is being sent and a medication was charted: remind the provider
  // that Easy Chart does not transmit prescriptions.
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
      sourceOrigin: 'narrative',
    });
  }

  return out;
}

/**
 * Whether each deterministic trigger fired and whether the actions answer it. Counts and pattern labels
 * only, never narrative text.
 */
function buildTriggerReports(narrative: string, actions: PlannedAction[]): TriggerReport[] {
  const disposition = detectDispositionLanguage(narrative);
  const prescriptionCommitment = /\bi'?ll send\b|\blet me get you on\b|\bwe'?ll start\b|\bi'?m going to treat\b/.test(
    narrative.toLowerCase()
  );
  return [
    {
      trigger: 'disposition-language-without-disposition',
      fired: disposition !== undefined,
      complied: actions.some((a) => a.kind === 'set-disposition'),
      ...(disposition ? { matchedPattern: disposition.pattern } : {}),
    },
    {
      trigger: 'em-code-always-required',
      fired: actions.length > 0,
      complied: actions.some((a) => a.kind === 'set-em-code'),
    },
    {
      trigger: 'voiced-prescription-commitment',
      fired: prescriptionCommitment,
      complied: actions.some((a) => a.kind === 'add-medication' || a.kind === 'provider-note'),
    },
  ];
}
