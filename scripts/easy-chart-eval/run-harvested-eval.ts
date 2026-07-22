/**
 * run-harvested-eval.ts — run every harvested prod case (caseNNN.json) through the full
 * easy-chart flow headlessly and score the result against the provider-charted gold:
 *
 *   1. easy-chart-planner over the raw transcript (empty note, fresh chart);
 *   2. replay the plan steps through the REAL client matchers (intent-logic / exam-ros-catalog)
 *      into a simulated charted state, mirroring useChartAssistant's dispatch rules;
 *   3. easy-chart-review over (narrative + chartState summary + current note text), then apply
 *      the suggestions' actions into the state the way the client's runReview does (review
 *      edit-note-text on a non-empty field queues for confirmation instead of applying);
 *   4. score with score-harvested.ts (planner-only vs post-review) and aggregate.
 *
 * Per-case artifacts land in <outDir>: caseNNN.result.json (full plan/review/state) and
 * caseNNN.score.json; the run ends with summary.json + an aggregate table.
 *
 * Usage (local zambda server must be running):
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/run-harvested-eval.ts [casesDir] [outDir] [flags]
 *
 * Flags:
 *   --cases=case002,case019,...  run only these caseIds (retry filter); per-case result/score
 *                                files interleave safely with an existing results dir, and the
 *                                aggregate summary.json is rebuilt from ALL score files present.
 *   --rescore-summary            no zambda calls — just rebuild summary.json from the score
 *                                files already in outDir (use after a partial rerun, or after
 *                                re-scoring via score-harvested.ts standalone mode).
 *   --self-test                  offline fixtures for the review dx-swap primary carry/promotion
 *                                sim (runs the real client helpers; no zambdas, no case data).
 *   --redispatch=<resultsDir>    offline: re-run the DETERMINISTIC sim over each stored
 *                                caseNNN.result.json's planSteps + recorded reviewSuggestions
 *                                (replayed verbatim — no planner/review/model calls) and rewrite
 *                                finalState + chartStateSentToReview in place. Every other field
 *                                (usage, planSteps, reviewSuggestions, patientStatusSent,
 *                                primaryFix, dispositionTrigger) is preserved. Use after a sim
 *                                fix (e.g. template dx application) to refresh old runs; re-score
 *                                afterwards via score-harvested.ts standalone mode.
 *   --review-only=<srcDir>       A/B the REVIEW model without re-running the (nondeterministic)
 *                                planner: per case, load the recorded planSteps (+ the recorded
 *                                patientStatusSent, reused verbatim for parity) from
 *                                <srcDir>/caseNNN.result.json, rebuild the pre-review sim state
 *                                by replaying them through the current applyStep, then run the
 *                                review call + suggestion application + scoring as normal into
 *                                outDir. Source results with a recorded error are skipped with a
 *                                note. Composes with --cases. Typical A/B: source = a completed
 *                                full run (harvested-results/run3), target outDir = a fresh dir
 *                                (harvested-results/run3-sonnet-review), review model switched
 *                                via the EASY_CHART_REVIEW_MODEL secret in the local server env.
 *                                Replay fidelity: the rebuilt chartState is byte-compared to the
 *                                source's recorded chartStateSentToReview and the verdict stored
 *                                as replayChartStateMatches (a mismatch means matcher/catalog
 *                                drift since the source run).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import {
  DiagnosisDTO,
  EasyChartAgentIntent,
  EasyChartPlannerStep,
  EasyChartSuggestion,
  EasyChartTokenUsage,
  ExamObservationDTO,
  GetChartDataResponse,
  rosField,
  RosFindingState,
} from 'utils';
import {
  EXAM_LEAVES,
  ExamLeaf,
  FIELD_TO_SECTION_LABEL,
  ROS_LEAVES,
} from '../../apps/ehr/src/features/easy-charting/exam-ros-catalog';
import {
  buildExamRemoveItems,
  carrySwapPrimary,
  findExamLeafMatchesScored,
  findExamRemoveMatchesScored,
  findRosLeafMatchesScored,
  findRosRemoveMatchesScored,
  inferExamSectionLabel,
  pickPrimaryPromotion,
  preferredExamLeaf,
} from '../../apps/ehr/src/features/easy-charting/intent-logic';
import { GoldData } from './harvest-shared';
import {
  aggregateScores,
  CaseScore,
  CaseUsage,
  DispositionTriggerInfo,
  emptySimState,
  formatCaseLine,
  formatSummary,
  nameMatch,
  normCode,
  normName,
  scoreCase,
  SimDiagnosis,
  SimFinalState,
  SimSource,
} from './score-harvested';
import { resolveTemplateByDisplay } from './template-catalog';

// ---------------------------------------------------------------------------
// Auth + zambda plumbing (same pattern as run-eval-batch.ts / run-planner-batch.ts)
// ---------------------------------------------------------------------------
function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function getToken(): Promise<string> {
  const res = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function callZambda<T>(name: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`http://localhost:3000/local/zambda/${name}/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-zapehr-project-id': need('PROJECT_ID'),
    },
    body: JSON.stringify(body),
  });
  const j: any = await res.json().catch(() => undefined);
  if (!res.ok) {
    const msg = typeof j?.error === 'string' ? j.error : typeof j?.message === 'string' ? j.message : '';
    throw new Error(`${name} HTTP ${res.status}${msg ? `: ${msg.slice(0, 200)}` : ''}`);
  }
  return (j?.output ?? j) as T;
}

// ---------------------------------------------------------------------------
// Plan/suggestion step simulation — mirrors useChartAssistant.dispatchIntent's
// non-interactive paths using the same matchers the client uses.
// ---------------------------------------------------------------------------
type Step = EasyChartPlannerStep & Record<string, any>;

// Verbatim from useChartAssistant's add-exam-finding dispatch (negation + normalcy detection).
const EXAM_NEGATED_RE = /\b(no|not|non|without|denies?|denied|negative|absent|neg)\b/i;
const EXAM_NORMAL_RE =
  /\b(?:normal|intact|unremarkable|brisk|strong|supple|patent|clear|symmetric|regular|calm|comfortable|playful|interactive|consolable)\b|\bwell[- ](?:appearing|hydrated)\b|\b[0-9]\s*(?:\+|plus)\b|\b5 out of 5\b|\b5\s*\/\s*5\b|\b20\/20\b/i;

const norm = (t: string): string =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function writeExamComment(state: SimFinalState, section: string, text: string, source: SimSource): void {
  // Dedupe like the client's writeExamComment: skip when the section note already contains it.
  const existing = state.examComments.find((c) => c.section === section && norm(c.text).includes(norm(text)));
  if (existing) return;
  state.examComments.push({ section, text, source });
}

function activeExam(state: SimFinalState): SimExamObsList {
  return state.examObservations.filter((o) => !o.removed);
}
type SimExamObsList = SimFinalState['examObservations'];

function applyExamFinding(state: SimFinalState, step: Step, source: SimSource): void {
  const intent = {
    kind: 'add-exam-finding' as const,
    display: String(step.display),
    searchTerms: step.searchTerms ?? [],
  };
  const scoredMatches = findExamLeafMatchesScored(intent, EXAM_LEAVES);
  const isNegated = EXAM_NEGATED_RE.test(intent.display);
  const inferSection = (): string | undefined =>
    inferExamSectionLabel(`${intent.display} ${(intent.searchTerms ?? []).join(' ')}`);
  // Negation guard: a negated finding whose every match is an abnormal checkbox must not chart
  // (it would assert the opposite) — it goes to the section's free-text area instead.
  if (isNegated && scoredMatches.length > 0 && scoredMatches.every((s) => s.leaf.normalAbnormal === 'abnormal')) {
    writeExamComment(state, inferSection() ?? scoredMatches[0].leaf.section, intent.display, source);
    return;
  }
  const obs = activeExam(state);
  const isAlreadyChecked = (leaf: ExamLeaf): boolean => {
    const parent = obs.find((o) => o.field === leaf.field);
    if (!parent) return false;
    if (leaf.modalOption)
      return (parent.components ?? []).some((c) => !c.removed && c.code === leaf.modalOption!.optionCode);
    return true;
  };
  const remainingScored = scoredMatches.filter((s) => !isAlreadyChecked(s.leaf));
  const chartLeaf = (leaf: ExamLeaf): void => {
    if (leaf.modalOption) {
      const parent = obs.find((o) => o.field === leaf.field);
      const component = {
        code: leaf.modalOption.optionCode,
        label: leaf.modalOption.optionLabel,
        abnormal: leaf.modalOption.abnormal,
        source,
      };
      if (parent) {
        parent.components = [...(parent.components ?? []).filter((c) => c.code !== component.code), component];
      } else {
        state.examObservations.push({
          field: leaf.field,
          label: leaf.modalOption.parentLabel,
          components: [component],
          source,
        });
      }
    } else {
      state.examObservations.push({ field: leaf.field, label: leaf.label, source });
    }
  };
  if (scoredMatches.length === 0) {
    writeExamComment(state, inferSection() ?? 'General Appearance', intent.display, source);
  } else if (remainingScored.length === 0) {
    state.skipped.push({ kind: intent.kind, display: intent.display, reason: 'already on the exam' });
  } else if (isAlreadyChecked(scoredMatches[0].leaf)) {
    // Top match already charted: skip, unless it's a NORMAL that lexically shadowed a comparable
    // not-yet-charted ABNORMAL (chart the abnormal in that case).
    const top = scoredMatches[0];
    const abnormalAlt = remainingScored.find((s) => s.leaf.normalAbnormal === 'abnormal' && s.score >= top.score * 0.5);
    if (top.leaf.normalAbnormal === 'normal' && abnormalAlt) chartLeaf(abnormalAlt.leaf);
    else state.skipped.push({ kind: intent.kind, display: intent.display, reason: 'top match already charted' });
  } else if (remainingScored[0].score < 3) {
    // Confidence floor for the no-stopping auto-pick — free-text the finding rather than guess.
    writeExamComment(state, inferSection() ?? remainingScored[0].leaf.section, intent.display, source);
  } else {
    chartLeaf(
      preferredExamLeaf(remainingScored, { queryNegated: isNegated, queryNormal: EXAM_NORMAL_RE.test(intent.display) })
    );
  }
}

function applyRosFinding(state: SimFinalState, step: Step, source: SimSource): void {
  const display = String(step.display);
  const verb = /^(denies|reports)\b[:\s-]*/i.exec(display);
  const finding: 'reports' | 'denies' = verb
    ? verb[1].toLowerCase() === 'denies'
      ? 'denies'
      : 'reports'
    : step.finding === 'denies'
    ? 'denies'
    : 'reports';
  const symptom = display.replace(/^(denies|reports)\b[:\s-]*/i, '').trim();
  const scored = findRosLeafMatchesScored(
    { kind: 'add-ros-finding', display: symptom || display, searchTerms: step.searchTerms ?? [] },
    ROS_LEAVES
  );
  const active = state.rosObservations.filter((o) => !o.removed);
  const remaining = scored.filter((s) => !active.some((o) => o.baseKey === s.leaf.baseKey && o.finding === finding));
  if (scored.length === 0) {
    state.skipped.push({ kind: 'add-ros-finding', display, reason: 'no ROS catalog match' });
  } else if (remaining.length === 0) {
    state.skipped.push({ kind: 'add-ros-finding', display, reason: 'already charted' });
  } else {
    const leaf = remaining[0].leaf;
    // Paired-state flip: charting denies un-checks a charted reports for the same item (and
    // vice versa), same as handleRosPick.
    const paired = active.find((o) => o.baseKey === leaf.baseKey && o.finding !== finding);
    if (paired) {
      paired.removed = true;
      paired.removedBy = source;
    }
    state.rosObservations.push({
      baseKey: leaf.baseKey,
      field: rosField(leaf.baseKey, finding === 'denies' ? RosFindingState.Denies : RosFindingState.Reports),
      label: leaf.label,
      finding,
      source,
    });
  }
}

