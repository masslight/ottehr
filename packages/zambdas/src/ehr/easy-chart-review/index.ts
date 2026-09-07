// easy-chart-review — the automatic second look.
//
// Reads the note as WRITTEN back against the narrative it came from and returns SUGGESTIONS: each one a
// provider-facing question plus the actions that would answer it. It never writes. Requirements section 8
// governs what it checks; the checks themselves live in the shared prompt so the plan and review surfaces
// cannot drift apart in how an action is shaped.
//
// Why a separate endpoint from easy-chart-plan, when planning is deliberately ONE endpoint: this is not
// another way to chart a visit. Its input is a finished note, its output is proposals rather than a plan
// to execute, and it is offered a narrower slice of the vocabulary — a corrector, not an author.
//
// PHI: never logs a model response body, the narrative, or the note. Envelope only.

import { APIGatewayProxyResult } from 'aws-lambda';
import { ChartReviewResponse, PlannedAction, ReviewSuggestion } from 'utils/lib/easy-chart/api';
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { buildPrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { buildReviewResponseSchema } from 'utils/lib/easy-chart/schema';
import { detectDispositionLanguage } from 'utils/lib/easy-chart/sniffers';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { applyGuards, buildTriggerReports } from '../easy-chart-shared/guards';
import { createTerminologyIcdSearch } from '../easy-chart-shared/icd-search';
import { callModelForJson } from '../easy-chart-shared/model';
import { carrySwapPrimaryFromChartState } from '../easy-chart-shared/swap-primary';
import { buildNoteContext, describeChart, readVisitContext } from '../easy-chart-shared/visit-context';
import { getChartData } from '../get-chart-data';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-review';

// Lifted outside the handler so it survives warm invocations.
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets, narrative, encounterId } = params;

  await authorizeEasyChartRequest(input, encounterId, secrets, ZAMBDA_NAME);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // The SAME patient block the planner gets. Without it the tail renders "PATIENT STATUS: unknown", the
  // prompt's documented fallback picks the established E&M family, and review overwrites a correct
  // new-patient code from the plan — measurably, in 7 of 11 harvested cases. The chart wins over the
  // caller for the same reason it does in the planner.
  const visit = encounterId ? await readVisitContext(oystehr, encounterId, ZAMBDA_NAME) : undefined;

  // Read the chart here, not from the caller — same reason and same two calls as the planner. It matters
  // more on this surface: review's whole job is to compare the note AS WRITTEN against the narrative, so a
  // summary that omits a section is a section it cannot review.
  // No template list. `apply-template` is not in the review vocabulary, so the titles were a
  // round-trip per call whose only effect was to render a block naming an action this surface cannot
  // emit. The tail now omits it for any surface without the capability; not fetching it is the other
  // half of the same fix.
  const chart = encounterId ? await readChart(oystehr, m2mToken, encounterId) : undefined;
  // The block the removal guard and the primary carry-over match against. Server-read when there is an
  // encounter; the caller's string only when there is not.
  const chartStateText = chart ? buildChartStateSummary(chart) : params.chartState;
  const examFindings = chart ? chartedExamFindingLabels(chart) : params.chartedExamFindings;

  const tail: PromptTailInput = {
    narrative,
    patientLine: visit?.patientLine,
    patientStatus: visit?.patientStatus ?? params.patientStatus,
    chartStateSummary: describeChart(chartStateText, examFindings),
    noteContext: buildNoteContext(chart ? buildNoteContextFromChart(chart) : params.noteContext),
    // Deterministic disposition trigger. Left to the model's own judgement the check fired very
    // inconsistently — same corpus, no code change, coverage swung 53% → 36% → 35% — so the narrative is
    // scanned here and a hit with nothing charted becomes a must-address instruction. The model still
    // owns extraction and is told to decline when the match is not a disposition for THIS visit.
    mustAddress: buildDispositionInstruction(narrative, chartStateText),
  };
  const prompt = buildPrompt('review', tail);
  console.log(`[${ZAMBDA_NAME}] prompt ${prompt.length} chars, narrative ${narrative.length} chars`);

  const { parsed, usage, escalation } = await callModelForJson(
    prompt,
    // The SUGGESTION-CARD shape, not the bare action list: buildResponseSchema('review') returns
    // `{actions}`, which would tell the model to answer in a shape this handler does not parse.
    buildReviewResponseSchema(),
    secrets,
    ZAMBDA_NAME,
    (raw) => {
      const suggestions = (raw as { suggestions?: unknown })?.suggestions;
      if (!Array.isArray(suggestions)) throw new Error('response has no suggestions array');
      return suggestions as ReviewSuggestion[];
    }
  );

  // Every suggestion's actions go through the SAME guards the plan surface uses. A review that proposes a
  // hallucinated code or a removal targeting something not on the chart must be refused here, not trusted
  // because it came from the "corrector". Guarding per suggestion keeps each rejection attached to the
  // suggestion it belongs to.
  const chartedItems = [...(examFindings ?? []), ...splitChartState(chartStateText)];

  // ONE search function for the whole call. It carries the warm-call cache, so building one per
  // suggestion would pay for the same terminology round-trip on every card — and sharing it is what makes
  // guarding the cards CONCURRENTLY worth doing: the round-trips dominate a multi-card review's latency
  // and the cards are independent of each other.
  const icdSearch = createTerminologyIcdSearch(oystehr);

  // What the aetiology guard judges a qualifier against on this surface — see GuardContext.
  const etiologyEvidenceBase = [narrative, chartStateText ?? '', tail.noteContext ?? ''].join(' ');

  const rejected: ChartReviewResponse['rejected'] = [];
  const results = await Promise.all(
    parsed.map(async (suggestion) => {
      const proposed = (suggestion.actions ?? []) as PlannedAction[];
      // Verbatim gate FIRST, before a round-trip is spent on anything else: the prompt demands a
      // near-verbatim quote for a suggested ROS negative and the primary model still fabricates the
      // classics for the complaint ("Denies sinus pain" on an eye visit). Prose cannot enforce it; this
      // can.
      const quoted = proposed.filter((action) => {
        if (rosActionIsVerbatim(action, narrative)) return true;
        rejected.push({
          kind: action.kind,
          display: action.display,
          reason: `"${action.display}" is not something the dictation says, so it was not charted`,
        });
        return false;
      });
      // A "diagnosis"/"coherence" card pairs remove-diagnosis with add-diagnosis, and the prompt requires
      // the add to restate the removed diagnosis's isPrimary. The model reliably omits it, and a missing
      // flag charts as SECONDARY — leaving the note with no primary whenever the swap replaced the
      // primary one.
      carrySwapPrimaryFromChartState(quoted, chartStateText);
      const result = await applyGuards(quoted, {
        oystehr,
        icdSearch,
        narrative,
        etiologyEvidence: `${etiologyEvidenceBase} ${suggestion.rationale ?? ''}`,
        chartedItems,
        logPrefix: ZAMBDA_NAME,
      });
      return { suggestion, proposed: quoted, result };
    })
  );

  const guarded: ReviewSuggestion[] = [];
  for (const { suggestion, proposed, result } of results) {
    rejected.push(...result.rejected);
    const actions = dropOrphanedRemovals(proposed, result.actions, rejected);
    // A suggestion whose every action was refused has nothing left to offer, so it is dropped rather than
    // shown as a question the provider cannot act on. The refusals still surface in `rejected`.
    if (actions.length === 0) continue;
    // A swap that resolved back onto the code it replaces would churn the chart and change nothing. It
    // happens when the ICD search was itself the reason the first code was wrong, so the replacement
    // re-resolves to it.
    if (swapCancelsItself(actions)) {
      rejected.push({
        kind: 'add-diagnosis',
        display: suggestion.question,
        reason: 'the replacement diagnosis resolved to the same code it would replace, so nothing changed',
      });
      continue;
    }
    guarded.push({ ...suggestion, actions });
  }

  // Compliance is a property of the WHOLE response, not of one card — see buildTriggerReports.
  const triggers = buildTriggerReports(
    narrative,
    guarded.flatMap((suggestion) => suggestion.actions)
  );
  const disposition = triggers.find((trigger) => trigger.trigger === 'disposition-language-without-disposition');
  if (disposition) {
    // REPORT THE TRIGGER THIS SURFACE ACTUALLY APPLIED.
    //
    // The generic report keys `fired` off disposition language in the narrative alone, which is the right
    // question for the planner — it starts from an empty chart, so language means a disposition is owed.
    // On review it is the wrong question and reported a guard failure on every visit the PLANNER had
    // already got right: the narrative says "follow up in a week", the plan charted it, review correctly
    // says nothing, and the report called that "the trigger fired and the model ignored it". Six of six
    // on the harvested corpus, every run. What review was actually told to address is `mustAddress`, which
    // fires only when the language is there AND nothing is charted — so that is what `fired` must mean.
    disposition.fired = !!tail.mustAddress;
    // Read the model's RAW output too: a disposition it proposed and a guard then dropped still answered
    // the trigger, which is a different failure from declining it.
    if (parsed.some((suggestion) => suggestion.category === 'disposition')) disposition.complied = true;
  }

  console.log(
    `[${ZAMBDA_NAME}] suggestions=${guarded.length}/${parsed.length} rejected=${rejected.length} ` +
      `escalated=${escalation.escalated} attempts=${escalation.attempts}`
  );

  const response: ChartReviewResponse = { suggestions: guarded, rejected, usage, escalation, triggers };
  return { statusCode: 200, body: JSON.stringify(response) };
});

