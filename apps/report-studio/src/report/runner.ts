// Runs the open report: fetch the plan through the zambda, render the code in the sandbox, and gather
// what happened (timings, errors, the rendered text, field usage, mostly-blank fields) — for the
// Plan tab, the inspector and, as a tool result, for Claude.
import type { FhirResource } from 'fhir/r4b';
import {
  FetchPlanInput,
  FetchPlanSchema,
  FetchStepStats,
  RunFetchPlanOutput,
} from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { runFetchPlan } from '../instance/zambdaClient';
import { sandbox } from '../sandbox/controller';
import { RenderResult, useStudio } from '../state/store';
import { resolveDateRange } from './types';
import { suggestElements } from './trim';

export interface RunSummary {
  ok: boolean;
  dateRange: DateRange;
  fetch?: {
    totalMs: number;
    totalBytes: number;
    steps: (Omit<FetchStepStats, 'params'> & { params: string })[];
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

/** Fetch only (used by the exploratory run_fetch tool); does not touch the open report's run state. */
export async function fetchOnly(
  plan: FetchPlanInput,
  dateRange: DateRange
): Promise<RunFetchPlanOutput & { resources: Record<string, FhirResource[]> }> {
  const { addEvent } = useStudio.getState();
  const started = Date.now();
  addEvent('fetch', `Exploratory fetch: ${plan.steps.length} step(s)…`);
  try {
    const output = await runFetchPlan(plan, dateRange);
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
  const { report, settings, addEvent, setRun } = state;
  const dateRange = opts.dateRange ?? resolveDateRange(report.dateRange);
  const warnings: string[] = [];
  const startedAt = Date.now();

  const validated = validatePlan(report.plan);
  if (!validated.ok) {
    const message = `The plan is invalid: ${validated.errors.join('; ')}`;
    setRun({ status: 'error', error: message, startedAt, dateRange });
    addEvent('error', message);
    return { ok: false, dateRange, fetchError: message, warnings };
  }

  let resources = state.run.resources;
  let fetchOutput = state.run.fetch;
  const canReuse =
    opts.reuseData &&
    resources &&
    fetchOutput &&
    state.run.dateRange?.start === dateRange.start &&
    state.run.dateRange?.end === dateRange.end;

  if (!canReuse) {
    setRun({ status: 'fetching', startedAt, dateRange, error: undefined, render: undefined });
    addEvent(
      'fetch',
      `Fetching ${report.plan.steps.length} step(s) for ${dateRange.start.slice(0, 10)} → ${dateRange.end.slice(
        0,
        10
      )}…`
    );
    try {
      const output = await runFetchPlan(report.plan, dateRange);
      const { resources: fetched, ...rest } = output;
      resources = fetched;
      fetchOutput = rest;
      setRun({ fetch: rest, resources: fetched });
      addEvent('fetch', `Fetched in ${rest.totalMs} ms, ${fmtBytes(rest.totalBytes)}`, stepLines(rest.stats));
      for (const s of rest.stats) {
        if (s.error) {
          warnings.push(`step "${s.id}" failed: ${s.error}`);
          addEvent('error', `Step ${s.id} failed: ${s.error}`);
        } else if (s.count === 0) {
          warnings.push(`step "${s.id}" returned no resources`);
          addEvent('warn', `Step ${s.id} returned no resources`);
        }
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
  const render: RenderResult = await sandbox.render({
    code: report.code,
    resources: resources ?? {},
    params: { dateRange, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    profile: true,
    muiLicenseKey: settings.muiLicenseKey || undefined,
  });
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
          steps: fetchOutput.stats.map(({ params, ...s }) => ({
            ...s,
            params: params.map((p) => `${p.name}=${p.value}`).join('&'),
          })),
        }
      : undefined,
    render: { ok: render.ok, error: render.error, ms: render.ms, text: render.text },
    fieldUsage,
    suggestedElements: Object.keys(suggestedElements).length ? suggestedElements : undefined,
    warnings,
  };
}
