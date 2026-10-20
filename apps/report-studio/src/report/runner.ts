// Runs the open report: fetch the plan through the zambda, render the code in the sandbox, and gather
// what happened (timings, errors, the rendered text, field usage, mostly-blank fields) — for the
// Plan tab, the inspector and, as a tool result, for Claude.
import type { FhirResource } from 'fhir/r4b';
import {
  FetchPlanInput,
  FetchPlanParameters,
  FetchPlanSchema,
  FetchStepStats,
  planNeedsPatient,
  RunFetchPlanOutput,
} from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { runFetchPlan } from '../instance/zambdaClient';
import { sandbox } from '../sandbox/controller';
import { RenderResult, useStudio } from '../state/store';
import { bareTagHints } from './codeCheck';
import { dependencyChainLength, elementsIgnoredFor } from './comparePlans';
import { chooseFetchMode, isDirectTimeout, measuredFetch, measurementsApply, stepDensity } from './fetchMode';
import { resolveInputs, runParameters } from './inputs';
import { dateFieldWarnings, heavySearchWarnings, idListWarnings, requestBudgetWarnings } from './planWarnings';
import { suggestElements } from './trim';

export interface RunSummary {
  ok: boolean;
  dateRange: DateRange;
  fetch?: {
    totalMs: number;
    totalBytes: number;
    dependencyChain: number;
    steps: (Omit<FetchStepStats, 'params'> & { params: string; elementsIgnoredFor?: string[] })[];
  };
  fetchError?: string;
  render?: { ok: boolean; error?: string; ms: number; text?: string };
  fieldUsage?: Record<string, { fetched: number; fieldsRead: string[]; mostlyBlank: Record<string, number> }>;
  suggestedElements?: Record<string, string[]>;
  warnings: string[];
}

const fmtBytes = (n: number): string =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export function validatePlan(plan: unknown): { ok: true; plan: FetchPlanInput } | { ok: false; errors: string[] } {
  const parsed = FetchPlanSchema.safeParse(plan);
  if (parsed.success) return { ok: true, plan: plan as FetchPlanInput };
  return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'plan'}: ${i.message}`) };
}

/**
 * The active test case's input values (over the defaults) as a run needs them: the date range, the plan's patient
 * parameter and params.inputs; or the message saying which input is missing.
 */
function runInputs(
  plan: FetchPlanInput
): { dateRange: DateRange; parameters: FetchPlanParameters; inputs: Record<string, unknown> } | string {
  const { report, testCase } = useStudio.getState();
  const { values, missing } = resolveInputs(report, testCase);
  if (missing.length)
    return `Input${missing.length > 1 ? 's' : ''} ${missing.join(', ')} required — set ${
      missing.length > 1 ? 'them' : 'it'
    } in the test case (Under the hood → Inputs).`;
  const { dateRange, patientId, inputs } = runParameters(report, values);
  if (planNeedsPatient(plan) && !patientId)
    return 'This plan uses {{patientId}} but the report declares no patientId input with a value — add one (Under the hood → Inputs, or update_report inputs).';
  return { dateRange, parameters: patientId ? { patientId } : {}, inputs };
}

/** Fetch only (used by the exploratory run_fetch / compare_plans tools); does not touch the open report's run state. */
export async function fetchOnly(
  plan: FetchPlanInput,
  dateRange: DateRange
): Promise<RunFetchPlanOutput & { resources: Record<string, FhirResource[]> }> {
  const { addEvent } = useStudio.getState();
  const started = Date.now();
  const resolved = runInputs(plan);
  if (typeof resolved === 'string') throw new Error(resolved);
  addEvent('fetch', `Exploratory fetch: ${plan.steps.length} step(s)…`);
  try {
    const output = await runFetchPlan(plan, dateRange, resolved.parameters);
    addEvent(
      'fetch',
      `Exploratory fetch done in ${output.totalMs} ms, ${fmtBytes(output.totalBytes)}`,
      stepLines(output.stats)
    );
    return output;
  } catch (error) {
    addEvent(
      'error',
      `Exploratory fetch failed after ${Date.now() - started} ms: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