/**
 * Enforce the near-verbatim rule the prompt states for a suggested ROS negative: every meaningful word of
 * the symptom must actually appear in the dictation.
 *
 * Only ROS additions are judged. Everything else passes through — an exam finding is resolved against a
 * catalogue, a diagnosis against the terminology service, and a disposition is prose the provider reads.
 */
export function rosActionIsVerbatim(action: PlannedAction, narrative: string): boolean {
  if (action.kind !== 'add-ros-finding' || typeof action.display !== 'string') return true;
  const symptom = action.display.replace(/^(denies|reports)\b[:\s-]*/i, '');
  const words = symptom
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !['the', 'any', 'and', 'her', 'his'].includes(word));
  const haystack = narrative.toLowerCase();
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

/** The kinds whose removal only makes sense as half of a swap, paired with the addition that replaces it. */
const SWAP_PAIRS = [
  { add: 'add-diagnosis', remove: 'remove-diagnosis' },
  { add: 'add-cpt', remove: 'remove-cpt' },
  { add: 'add-medication', remove: 'remove-medication' },
] as const;

/**
 * Drop a removal whose replacement did not survive the guards.
 *
 * A correction card is a PAIR — remove the wrong item, add the right one — and when a guard refuses the
 * addition the removal must go with it. Left alone it becomes a BARE removal that takes the item off the
 * chart and puts nothing back: reproduced twice on the harvested corpus as a note left with zero
 * diagnoses, which is billing-invalid and strictly worse than the wrong code it "fixed".
 *
 * Surgical rather than dropping the whole card, so a valid unrelated action on the same card survives.
 */