// Extract an ICD-10-looking code embedded in a remove-diagnosis display, same regex the review
// zambda uses for its self-defeating-swap guard.
const ICD_IN_DISPLAY = /\(([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?)\)/;

function removeByMatch<T extends { display: string; code?: string; removed?: boolean; removedBy?: SimSource }>(
  items: T[],
  step: Step,
  source: SimSource
): boolean {
  const active = items.filter((i) => !i.removed);
  const codeRaw = typeof step.code === 'string' ? step.code : ICD_IN_DISPLAY.exec(String(step.display ?? ''))?.[1];
  const code = normCode(codeRaw);
  let hit = code ? active.find((i) => normCode(i.code) === code) : undefined;
  if (!hit && step.display) hit = active.find((i) => nameMatch(i.display, String(step.display)));
  if (!hit) return false;
  hit.removed = true;
  hit.removedBy = source;
  return true;
}

// Extension fields recorded on the sim state (extra keys are ignored by score-harvested, which
// only reads the fields it knows). Surfaced inside finalState in the result JSON and aggregated
// into the end-of-run console summary so silent template-resolution gaps are visible.
export type SimStateWithTemplateStats = SimFinalState & {
  templateDxApplied?: number;
  templateTitleUnmatched?: string[];
};
// Mirrors the client's AiChartedMeta.templateName marker on template-applied items
// (useChartAssistant's handleApplyTemplate flagNew) so downstream analysis can tell a
// template-default dx from a planner-emitted one.
type SimTemplateDiagnosis = SimDiagnosis & { templateName: string };

// Exported so the sim can be replayed/smoke-tested from persisted planSteps without zambda calls.
export function applyStep(state: SimFinalState, step: Step, source: SimSource): void {
  switch (step.kind) {
    case 'apply-template': {
      const title = String(step.display ?? '');
      state.templatesApplied.push(title);
      const stats = state as SimStateWithTemplateStats;
      stats.templateDxApplied ??= 0;
      stats.templateTitleUnmatched ??= [];
      // Resolve against the seed catalog the way the client resolves against the live template
      // list (findTemplateMatches, best match auto-applied). Only the template's DIAGNOSES are
      // simulated — its exam/MDM/instruction contents still are not (see buildChartStateText).
      const template = resolveTemplateByDisplay(title);
      if (!template) {
        stats.templateTitleUnmatched.push(title);
        return;
      }
      for (const dx of template.diagnoses) {
        // Mirrors the apply-template zambda's append semantics (makeCreateRequests): a dx whose
        // ICD-10 code is already on the chart is skipped; otherwise it charts with the template's
        // rank — primary (rank 1) unless the chart already has a primary, which is never usurped.
        const active = state.diagnoses.filter((d) => !d.removed);
        if (active.some((d) => normCode(d.code) === normCode(dx.code))) {
          state.skipped.push({
            kind: step.kind,
            display: `${dx.code} — ${dx.display}`,
            reason: 'template dx already charted',
          });
          continue;
        }
        const hasPrimary = active.some((d) => d.isPrimary);
        const templateDx: SimTemplateDiagnosis = {
          display: dx.display,
          code: dx.code,
          ...(dx.rank === 1 && !hasPrimary ? { isPrimary: true } : {}),
          source,
          templateName: template.title,
        };
        state.diagnoses.push(templateDx);
        stats.templateDxApplied++;
      }
      return;
    }
    case 'add-diagnosis': {
      const code = normCode(step.code);
      const active = state.diagnoses.filter((d) => !d.removed);
      if (
        active.some((d) => (code ? normCode(d.code) === code : normName(d.display) === normName(String(step.display))))
      ) {
        state.skipped.push({ kind: step.kind, display: step.display, reason: 'duplicate diagnosis' });
        return;
      }
      // A charted primary is never usurped by a later add (matches the client's incremental rule);
      // a review dx-swap removes the primary first, freeing the slot.
      const hasPrimary = active.some((d) => d.isPrimary);
      state.diagnoses.push({
        display: String(step.display ?? ''),
        ...(step.code ? { code: String(step.code) } : {}),
        ...(step.isPrimary && !hasPrimary ? { isPrimary: true } : {}),
        source,
      });
      return;
    }
    case 'remove-diagnosis':
      if (!removeByMatch(state.diagnoses, step, source))
        state.skipped.push({ kind: step.kind, display: step.display, reason: 'no charted diagnosis matched' });
      return;
    case 'add-condition':
      state.conditions.push({
        display: String(step.display ?? ''),
        ...(step.code ? { code: String(step.code) } : {}),
        source,
      });
      return;
    case 'remove-condition':
      if (!removeByMatch(state.conditions, step, source))
        state.skipped.push({ kind: step.kind, display: step.display, reason: 'no charted condition matched' });
      return;
    case 'add-allergy':
      state.allergies.push({ display: String(step.display ?? ''), source });
      return;
    case 'remove-allergy':
      if (!removeByMatch(state.allergies, step, source))
        state.skipped.push({ kind: step.kind, display: step.display, reason: 'no charted allergy matched' });
      return;
    case 'add-surgical-history':
      state.surgicalHistory.push({ display: String(step.display ?? ''), source });
      return;
    case 'add-hospitalization':
      state.hospitalizations.push({ display: String(step.display ?? ''), source });
      return;
    case 'add-medication':
      state.medications.push({
        display: String(step.display ?? ''),
        ...(step.strength ? { strength: String(step.strength) } : {}),
        source,
      });
      return;
    case 'remove-medication':
      if (!removeByMatch(state.medications, step, source))
        state.skipped.push({ kind: step.kind, display: step.display, reason: 'no charted medication matched' });
      return;
    case 'set-em-code':
      state.emEvents.push({ type: 'set', code: String(step.code ?? ''), display: step.display, source });
      return;
    case 'remove-em-code':
      state.emEvents.push({ type: 'remove', source });
      return;
    case 'add-cpt': {
      const code = normCode(step.code);
      if (state.cptCodes.some((c) => !c.removed && normCode(c.code) === code)) {
        state.skipped.push({ kind: step.kind, display: step.display, reason: 'duplicate CPT' });
        return;
      }
      state.cptCodes.push({ display: String(step.display ?? ''), code: String(step.code ?? ''), source });
      return;
    }
    case 'remove-cpt': {
      const code = normCode(step.code);
      const hit = state.cptCodes.find((c) => !c.removed && normCode(c.code) === code);
      if (hit) {
        hit.removed = true;
        hit.removedBy = source;
      } else state.skipped.push({ kind: step.kind, display: step.code, reason: 'no charted CPT matched' });
      return;
    }
    case 'add-exam-finding':
      applyExamFinding(state, step, source);
      return;
    case 'remove-exam-finding': {
      // Reuse the client's remove matcher over DTO-shaped copies of the simulated observations.
      const dtos: ExamObservationDTO[] = activeExam(state).map((o) => ({
        field: o.field,
        label: o.label,
        value: true,
        resourceId: o.field,
        components: (o.components ?? [])
          .filter((c) => !c.removed)
          .map((c) => ({ code: c.code, label: c.label, value: true, abnormal: c.abnormal })),
      })) as unknown as ExamObservationDTO[];
      const scored = findExamRemoveMatchesScored(
        { kind: 'remove-exam-finding', display: String(step.display ?? ''), searchTerms: step.searchTerms ?? [] },
        buildExamRemoveItems(dtos)
      );
      const top = scored[0]?.leaf;
      if (!top) {
        state.skipped.push({ kind: step.kind, display: step.display, reason: 'no charted exam finding matched' });
        return;
      }
      const target = activeExam(state).find((o) => o.field === top.observationField);
      if (!target) return;
      if (top.componentCode) {
        const comp = (target.components ?? []).find((c) => !c.removed && c.code === top.componentCode);
        if (comp) {
          comp.removed = true;
          comp.removedBy = source;
        }
      } else {
        target.removed = true;
        target.removedBy = source;
      }
      return;
    }
    case 'add-ros-finding':
      applyRosFinding(state, step, source);
      return;
    case 'remove-ros-finding': {
      const dtos = state.rosObservations
        .filter((o) => !o.removed)
        .map((o) => ({
          field: o.field,
          label: o.label,
          value: true,
          resourceId: o.field,
        })) as unknown as ExamObservationDTO[];
      const scored = findRosRemoveMatchesScored(String(step.display ?? ''), step.searchTerms ?? [], dtos);
      const top = scored[0]?.leaf;
      const target = top && state.rosObservations.find((o) => !o.removed && o.field === top.field);
      if (target) {
        target.removed = true;
        target.removedBy = source;
      } else state.skipped.push({ kind: step.kind, display: step.display, reason: 'no charted ROS finding matched' });
      return;
    }
    case 'edit-note-text': {
      const field = step.field as keyof SimFinalState['noteText'];
      const newText = String(step.newText ?? '');
      // Review rewrites of a non-empty field queue for provider confirmation (client's
      // pendingNoteEdits rule); planner edits and empty-field fills apply directly (overwrite).
      if (source === 'review' && state.noteText[field]?.text?.trim()) {
        state.pendingNoteEdits.push({ field: String(field), newText, source });
      } else {
        state.noteText[field] = { text: newText, source };
      }
      return;
    }
    case 'add-patient-instruction':
      state.instructions.push(String(step.text ?? ''));
      return;
    case 'set-disposition':
      state.disposition = { type: step.dispositionType, text: step.text };
      return;
    case 'add-nursing-order':
      state.nursingOrders.push(String(step.text ?? ''));
      return;
    case 'add-radiology':
      state.radiology.push(String(step.display ?? ''));
      return;
    case 'add-in-house-lab':
      state.labsOrdered.push({ kind: 'in-house', display: String(step.display ?? '') });
      return;
    case 'add-external-lab':
      state.labsOrdered.push({ kind: 'external', display: String(step.display ?? '') });
      return;
    case 'add-procedure':
      state.procedures.push(String(step.display ?? ''));
      return;
    case 'set-vital':
      state.vitals.push({ field: String(step.field ?? ''), display: String(step.display ?? '') });
      return;
    case 'provider-note':
      state.providerNotes.push(String(step.text ?? ''));
      return;
    default:
      state.otherSteps.push({ kind: String(step.kind) });
  }
}

// ---------------------------------------------------------------------------
// Review dx-swap primary fix — mirrors useChartAssistant's per-suggestion sequence using the
// SAME pure client helpers (carryReviewSwapPrimary / pickPrimaryPromotion from intent-logic):
//   (a) carry the to-be-removed dx's isPrimary onto an unmarked add BEFORE any action executes;
//   (b) apply the actions (add-diagnosis with missing isPrimary charts secondary, as before);
//   (c) if the chart ends with diagnoses but no primary, promote the dx the swap just added
//       (else the first charted one) — a review-provenance mutation.
// ---------------------------------------------------------------------------

// Minimal chart-data DTO view of the ACTIVE simulated diagnoses, shaped for the client helpers
// (GetChartDataResponse.diagnosis / DiagnosisDTO). resourceId encodes the state.diagnoses index
// so a promotion can be mapped back onto the sim record (indices are stable — removals are
// soft-delete flags, never splices).
function dxDtoView(state: SimFinalState): DiagnosisDTO[] {
  return state.diagnoses
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => !d.removed)
    .map(({ d, i }) => ({
      resourceId: `sim-dx-${i}`,
      code: d.code ?? '',
      display: d.display,
      isPrimary: !!d.isPrimary,
    })) as DiagnosisDTO[];
}