const stepLines = (stats: FetchStepStats[]): string =>
  stats
    .map(
      (s) =>
        `${s.id} (${s.resourceType}): ${
          s.error
            ? `ERROR ${s.error}`
            : `${s.count} resources, ${s.ms} ms, ${fmtBytes(s.bytes)}, ${s.mode}, ${s.requests} request(s)`
        }` + (s.scopedValues !== undefined ? `, ${s.scopedValues} scoped value(s)` : '')
    )
    .join('\n');

/**
 * Run the open report. `reuseData` renders the current code on the last fetch's resources (for a code-only
 * change); otherwise the plan is fetched again.
 */
export async function runReport(opts: { dateRange?: DateRange; reuseData?: boolean } = {}): Promise<RunSummary> {
  const state = useStudio.getState();
  const { report, settings, addEvent, setRun, setReport } = state;
  const warnings: string[] = [];
  const startedAt = Date.now();

  const validated = validatePlan(report.plan);
  const resolved = validated.ok
    ? runInputs(report.plan)
    : { dateRange: runParameters(report, {}).dateRange, parameters: {}, inputs: {} };
  const dateRange =
    opts.dateRange ?? (typeof resolved === 'string' ? runParameters(report, {}).dateRange : resolved.dateRange);
  if (!validated.ok || typeof resolved === 'string') {
    const message = validated.ok ? (resolved as string) : `The plan is invalid: ${validated.errors.join('; ')}`;
    setRun({ status: 'error', error: message, startedAt, dateRange });
    addEvent('error', message);
    return { ok: false, dateRange, fetchError: message, warnings };
  }
  const { parameters, inputs } = resolved;

  let resources = state.run.resources;
  let fetchOutput = state.run.fetch;
  const canReuse =
    opts.reuseData &&
    resources &&
    fetchOutput &&
    state.run.dateRange?.start === dateRange.start &&
    state.run.dateRange?.end === dateRange.end &&
    state.run.patientId === parameters.patientId;

  // Densities belong to the environment they were measured on: a report built on synth and tested on a practice ~12×
  // busier was slower with synth's (uc20 on practice B: 19.5 s vs 12.8 s without), so another environment gets none
  // (the runner counts each step first instead) and its measurements are not saved into the report.
  const ownMeasurements = measurementsApply(report, state.environment);
  const densities = ownMeasurements ? report.stepDensity : undefined;
  if (!canReuse) {
    for (const warning of [
      ...heavySearchWarnings(report.plan),
      ...dateFieldWarnings(report.plan),
      ...requestBudgetWarnings(report.plan, densities, dateRange),
    ]) {
      warnings.push(warning);
      addEvent('warn', warning);
    }
    setRun({
      status: 'fetching',
      startedAt,
      dateRange,
      patientId: parameters.patientId,
      error: undefined,
      render: undefined,
    });
    addEvent(
      'fetch',
      `Fetching ${report.plan.steps.length} step(s) for ${dateRange.start.slice(0, 10)} → ${dateRange.end.slice(
        0,
        10
      )}${parameters.patientId ? `, patient ${parameters.patientId}` : ''}…`
    );
    // Another environment may run the old executor on its own subscription, which would take the Task; a local
    // zambda server has no time ceiling, so direct is safe there.
    const mode = ownMeasurements ? chooseFetchMode(report, dateRange) : 'direct';
    let fellBack = false;
    try {
      let output: Awaited<ReturnType<typeof runFetchPlan>>;
      try {
        output = await runFetchPlan(report.plan, dateRange, parameters, mode, densities);
      } catch (error) {
        if (mode !== 'direct' || !ownMeasurements || !isDirectTimeout(error, Date.now() - startedAt)) throw error;
        fellBack = true;
        addEvent(
          'warn',
          `Direct fetch timed out after ${Date.now() - startedAt} ms; retrying through the background Task`
        );
        output = await runFetchPlan(report.plan, dateRange, parameters, 'task', densities);
      }
      const { resources: fetched, ...rest } = output;
      resources = fetched;
      fetchOutput = rest;
      setRun({ fetch: rest, resources: fetched });
      // The measurements are metadata, not an edit — unless the fallback pinned the Task path, which a save should keep.
      // A step's density is replaced by what this run measured; steps that measured nothing (failed, skipped) keep their last one.
      if (ownMeasurements && state.environment) {
        setReport(
          {
            ...measuredFetch(rest.totalMs, dateRange, fellBack),
            measuredOn: state.environment.name,
            stepDensity: { ...report.stepDensity, ...stepDensity(report.plan, rest.stats, dateRange) },
          },
          { dirty: fellBack || useStudio.getState().file.dirty }
        );
      }
      addEvent('fetch', `Fetched (${mode}) in ${rest.totalMs} ms, ${fmtBytes(rest.totalBytes)}`, stepLines(rest.stats));
      for (const s of rest.stats) {
        if (s.error) {
          warnings.push(`step "${s.id}" failed: ${s.error}`);
          addEvent('error', `Step ${s.id} failed: ${s.error}`);
        } else if (s.count === 0) {
          warnings.push(`step "${s.id}" returned no resources`);
          addEvent('warn', `Step ${s.id} returned no resources`);
        }
      }
      for (const warning of idListWarnings(rest.stats)) {
        warnings.push(warning);
        addEvent('warn', warning);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRun({ status: 'error', error: message });
      addEvent('error', `Fetch failed: ${message}`);
      return { ok: false, dateRange, fetchError: message, warnings };
    }
  } else {
    addEvent('info', 'Re-rendering on the last fetch (code-only change)');
  }

  setRun({ status: 'rendering' });
  useStudio.getState().setTab('report');
  const hints = bareTagHints(report.code);
  const render: RenderResult = await sandbox.render({
    code: report.code,
    resources: resources ?? {},
    params: {
      dateRange,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      patientId: parameters.patientId,
      inputs,
      totals: Object.fromEntries(
        (fetchOutput?.stats ?? []).flatMap((s) => (s.total === undefined ? [] : [[s.id, s.total]]))
      ),
    },
    profile: true,
    muiLicenseKey: settings.muiLicenseKey || undefined,
  });
  if (!render.ok && render.error?.includes('did not transpile') && hints.length) {
    render.error = `${render.error}. Hint — ${hints.join('; ')}`;
  }
  setRun({ status: render.ok ? 'done' : 'error', render, error: render.ok ? undefined : render.error });
  if (render.ok) addEvent('render', `Rendered in ${render.ms} ms`, render.text?.split('\n')[0]);
  else addEvent('error', `Render failed: ${render.error}`);

  const fieldUsage: RunSummary['fieldUsage'] = {};
  if (render.profile) {
    for (const [type, p] of Object.entries(render.profile.byType)) {
      fieldUsage[type] = { fetched: p.count, fieldsRead: p.fields, mostlyBlank: p.blank };
      for (const [field, fraction] of Object.entries(p.blank)) {
        const message = `${type}.${field} is blank on ${Math.round(fraction * 100)}% of ${p.count} resources`;
        warnings.push(message);
        addEvent('warn', message);
      }
    }
  }
  const suggestedElements = suggestElements(report.plan, useStudio.getState().run);

  return {
    ok: render.ok && !fetchOutput?.stats.some((s) => s.error),
    dateRange,
    fetch: fetchOutput
      ? {
          totalMs: fetchOutput.totalMs,
          totalBytes: fetchOutput.totalBytes,
          dependencyChain: dependencyChainLength(report.plan),
          steps: fetchOutput.stats.map(({ params, ...s }) => ({
            ...s,
            params: params.map((p) => `${p.name}=${p.value}`).join('&'),
            elementsIgnoredFor: elementsIgnoredFor(s),
          })),
        }
      : undefined,
    render: { ok: render.ok, error: render.error, ms: render.ms, text: render.text },
    fieldUsage,
    suggestedElements: Object.keys(suggestedElements).length ? suggestedElements : undefined,
    warnings,
  };
}