export function dropOrphanedRemovals(
  proposed: PlannedAction[],
  guarded: PlannedAction[],
  rejected: ChartReviewResponse['rejected']
): PlannedAction[] {
  let kept = guarded;
  for (const { add, remove } of SWAP_PAIRS) {
    const wasASwap = proposed.some((action) => action.kind === add) && kept.some((action) => action.kind === remove);
    if (!wasASwap || kept.some((action) => action.kind === add)) continue;
    kept = kept.filter((action) => {
      if (action.kind !== remove) return true;
      rejected.push({
        kind: action.kind,
        display: action.display,
        reason: `the replacement for "${action.display}" could not be charted, so it was left in place`,
      });
      return false;
    });
  }
  return kept;
}

/** True when the card's addition resolved to a code the card also removes, so applying it is a no-op. */
export function swapCancelsItself(actions: PlannedAction[]): boolean {
  const removed = new Set(
    actions
      .filter((action) => action.kind === 'remove-diagnosis')
      .map((action) => {
        const inDisplay = /\(([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?)\)/.exec(action.display ?? '');
        return (action.code ?? inDisplay?.[1] ?? '').toUpperCase().replace(/\./g, '');
      })
      .filter(Boolean)
  );
  if (removed.size === 0) return false;
  return actions.some(
    (action) => action.kind === 'add-diagnosis' && removed.has((action.code ?? '').toUpperCase().replace(/\./g, ''))
  );
}

/** The chart-state summary as individual lines, for the removal guard to match against. */
function splitChartState(chartState?: string): string[] {
  if (!chartState) return [];
  return chartState
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * The forced disposition instruction, or undefined when there is nothing to force. Only fires when the
 * narrative states a disposition AND the chart state carries none — a hit on an already-charted
 * disposition would push the model to propose a duplicate.
 */
function buildDispositionInstruction(narrative: string, chartState: string | undefined): string | undefined {
  if (chartState && /^\s*-?\s*disposition\b/im.test(chartState)) return undefined;
  const match = detectDispositionLanguage(narrative);
  if (!match) return undefined;
  return (
    `The dictation states a disposition or follow-up plan ("${match.excerpt.trim()}") and none is charted. ` +
    'Address check 7 explicitly: either propose the set-disposition it supports, or say nothing about ' +
    'disposition if that phrase is not a plan for THIS visit.'
  );
}

/** Same pair the planner and the visit-note PDF use: default set, then the fields fetched only when named. */
async function readChart(
  oystehr: ReturnType<typeof createClinicalOystehrClient>,
  token: string,
  encounterId: string
): Promise<Awaited<ReturnType<typeof getChartData>>['response']> {
  const [base, scoped] = await Promise.all([
    getChartData(oystehr, token, encounterId),
    getChartData(oystehr, token, encounterId, progressNoteChartDataRequestedFields),
  ]);
  return { ...base.response, ...scoped.response };
}