// Mirrors the client's handleSend hook: before a PLAN executes, carrySwapPrimary runs over the
// full planner step list against the current chart with { reclaimPrimary: true } — when the plan
// removes the charted primary and no add claims primary, the first add reclaims it even over an
// explicit isPrimary:false (the planner server's never-usurp normalization stamps false on
// incremental-plan adds). Add-only plans and explicit-true adds pass through untouched. In the
// harvested eval the pre-plan chart is EMPTY (fresh-visit sim), so the remove resolves to
// nothing and the helper is an identity for most plans — kept for exact client parity.
// Exported for the --self-test fixtures.
export function applyPlanSteps(state: SimFinalState, rawSteps: Step[]): void {
  const before = { diagnosis: dxDtoView(state) } as GetChartDataResponse;
  const steps = carrySwapPrimary(rawSteps as unknown as EasyChartAgentIntent[], before, {
    reclaimPrimary: true,
  }) as unknown as Step[];
  for (const step of steps) applyStep(state, step, 'planner');
}

// Exported for the --self-test fixtures. Returns whether the fix actually engaged: a primary
// flag was carried onto an add, and/or a promotion fired.
export function applyReviewSuggestion(
  state: SimFinalState,
  rawActions: Step[]
): { carriedPrimary: boolean; promoted: boolean } {
  // (a) BEFORE applying — the to-be-removed dx's primary flag must still be readable.
  const before = { diagnosis: dxDtoView(state) } as GetChartDataResponse;
  const actions = carrySwapPrimary(rawActions as unknown as EasyChartAgentIntent[], before) as unknown as Step[];
  // carrySwapPrimary preserves order/length, so index-wise comparison finds a stamped
  // isPrimary:true the raw action lacked (an explicit stamped `false` is behaviorally a no-op).
  const carriedPrimary = actions.some(
    (a, i) =>
      a.kind === 'add-diagnosis' && a.isPrimary === true && (rawActions[i] as Step | undefined)?.isPrimary !== true
  );
  // (b)
  for (const action of actions) applyStep(state, action, 'review');
  // (c) post-suggestion safety net, against the post-apply active diagnoses.
  const promote = pickPrimaryPromotion(actions as unknown as EasyChartAgentIntent[], dxDtoView(state));
  let promoted = false;
  if (promote?.resourceId) {
    const dx = state.diagnoses[Number(promote.resourceId.replace('sim-dx-', ''))];
    if (dx) {
      dx.isPrimary = true;
      // Review-provenance mutation: the scorer's plannerOnly scope must not see this promotion.
      dx.promotedPrimaryBy = 'review';
      promoted = true;
    }
  }
  return { carriedPrimary, promoted };
}

// ---------------------------------------------------------------------------
// chartState summary for the review call — mirrors the client's buildChartStateSummary,
// built from the simulated state (plus the template caveat line, since template contents
// aren't simulated).
// ---------------------------------------------------------------------------
export function buildChartStateText(state: SimFinalState): string {
  const lines: string[] = [];
  if (state.templatesApplied.length) {
    // The sim now applies the template's default DIAGNOSES (they appear in the Diagnoses line
    // below); its exam/MDM/instruction contents still are not simulated. When a title didn't
    // resolve against the catalog, keep the old "may add" caveat — nothing was applied for it.
    const unmatched = (state as SimStateWithTemplateStats).templateTitleUnmatched ?? [];
    const caveat =
      unmatched.length > 0
        ? '(not in the sim template catalog — may add its own default diagnosis/exam/MDM)'
        : '(its default diagnosis is included in the diagnoses below; template exam/MDM content is not simulated)';
    lines.push(`Template applied: ${state.templatesApplied.join('; ')} ${caveat}`);
  }
  const dx = state.diagnoses.filter((d) => !d.removed);
  if (dx.length) {
    lines.push(
      `Diagnoses: ${dx.map((d) => `${d.code ?? '?'} — ${d.display}${d.isPrimary ? ' (primary)' : ''}`).join('; ')}`
    );
  }
  const conditions = state.conditions.filter((c) => !c.removed);
  if (conditions.length) lines.push(`Past medical conditions: ${conditions.map((c) => c.display).join('; ')}`);
  const meds = state.medications.filter((m) => !m.removed);
  if (meds.length)
    lines.push(`Medications: ${meds.map((m) => `${m.display}${m.strength ? ` ${m.strength}` : ''}`).join('; ')}`);
  const allergies = state.allergies.filter((a) => !a.removed);
  if (allergies.length) lines.push(`Allergies: ${allergies.map((a) => a.display).join('; ')}`);
  const surg = state.surgicalHistory.filter((s) => !s.removed);
  if (surg.length) lines.push(`Surgical history: ${surg.map((s) => s.display).join('; ')}`);
  const hosp = state.hospitalizations.filter((h) => !h.removed);
  if (hosp.length) lines.push(`Hospitalizations: ${hosp.map((h) => h.display).join('; ')}`);
  if (state.procedures.length) lines.push(`Procedures on encounter: ${state.procedures.join('; ')}`);
  const exam = state.examObservations.filter((o) => !o.removed);
  if (exam.length) {
    const bySection: Record<string, string[]> = {};
    for (const o of exam) {
      const section = FIELD_TO_SECTION_LABEL[o.field] ?? 'Other';
      const checked = (o.components ?? []).filter((c) => !c.removed);
      const label = checked.length > 0 ? `${o.label} (${checked.map((c) => c.label).join(', ')})` : o.label;
      (bySection[section] ??= []).push(label);
    }
    lines.push(
      'Exam findings already checked:\n' +
        Object.entries(bySection)
          .map(([sec, items]) => `  ${sec}: ${items.join('; ')}`)
          .join('\n')
    );
  }
  const ros = state.rosObservations.filter((o) => !o.removed);
  if (ros.length) {
    lines.push(
      'ROS findings already charted: ' +
        ros.map((o) => `${o.finding === 'denies' ? 'Denies' : 'Reports'} ${o.label}`).join('; ')
    );
  }
  const mdm = state.noteText.medicalDecision?.text?.trim();
  if (mdm) lines.push(`MDM already present (length ${mdm.length} chars).`);
  const currentEm = state.emEvents.reduce<{ code?: string; display?: string } | undefined>(
    (cur, e) => (e.type === 'set' ? { code: e.code, display: e.display } : undefined),
    undefined
  );
  if (currentEm?.code) {
    lines.push(`E&M code already charted: ${currentEm.code}${currentEm.display ? ` — ${currentEm.display}` : ''}.`);
  }
  if (state.labsOrdered.length) {
    lines.push(`Labs already ordered: ${state.labsOrdered.map((o) => `${o.display} (${o.kind})`).join('; ')}`);
  }
  return lines.join('\n');
}

// noteContext for the review call: the note text the planner just wrote, keyed by the
// model-visible field names — same content the client's buildNoteContext supplies.
function buildNoteContextFromState(state: SimFinalState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, v] of Object.entries(state.noteText)) {
    if (v?.text?.trim()) out[field] = v.text;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Case runner
// ---------------------------------------------------------------------------
interface CaseFile {
  caseId: string;
  transcript: string;
  gold: GoldData;
}

// NEW-vs-ESTABLISHED patient status for the zambdas' E&M-family selector. This is legitimate
// chart context — at charting time the EHR knows from registration/visit history whether the
// patient is new (and the zambdas derive it server-side from the encounter when given one) —
// NOT gold leakage: it never reveals the E&M *level*, only the family the provider could see
// anyway. Headless runs have no encounterId, so infer the family from the gold E&M code
// (9920x = new, 9921x = established) and pass it explicitly; an explicit
// noteContext.patientStatus wins over server-side derivation.
function inferPatientStatus(gold: GoldData): 'new' | 'established' | undefined {
  const code = gold.billing?.emCode?.code ?? '';
  if (/^9920\d$/.test(code)) return 'new';
  if (/^9921\d$/.test(code)) return 'established';
  return undefined;
}
interface PlannerOutput {
  steps?: EasyChartPlannerStep[];
  usage?: EasyChartTokenUsage;
}
interface ReviewOutput {
  suggestions?: EasyChartSuggestion[];
  usage?: EasyChartTokenUsage;
  dispositionTrigger?: DispositionTriggerInfo;
}

// Shape of a source-run result file consumed by --review-only.
interface SourceResult {
  error?: string;
  planSteps?: EasyChartPlannerStep[];
  patientStatusSent?: 'new' | 'established' | null;
  chartStateSentToReview?: string;
}

async function runCase(
  caseFile: CaseFile,
  token: string,
  outDir: string,
  reviewOnly?: string // source results dir — skip the planner, replay its recorded planSteps
): Promise<{
  score?: CaseScore;
  planSteps: number;
  reviewSuggestions: number;
  primaryFixFired?: boolean;
  error?: string;
  skipped?: string;
}> {
  const { caseId, transcript, gold } = caseFile;
  let stage = reviewOnly ? 'load-source' : 'planner';
  let patientStatus = inferPatientStatus(gold);
  try {
    let planSteps: EasyChartPlannerStep[];
    let plannerUsage: EasyChartTokenUsage | undefined;
    let sourceChartState: string | undefined;
    if (reviewOnly) {
      const srcPath = join(reviewOnly, `${caseId}.result.json`);
      if (!existsSync(srcPath)) return { planSteps: 0, reviewSuggestions: 0, skipped: 'no source result file' };
      const src = JSON.parse(readFileSync(srcPath, 'utf8')) as SourceResult;
      if (src.error)
        return { planSteps: 0, reviewSuggestions: 0, skipped: `source run failed: ${src.error.slice(0, 80)}` };
      if (!Array.isArray(src.planSteps))
        return { planSteps: 0, reviewSuggestions: 0, skipped: 'source result has no planSteps' };
      planSteps = src.planSteps;
      sourceChartState = src.chartStateSentToReview;
      // A/B parity: reuse the source run's recorded patientStatus decision verbatim (absent on
      // pre-patientStatus source runs ⇒ this review sees none, exactly like the source's review).
      patientStatus = src.patientStatusSent ?? undefined;
    } else {
      const plan = await callZambda<PlannerOutput>(
        'easy-chart-planner',
        { narrative: transcript, noteContext: { ...(patientStatus ? { patientStatus } : {}) } },
        token
      );
      if (!Array.isArray(plan.steps)) throw new Error('planner returned no steps array');
      planSteps = plan.steps;
      plannerUsage = plan.usage;
    }

    const state = emptySimState();
    // Shared by full mode and --review-only replay: pre-plan carrySwapPrimary(reclaimPrimary)
    // then step application (see applyPlanSteps).
    applyPlanSteps(state, planSteps as Record<string, any>[] as Step[]);

    stage = 'review';
    const chartState = buildChartStateText(state);
    // Replay fidelity: the matchers are pure, so the rebuild is deterministic — a mismatch with
    // the source run's recorded chartState means matcher/catalog drift since that run.
    let replayChartStateMatches: boolean | undefined;
    if (reviewOnly && typeof sourceChartState === 'string') {
      replayChartStateMatches = chartState === sourceChartState;
      if (!replayChartStateMatches) {
        console.warn(`${caseId}: replayed chartState DIFFERS from the source run (matcher/catalog drift?)`);
      }
    }
    const noteContext = { ...buildNoteContextFromState(state), ...(patientStatus ? { patientStatus } : {}) };
    const review = await callZambda<ReviewOutput>(
      'easy-chart-review',
      { narrative: transcript, chartState, noteContext },
      token
    );
    const suggestions = review.suggestions ?? [];
    stage = 'apply-review';
    let primaryCarried = 0;
    let primaryPromoted = 0;
    for (const s of suggestions) {
      const fix = applyReviewSuggestion(state, (s.actions ?? []) as Record<string, any>[] as Step[]);
      if (fix.carriedPrimary) primaryCarried++;
      if (fix.promoted) primaryPromoted++;
    }

    const usage: CaseUsage = {
      ...(plannerUsage ? { planner: plannerUsage } : {}),
      ...(review.usage ? { review: review.usage } : {}),
    };
    writeFileSync(
      join(outDir, `${caseId}.result.json`),
      JSON.stringify(
        {
          caseId,
          patientStatusSent: patientStatus ?? null,
          ...(reviewOnly
            ? {
                reviewOnlyFrom: reviewOnly,
                ...(replayChartStateMatches !== undefined ? { replayChartStateMatches } : {}),
              }
            : {}),
          primaryFix: { carried: primaryCarried, promoted: primaryPromoted },
          // null = this run's review response carried no dispositionTrigger (older zambda);
          // distinguishes that from result files written before the field existed at all.
          dispositionTrigger: review.dispositionTrigger ?? null,
          planSteps,
          reviewSuggestions: suggestions,
          chartStateSentToReview: chartState,
          finalState: state,
          usage,
        },
        null,
        2
      )
    );
    stage = 'score';
    const score = scoreCase(caseId, gold, state, usage, review.dispositionTrigger ?? null);
    writeFileSync(join(outDir, `${caseId}.score.json`), JSON.stringify(score, null, 2));
    return {
      score,
      planSteps: planSteps.length,
      reviewSuggestions: suggestions.length,
      primaryFixFired: primaryCarried + primaryPromoted > 0,
    };
  } catch (e) {
    const message = `${stage}: ${e instanceof Error ? e.message : String(e)}`;
    writeFileSync(
      join(outDir, `${caseId}.result.json`),
      JSON.stringify({ caseId, patientStatusSent: patientStatus ?? null, error: message }, null, 2)
    );
    // A failed rerun must not leave a stale score file from an earlier successful run behind —
    // the aggregate summary is rebuilt from ALL score files present in outDir.
    const staleScore = join(outDir, `${caseId}.score.json`);
    if (existsSync(staleScore)) unlinkSync(staleScore);
    return { planSteps: 0, reviewSuggestions: 0, error: message };
  }
}

// Rebuild the aggregate summary from every score file present in outDir — not just the cases
// of one invocation — so partial reruns (--cases) keep summary.json consistent with the full
// result set on disk. (runCase deletes a stale score file when a rerun of that case fails.)
function rebuildSummary(outDir: string): void {
  const scoreFiles = readdirSync(outDir)
    .filter((f) => /^case\d+\.score\.json$/.test(f))
    .sort();
  const scores = scoreFiles.map((f) => JSON.parse(readFileSync(join(outDir, f), 'utf8')) as CaseScore);
  const summary = aggregateScores(scores);
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`summary.json rebuilt from ${scores.length} score files in ${outDir}`);
  console.log(formatSummary(summary));
  printTemplateStats(outDir);
}

// Template-application counters live inside each result file's finalState (recorded by
// applyStep). summary.json's schema is owned by score-harvested (untouched), so these are
// surfaced on the console — a nonzero unmatched count means templates silently applied nothing.
function printTemplateStats(dir: string): void {
  const resultFiles = readdirSync(dir).filter((f) => /^case\d+\.result\.json$/.test(f));
  let templateDxApplied = 0;
  const unmatched: string[] = [];
  for (const f of resultFiles) {
    const rec = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { finalState?: SimStateWithTemplateStats };
    templateDxApplied += rec.finalState?.templateDxApplied ?? 0;
    unmatched.push(...(rec.finalState?.templateTitleUnmatched ?? []));
  }
  console.log(
    `template dx applied: ${templateDxApplied}; unmatched template titles: ${unmatched.length}` +
      (unmatched.length ? ` (${[...new Set(unmatched)].join('; ')})` : '')
  );
}

// ---------------------------------------------------------------------------
// --redispatch: offline re-dispatch of stored result files through the CURRENT sim. Rebuilds
// finalState (and chartStateSentToReview) from the recorded planSteps + reviewSuggestions via
// the SAME functions the live path uses (applyPlanSteps / applyReviewSuggestion) — the recorded
// suggestion content is replayed exactly, never regenerated. Idempotent and fully offline.
// ---------------------------------------------------------------------------
interface StoredResult extends Record<string, unknown> {
  error?: string;
  planSteps?: EasyChartPlannerStep[];
  reviewSuggestions?: EasyChartSuggestion[];
  chartStateSentToReview?: string;
  finalState?: SimFinalState;
}

function redispatchResults(dir: string): void {
  const files = readdirSync(dir)
    .filter((f) => /^case\d+\.result\.json$/.test(f))
    .sort();
  if (files.length === 0) throw new Error(`--redispatch: no caseNNN.result.json files in ${dir}`);
  let redone = 0;
  let skipped = 0;
  let changed = 0;
  let dxDelta = 0;
  let templateDxTotal = 0;
  const unmatchedTitles = new Set<string>();
  const activeDxCount = (st: SimFinalState | undefined): number =>
    (st?.diagnoses ?? []).filter((d) => !d.removed).length;
  for (const f of files) {
    const path = join(dir, f);
    const caseId = f.replace('.result.json', '');
    const rec = JSON.parse(readFileSync(path, 'utf8')) as StoredResult;
    if (rec.error || !Array.isArray(rec.planSteps)) {
      console.log(`${caseId}: SKIPPED (${rec.error ? `recorded error: ${rec.error.slice(0, 60)}` : 'no planSteps'})`);
      skipped++;
      continue;
    }
    const state = emptySimState();
    applyPlanSteps(state, rec.planSteps as Record<string, any>[] as Step[]);
    const chartState = buildChartStateText(state);
    for (const s of rec.reviewSuggestions ?? []) {
      applyReviewSuggestion(state, (s.actions ?? []) as Record<string, any>[] as Step[]);
    }
    const dxBefore = activeDxCount(rec.finalState);
    const dxAfter = activeDxCount(state);
    // Only finalState + chartStateSentToReview are rebuilt; every other recorded field passes
    // through the JSON round-trip byte-identically (the files were written by this same
    // stringify, so re-serialization is the identity on untouched keys).
    rec.finalState = state;
    if (typeof rec.chartStateSentToReview === 'string') rec.chartStateSentToReview = chartState;
    writeFileSync(path, JSON.stringify(rec, null, 2));
    const stats = state as SimStateWithTemplateStats;
    templateDxTotal += stats.templateDxApplied ?? 0;
    (stats.templateTitleUnmatched ?? []).forEach((t) => unmatchedTitles.add(t));
    if (dxAfter !== dxBefore) {
      changed++;
      dxDelta += dxAfter - dxBefore;
    }
    redone++;
    const templateNote = stats.templateDxApplied ? ` (+${stats.templateDxApplied} template dx)` : '';
    const templates = state.templatesApplied.length ? `; templates: ${state.templatesApplied.join('; ')}` : '';
    console.log(`${caseId}: dx ${dxBefore} → ${dxAfter}${templateNote}${templates}`);
  }
  console.log(
    `\nre-dispatched ${redone} result files in ${dir} (${skipped} skipped); ` +
      `dx count changed in ${changed} cases (net ${dxDelta >= 0 ? '+' : ''}${dxDelta}); ` +
      `template dx applied: ${templateDxTotal}; unmatched template titles: ${unmatchedTitles.size}` +
      (unmatchedTitles.size ? ` (${[...unmatchedTitles].join('; ')})` : '')
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));
  const casesDir = positional[0] ?? 'scripts/easy-chart-eval/harvested-cases';
  const outDir = positional[1] ?? 'scripts/easy-chart-eval/harvested-results';

  const redispatchFlag = flags.find((f) => f.startsWith('--redispatch='));
  if (redispatchFlag) {
    const dir = redispatchFlag.slice('--redispatch='.length);
    if (!existsSync(dir)) throw new Error(`--redispatch dir not found: ${dir}`);
    redispatchResults(dir);
    return;
  }
  mkdirSync(outDir, { recursive: true });

  if (flags.includes('--rescore-summary')) {
    rebuildSummary(outDir);
    return;
  }

  const casesFlag = flags.find((f) => f.startsWith('--cases='));
  const only = casesFlag
    ? new Set(
        casesFlag
          .slice('--cases='.length)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : undefined;
  let files = readdirSync(casesDir)
    .filter((f) => /^case\d+\.json$/.test(f))
    .sort();
  if (only) {
    files = files.filter((f) => only.has(f.replace('.json', '')));
    const found = new Set(files.map((f) => f.replace('.json', '')));
    const missing = [...only].filter((id) => !found.has(id));
    if (missing.length > 0) console.warn(`warning: --cases ids not found in ${casesDir}: ${missing.join(', ')}`);
    if (files.length === 0) throw new Error(`--cases matched no case files in ${casesDir}`);
  }
  console.log(`${files.length} harvested cases from ${casesDir}${only ? ' (--cases filter active)' : ''}`);

  const reviewOnlyFlag = flags.find((f) => f.startsWith('--review-only='));
  const reviewOnly = reviewOnlyFlag ? reviewOnlyFlag.slice('--review-only='.length) : undefined;
  if (reviewOnly) {
    if (!existsSync(reviewOnly)) throw new Error(`--review-only source dir not found: ${reviewOnly}`);
    // Writing the A/B into its own source would clobber the baseline it reads from.
    if (resolve(reviewOnly) === resolve(outDir)) {
      throw new Error('--review-only target outDir must differ from the source dir (pass a fresh outDir positional)');
    }
    if (positional[1] === undefined) {
      console.warn(`warning: no outDir given — review-only results will land in the default ${outDir}`);
    }
    // Pre-flight (before auth): show how many selected cases have usable recorded plan steps.
    const usable = files.filter((f) => {
      const p = join(reviewOnly, f.replace('.json', '.result.json'));
      if (!existsSync(p)) return false;
      const src = JSON.parse(readFileSync(p, 'utf8')) as SourceResult;
      return !src.error && Array.isArray(src.planSteps);
    });
    console.log(
      `review-only mode: ${usable.length}/${files.length} selected cases have usable plan steps in ${reviewOnly}` +
        ` (planner skipped; review + apply + score into ${outDir})`
    );
  }
  const token = await getToken();

  const CONCURRENCY = 3;
  const results: { caseId: string; ok: boolean; skipped?: boolean; line: string; score?: CaseScore }[] = new Array(
    files.length
  );
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < files.length) {
      const i = idx++;
      const file = files[i];
      const caseFile = JSON.parse(readFileSync(join(casesDir, file), 'utf8')) as CaseFile;
      const caseId = caseFile.caseId ?? file.replace('.json', '');
      const r = await runCase({ ...caseFile, caseId }, token, outDir, reviewOnly);
      results[i] = r.skipped
        ? { caseId, ok: true, skipped: true, line: `${caseId}: SKIPPED (${r.skipped})` }
        : r.score
        ? {
            caseId,
            ok: true,
            line: formatCaseLine(r.score, r.planSteps, r.reviewSuggestions, r.primaryFixFired),
            score: r.score,
          }
        : { caseId, ok: false, line: `${caseId}: FAILED (${r.error})` };
      console.log(results[i].line);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const succeeded = results.filter((r) => r?.score).length;
  const skipped = results.filter((r) => r?.skipped).length;
  const failed = results.filter((r) => r && !r.ok).length;
  console.log('');
  rebuildSummary(outDir);
  console.log(
    `\ndone this run: ${succeeded} succeeded, ${failed} failed${
      skipped > 0 ? `, ${skipped} skipped (no usable source result)` : ''
    }`
  );
}

// ---------------------------------------------------------------------------
// Sim self-test (invented data only) — the review dx-swap primary carry/promotion sequence,
// run through the REAL client helpers:  npx tsx scripts/easy-chart-eval/run-harvested-eval.ts --self-test
// ---------------------------------------------------------------------------
function runSimSelfTest(): void {
  let failures = 0;
  const check = (label: string, actual: unknown, expected: unknown): void => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  };
  const activeDx = (state: SimFinalState): SimFinalState['diagnoses'] => state.diagnoses.filter((d) => !d.removed);

  // S1 — swapping the PRIMARY dx carries primary onto the unmarked add.
  {
    const state = emptySimState();
    state.diagnoses = [{ display: 'Bilateral AOM', code: 'H66.003', isPrimary: true, source: 'planner' }];
    const fix = applyReviewSuggestion(state, [
      { kind: 'remove-diagnosis', display: 'Bilateral AOM', searchTerms: ['h66.003'] },
      { kind: 'add-diagnosis', display: 'Recurrent bilateral AOM', code: 'H66.006' }, // isPrimary omitted
    ] as Step[]);
    const active = activeDx(state);
    check('S1 carried', fix.carriedPrimary, true);
    check('S1 no promotion needed', fix.promoted, false);
    check('S1 one active dx', active.length, 1);
    check('S1 replacement is primary', [active[0].code, !!active[0].isPrimary], ['H66.006', true]);
  }

  // S2 — swapping a SECONDARY dx does NOT move primary; the existing primary survives.
  {
    const state = emptySimState();
    state.diagnoses = [
      { display: 'Pharyngitis', code: 'J02.9', isPrimary: true, source: 'planner' },
      { display: 'GERD', code: 'K21.9', source: 'planner' },
    ];
    const fix = applyReviewSuggestion(state, [
      { kind: 'remove-diagnosis', display: 'GERD', searchTerms: ['k21.9'] },
      { kind: 'add-diagnosis', display: 'Reflux esophagitis', code: 'K21.0' },
    ] as Step[]);
    const active = activeDx(state);
    check('S2 nothing carried', fix.carriedPrimary, false);
    check('S2 nothing promoted', fix.promoted, false);
    check('S2 original primary intact', active.find((d) => d.code === 'J02.9')?.isPrimary, true);
    check('S2 replacement is secondary', !!active.find((d) => d.code === 'K21.0')?.isPrimary, false);
  }

  // S3 — no resolvable remove match (carry passes through) + no-primary end state: promotion
  // picks the swap-added dx.
  {
    const state = emptySimState();
    state.diagnoses = [{ display: 'Cough', code: 'R05.9', source: 'planner' }]; // no primary charted
    const fix = applyReviewSuggestion(state, [
      { kind: 'remove-diagnosis', display: 'Completely Unmatchable Dx', searchTerms: [] },
      { kind: 'add-diagnosis', display: 'Acute URI', code: 'J06.9' },
    ] as Step[]);
    const active = activeDx(state);
    check('S3 nothing carried (no remove match)', fix.carriedPrimary, false);
    check('S3 promotion fired', fix.promoted, true);
    check('S3 swap-added dx promoted', active.find((d) => d.code === 'J06.9')?.isPrimary, true);
    check('S3 promotion attributed to review', active.find((d) => d.code === 'J06.9')?.promotedPrimaryBy, 'review');
    check('S3 other dx untouched', !!active.find((d) => d.code === 'R05.9')?.isPrimary, false);
  }

  // S4 — promotion fallback onto a PLANNER-sourced dx stays out of the plannerOnly scope.
  {
    const state = emptySimState();
    state.diagnoses = [{ display: 'Cough', code: 'R05.9', source: 'planner' }];
    const fix = applyReviewSuggestion(state, [
      { kind: 'remove-diagnosis', display: 'Completely Unmatchable Dx', searchTerms: [] }, // no add in this suggestion
    ] as Step[]);
    check('S4 promotion fired (fallback dx[0])', fix.promoted, true);
    check('S4 planner dx promoted with review provenance', state.diagnoses[0].promotedPrimaryBy, 'review');
    const gold: GoldData = {
      reviewOfSystems: { observations: [] },
      exam: [],
      assessment: {
        diagnoses: [
          {
            system: 'ICD-10-CM',
            code: 'R05.9',
            codeNormalized: 'R059',
            display: 'Cough',
            primary: true,
            fromLabOrder: false,
          },
        ],
      },
      billing: { cptCodes: [] },
      medications: { prescribed: [], inHouseAdministered: [], immunizations: [], currentReconciled: [] },
      allergies: [],
      medicalHistory: [],
      surgicalHistory: [],
      hospitalizations: [],
      procedures: [],
      labs: { external: undefined, inHouse: undefined },
      radiology: [],
      vitals: [],
      instructions: [],
    };
    const score = scoreCase('simS4', gold, state);
    check('S4 final scope sees the promoted primary', score.scopes.final.primaryDx.match, true);
    check('S4 plannerOnly scope does NOT', score.scopes.plannerOnly.primaryDx.match, null);
  }

  // S5 — --review-only replay fidelity: re-applying JSON-round-tripped planSteps through the
  // current applyStep reproduces the identical pre-review state AND chartState summary (the
  // matchers are pure, so the rebuild is deterministic).
  {
    const steps: Step[] = [
      { kind: 'add-diagnosis', display: 'Acute URI', code: 'J06.9', isPrimary: true },
      { kind: 'add-ros-finding', display: 'Denies fever', searchTerms: ['fever'] },
      { kind: 'add-exam-finding', display: 'lungs clear to auscultation', searchTerms: ['clear lungs'] },
      { kind: 'edit-note-text', field: 'historyOfPresentIllness', newText: 'Three days of runny nose and cough.' },
      { kind: 'set-em-code', code: '99213', display: 'Established E/M 3' },
      { kind: 'add-medication', display: 'Amoxicillin', strength: '400 mg/5 mL' },
    ] as Step[];
    const original = emptySimState();
    for (const s of steps) applyStep(original, s, 'planner');
    // Round-trip through JSON exactly like a source result file stores planSteps, then replay.
    const replayed = emptySimState();
    for (const s of JSON.parse(JSON.stringify(steps)) as Step[]) applyStep(replayed, s, 'planner');
    check('S5 replay reproduces the pre-review state', JSON.stringify(replayed) === JSON.stringify(original), true);
    check(
      'S5 replay reproduces the chartState summary',
      buildChartStateText(replayed) === buildChartStateText(original),
      true
    );
    check('S5 fixture is non-trivial (charted content present)', buildChartStateText(original).length > 0, true);
  }

  // S6 — plan-path reclaim: a plan that removes the charted primary with its add explicitly
  // marked isPrimary:false (the planner server's never-usurp demotion) reclaims primary onto
  // that add when applied against a pre-populated chart.
  {
    const state = emptySimState();
    state.diagnoses = [{ display: 'Acute otitis media', code: 'H66.90', isPrimary: true, source: 'planner' }];
    applyPlanSteps(state, [
      { kind: 'remove-diagnosis', display: 'Acute otitis media', searchTerms: ['h66.90'] },
      { kind: 'add-diagnosis', display: 'Otitis media with effusion', code: 'H65.91', isPrimary: false }, // explicit false
    ] as Step[]);
    const active = activeDx(state);
    check('S6 one active dx after swap', active.length, 1);
    check('S6 reclaim promoted the explicit-false add', [active[0].code, !!active[0].isPrimary], ['H65.91', true]);
  }

  // S7 — add-only plan is untouched by the reclaim path: no remove ⇒ helper passthrough, the
  // explicit-false add charts secondary, existing primary survives.
  {
    const state = emptySimState();
    state.diagnoses = [{ display: 'Pharyngitis', code: 'J02.9', isPrimary: true, source: 'planner' }];
    applyPlanSteps(state, [{ kind: 'add-diagnosis', display: 'Cough', code: 'R05.9', isPrimary: false }] as Step[]);
    const active = activeDx(state);
    check('S7 both dx active', active.length, 2);
    check('S7 existing primary intact', active.find((d) => d.code === 'J02.9')?.isPrimary, true);
    check('S7 add-only add stays secondary', !!active.find((d) => d.code === 'R05.9')?.isPrimary, false);
  }

  // S8 — hallucinated removal on an EMPTY chart (the live O86.20 case): the plan's remove-* step
  // records a skip (never an error), the add still applies, and scoreCase surfaces the miss via
  // the removeTargetMissing counter.
  {
    const state = emptySimState();
    applyPlanSteps(state, [
      { kind: 'remove-diagnosis', display: 'O86.20 — Urinary tract infection following delivery', searchTerms: [] },
      { kind: 'add-diagnosis', display: 'Acute URI', code: 'J06.9', isPrimary: true },
    ] as Step[]);
    check(
      'S8 hallucinated remove recorded as skip',
      state.skipped.filter((s) => s.kind === 'remove-diagnosis').length,
      1
    );
    check('S8 add still applied', activeDx(state).length, 1);
    const gold: GoldData = {
      reviewOfSystems: { observations: [] },
      exam: [],
      assessment: { diagnoses: [] },
      billing: { cptCodes: [] },
      medications: { prescribed: [], inHouseAdministered: [], immunizations: [], currentReconciled: [] },
      allergies: [],
      medicalHistory: [],
      surgicalHistory: [],
      hospitalizations: [],
      procedures: [],
      labs: { external: undefined, inHouse: undefined },
      radiology: [],
      vitals: [],
      instructions: [],
    };
    check('S8 removeTargetMissing counter', scoreCase('simS8', gold, state).counters.removeTargetMissing, 1);
  }

  // S9 — apply-template applies the template's contained dx from the seed catalog, mirroring
  // the apply-template zambda's append semantics: rank-1 dx charts primary on an empty chart,
  // an existing primary is never usurped, a duplicate ICD code is skipped, and an unresolvable
  // title applies nothing but is counted.
  {
    const state = emptySimState();
    applyPlanSteps(state, [{ kind: 'apply-template', display: 'Dysuria' }] as Step[]);
    const active = activeDx(state);
    check(
      'S9 template dx applied as primary',
      active.map((d) => [d.code, !!d.isPrimary]),
      [['R30.0', true]]
    );
    check(
      'S9 template provenance marker',
      (active[0] as SimDiagnosis & { templateName?: string }).templateName,
      'Dysuria'
    );
    check('S9 templateDxApplied counter', (state as SimStateWithTemplateStats).templateDxApplied, 1);
    check(
      'S9 chartState caveat reflects applied dx',
      buildChartStateText(state).includes('its default diagnosis is included in the diagnoses below'),
      true
    );

    const state2 = emptySimState();
    applyPlanSteps(state2, [
      { kind: 'add-diagnosis', display: 'Dysuria', code: 'R30.0', isPrimary: true },
      { kind: 'apply-template', display: 'Dysuria' },
    ] as Step[]);
    check('S9 duplicate template dx skipped', activeDx(state2).length, 1);
    check('S9 duplicate recorded as skip', state2.skipped.filter((s) => s.kind === 'apply-template').length, 1);

    const state3 = emptySimState();
    applyPlanSteps(state3, [
      { kind: 'add-diagnosis', display: 'Acute URI', code: 'J06.9', isPrimary: true },
      { kind: 'apply-template', display: 'Dysuria' },
    ] as Step[]);
    const active3 = activeDx(state3);
    check('S9 existing primary never usurped', active3.find((d) => d.code === 'J06.9')?.isPrimary, true);
    check('S9 template dx charts secondary', !!active3.find((d) => d.code === 'R30.0')?.isPrimary, false);

    const state4 = emptySimState();
    applyPlanSteps(state4, [{ kind: 'apply-template', display: 'Zzznonexistent Xyzzy' }] as Step[]);
    check('S9 unmatched title applies nothing', activeDx(state4).length, 0);
    check('S9 unmatched title counted', (state4 as SimStateWithTemplateStats).templateTitleUnmatched, [
      'Zzznonexistent Xyzzy',
    ]);
    check(
      'S9 unmatched caveat retained',
      buildChartStateText(state4).includes('may add its own default diagnosis/exam/MDM'),
      true
    );
  }

  console.log(failures === 0 ? '\nSIM SELF-TEST PASS' : `\nSIM SELF-TEST FAIL (${failures} failing checks)`);
  if (failures > 0) process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv[2] === '--self-test') {
    runSimSelfTest();
  } else {
    main().catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
  }
}
