// The tools Claude works with: read / change the open report, run it against the instance, look at the
// fetched data (redacted by default), and read the instance's legacy saved reports as specs.
import type Anthropic from '@anthropic-ai/sdk';
import type { FhirResource } from 'fhir/r4b';
import type { FetchPlanInput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { listSavedReports } from '../instance/zambdaClient';
import { comparePlanRuns } from '../report/comparePlans';
import { fetchOnly, runReport, validatePlan } from '../report/runner';
import { DATE_RANGE_PRESETS, DateRangeSpec, describeDateRange, resolveDateRange } from '../report/types';
import { useStudio } from '../state/store';

type BetaTool = Anthropic.Beta.BetaTool;

const dateRangeSchema = {
  type: 'object',
  description: "ISO instants; omit to use the report's own date range.",
  properties: { start: { type: 'string' }, end: { type: 'string' } },
  required: ['start', 'end'],
} as const;

export const TOOLS: BetaTool[] = [
  {
    name: 'get_report_state',
    description:
      'The open report: name, title, description, prompt, date range, plan, code, and a summary of the last run.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'update_report',
    description:
      'Change the open report. Any subset of fields; each applies immediately and is validated (the plan against the ' +
      'data map). Returns ok or the validation errors. Does not run the report — call run_report afterwards.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short file-friendly name of the report.' },
        title: { type: 'string', description: 'The heading shown above the report.' },
        description: { type: 'string' },
        plan: { type: 'object', description: 'The full fetch plan (see FETCH PLAN FORMAT).' },
        code: { type: 'string', description: 'The full report code (function body ending with `return ReportRoot;`).' },
        patientId: {
          type: 'string',
          description: 'The patient id a {{patientId}} plan runs for (the Patient box in the top bar); "" clears it.',
        },
        dateRange: {
          type: 'object',
          properties: {
            preset: { type: 'string', enum: [...DATE_RANGE_PRESETS] },
            start: { type: 'string', description: 'yyyy-MM-dd, custom only' },
            end: { type: 'string', description: 'yyyy-MM-dd, custom only' },
          },
          required: ['preset'],
        },
      },
    },
    eager_input_streaming: true,
  } as BetaTool,
  {
    name: 'run_report',
    description:
      'Fetch the plan through the instance and render the code in the sandbox. Returns per-step timings, counts, bytes and ' +
      'errors, the rendered text, which fields the code read per resource type (fieldUsage), mostly-blank fields, ' +
      'suggestedElements for trimming, and warnings. Set reuseData=true after a code-only change to skip the fetch.',
    input_schema: {
      type: 'object',
      properties: { dateRange: dateRangeSchema, reuseData: { type: 'boolean' } },
    },
  },
  {
    name: 'run_fetch',
    description:
      'Exploratory fetch of ANY plan (not saved, does not change the report): returns per-step stats, a redacted sample ' +
      'resource per type, and distinct value counts for the paths in "summarize". Use it to learn real field shapes, ' +
      'statuses, codes and categories before writing code or filters.',
    input_schema: {
      type: 'object',
      properties: {
        plan: { type: 'object' },
        dateRange: dateRangeSchema,
        sample: { type: 'integer', description: 'sample resources per type (default 1, max 3)' },
        summarize: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              step: { type: 'string' },
              path: { type: 'string', description: 'dot path, arrays flattened' },
            },
            required: ['step', 'path'],
          },
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'compare_plans',
    description:
      'The speed pass: fetch two plan variants back to back over the same date range (neither is saved) and return per-step ' +
      'and total ms, bytes, requests, counts by type, which was faster, and whether the resources are equivalent — same ids ' +
      'per type, and for a trimmed variant the same values in the fields the code read in the last render. Keep the faster ' +
      'equivalent variant with update_report, then run_report to confirm the output is unchanged.',
    input_schema: {
      type: 'object',
      properties: {
        a: { type: 'object', description: 'Plan variant A (usually the current plan).' },
        b: { type: 'object', description: 'Plan variant B.' },
        dateRange: dateRangeSchema,
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'inspect_data',
    description:
      'Look at the LAST run\'s fetched resources: with "path", distinct values and counts at that dot path (e.g. ' +
      '"status", "code.coding.system", "serviceCategory.coding.display"); with "sample", redacted sample resources. ' +
      'Filter to a resourceType within the step when it holds several (included resources).',
    input_schema: {
      type: 'object',
      properties: {
        step: { type: 'string' },
        resourceType: { type: 'string' },
        path: { type: 'string' },
        sample: { type: 'integer', description: 'max 3' },
      },
      required: ['step'],
    },
  },
  {
    name: 'list_saved_reports',
    description:
      "The instance's legacy saved ad hoc reports (dataset-based): id, name, description and the original request. Specs to rebuild from.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_saved_report',
    description:
      'One legacy saved report in full: request, dataset, criteria and its old dataset-row code (a spec, not code to reuse).',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
];

const MAX_RESULT_CHARS = 60_000;
const MAX_TEXT_IN_RESULT = 4000;

const clip = (text: string): string =>
  text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n…[truncated]` : text;

export async function executeTool(name: string, rawInput: unknown): Promise<string> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  switch (name) {
    case 'get_report_state':
      return clip(JSON.stringify(reportState(), null, 1));
    case 'update_report':
      return JSON.stringify(updateReport(input));
    case 'run_report': {
      const summary = await runReport({
        dateRange: parseDateRange(input.dateRange),
        reuseData: input.reuseData === true,
      });
      if (summary.render?.text && summary.render.text.length > MAX_TEXT_IN_RESULT) {
        summary.render.text = `${summary.render.text.slice(0, MAX_TEXT_IN_RESULT)}\n…[truncated]`;
      }
      return clip(JSON.stringify(summary, null, 1));
    }
    case 'run_fetch':
      return clip(await runFetchTool(input));
    case 'compare_plans':
      return clip(await comparePlansTool(input));
    case 'inspect_data':
      return clip(inspectData(input));
    case 'list_saved_reports': {
      const { reports } = await listSavedReports();
      return clip(
        JSON.stringify(
          reports.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            datasetId: r.datasetId,
            request: r.request,
          })),
          null,
          1
        )
      );
    }
    case 'get_saved_report': {
      const { reports } = await listSavedReports();
      const report = reports.find((r) => r.id === input.id);
      return report ? clip(JSON.stringify(report, null, 1)) : `No saved report with id ${String(input.id)}`;
    }
    default:
      return `Unknown tool ${name}`;
  }
}

function parseDateRange(value: unknown): DateRange | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { start, end } = value as { start?: unknown; end?: unknown };
  return typeof start === 'string' && typeof end === 'string' ? { start, end } : undefined;
}

function reportState(): unknown {
  const { report, run } = useStudio.getState();
  return {
    name: report.name,
    title: report.title,
    description: report.description,
    prompt: report.prompt,
    dateRange: {
      ...report.dateRange,
      label: describeDateRange(report.dateRange),
      resolved: resolveDateRange(report.dateRange),
    },
    patientId: report.parameters?.patientId || undefined,
    plan: report.plan,
    code: report.code,
    lastRun:
      run.status === 'idle'
        ? 'never run'
        : {
            status: run.status,
            error: run.error,
            steps: run.fetch?.stats.map(({ id, resourceType, count, ms, mode, error }) => ({
              id,
              resourceType,
              count,
              ms,
              mode,
              error,
            })),
            renderOk: run.render?.ok,
            renderError: run.render?.error,
          },
  };
}

function updateReport(input: Record<string, unknown>): { ok: boolean; changed: string[]; errors?: string[] } {
  const { report, setReport, addEvent } = useStudio.getState();
  const patch: Partial<typeof report> = {};
  const changed: string[] = [];
  const errors: string[] = [];

  if (typeof input.name === 'string' && input.name.trim()) {
    patch.name = input.name.trim();
    changed.push('name');
  }
  if (typeof input.title === 'string') {
    patch.title = input.title;
    changed.push('title');
  }
  if (typeof input.description === 'string') {
    patch.description = input.description;
    changed.push('description');
  }
  if (input.plan !== undefined) {
    const validated = validatePlan(input.plan);
    if (validated.ok) {
      patch.plan = validated.plan as FetchPlanInput;
      changed.push('plan');
    } else errors.push(...validated.errors.map((e) => `plan ${e}`));
  }
  if (typeof input.code === 'string') {
    if (!/return\s+ReportRoot\s*;?\s*$/.test(input.code.trim())) errors.push('code must end with `return ReportRoot;`');
    else {
      patch.code = input.code;
      changed.push('code');
    }
  }
  if (typeof input.patientId === 'string') {
    patch.parameters = { ...report.parameters, patientId: input.patientId.trim() || undefined };
    changed.push('patientId');
  }
  if (input.dateRange && typeof input.dateRange === 'object') {
    const spec = input.dateRange as DateRangeSpec;
    if (!DATE_RANGE_PRESETS.includes(spec.preset))
      errors.push(`dateRange.preset must be one of ${DATE_RANGE_PRESETS.join(', ')}`);
    else {
      patch.dateRange = { preset: spec.preset, start: spec.start, end: spec.end };
      changed.push('dateRange');
    }
  }

  if (changed.length) {
    setReport(patch);
    addEvent('llm', `Claude changed: ${changed.join(', ')}`);
  }
  return errors.length ? { ok: false, changed, errors } : { ok: true, changed };
}

async function runFetchTool(input: Record<string, unknown>): Promise<string> {
  const validated = validatePlan(input.plan);
  if (!validated.ok) return JSON.stringify({ ok: false, errors: validated.errors });
  const { report, settings } = useStudio.getState();
  const dateRange = parseDateRange(input.dateRange) ?? resolveDateRange(report.dateRange);
  const output = await fetchOnly(validated.plan, dateRange);
  const sampleCount = Math.min(Math.max(Number(input.sample) || 1, 1), 3);
  const samples: Record<string, unknown[]> = {};
  for (const [step, list] of Object.entries(output.resources)) {
    const byType = new Map<string, FhirResource[]>();
    for (const r of list) byType.set(r.resourceType, [...(byType.get(r.resourceType) ?? []), r]);
    for (const [type, items] of byType) {
      samples[`${step}:${type}`] = items.slice(0, sampleCount).map((r) => redact(r, settings.allowUnredactedSamples));
    }
  }
  const summaries: Record<string, unknown> = {};
  for (const item of (input.summarize as { step: string; path: string }[] | undefined) ?? []) {
    summaries[`${item.step}.${item.path}`] = tally(output.resources[item.step] ?? [], item.path);
  }
  return JSON.stringify(
    {
      dateRange,
      totalMs: output.totalMs,
      totalBytes: output.totalBytes,
      steps: output.stats.map(({ params, ...s }) => ({
        ...s,
        params: params.map((p) => `${p.name}=${p.value}`).join('&'),
      })),
      samples,
      summaries,
    },
    null,
    1
  );
}

async function comparePlansTool(input: Record<string, unknown>): Promise<string> {
  const a = validatePlan(input.a);
  const b = validatePlan(input.b);
  if (!a.ok || !b.ok) {
    return JSON.stringify({
      ok: false,
      errors: [...(a.ok ? [] : a.errors.map((e) => `a ${e}`)), ...(b.ok ? [] : b.errors.map((e) => `b ${e}`))],
    });
  }
  const { report, run, addEvent } = useStudio.getState();
  const dateRange = parseDateRange(input.dateRange) ?? resolveDateRange(report.dateRange);
  // Back to back, never in parallel: the two must not compete for the server.
  const outputA = await fetchOnly(a.plan, dateRange);
  const outputB = await fetchOnly(b.plan, dateRange);
  const fieldsRead = run.render?.profile
    ? Object.fromEntries(Object.entries(run.render.profile.byType).map(([type, p]) => [type, p.fields]))
    : undefined;
  const comparison = comparePlanRuns(outputA, outputB, fieldsRead, { a: a.plan, b: b.plan });
  addEvent(
    'fetch',
    `Compared plans: A ${comparison.a.totalMs} ms, B ${comparison.b.totalMs} ms, ${
      comparison.equivalent ? 'equivalent' : 'DIFFERENT'
    }`,
    comparison.differences.join('\n') || undefined
  );
  return JSON.stringify({ dateRange, fieldsCompared: Boolean(fieldsRead), ...comparison }, null, 1);
}

function inspectData(input: Record<string, unknown>): string {
  const { run, settings } = useStudio.getState();
  const step = String(input.step ?? '');
  const list = run.resources?.[step];
  if (!list)
    return `No fetched data for step "${step}". Available: ${
      Object.keys(run.resources ?? {}).join(', ') || 'none (run the report first)'
    }`;
  const filtered =
    typeof input.resourceType === 'string' ? list.filter((r) => r.resourceType === input.resourceType) : list;
  const result: Record<string, unknown> = {
    step,
    total: filtered.length,
    byType: Object.entries(
      filtered.reduce<Record<string, number>>(
        (acc, r) => ((acc[r.resourceType] = (acc[r.resourceType] ?? 0) + 1), acc),
        {}
      )
    ),
  };
  if (typeof input.path === 'string') result.values = tally(filtered, input.path);
  if (input.sample) {
    result.sample = filtered
      .slice(0, Math.min(Number(input.sample) || 1, 3))
      .map((r) => redact(r, settings.allowUnredactedSamples));
  }
  return JSON.stringify(result, null, 1);
}

/** Distinct values at a dot path with counts (arrays flattened), plus how many resources had none. */
function tally(
  resources: FhirResource[],
  path: string
): { distinct: number; blank: number; top: { value: string; count: number }[] } {
  const segments = path.split('.').filter(Boolean);
  const counts = new Map<string, number>();
  let blank = 0;
  const collect = (node: unknown, depth: number, out: string[]): void => {
    if (node == null) return;
    if (Array.isArray(node)) return node.forEach((n) => collect(n, depth, out));
    if (depth === segments.length) {
      out.push(typeof node === 'object' ? JSON.stringify(node).slice(0, 80) : String(node).slice(0, 80));
      return;
    }
    if (typeof node === 'object') collect((node as Record<string, unknown>)[segments[depth]], depth + 1, out);
  };
  for (const resource of resources) {
    const values: string[] = [];
    collect(resource, 0, values);
    if (values.length === 0) blank += 1;
    for (const v of new Set(values)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const top = Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
  return { distinct: counts.size, blank, top };
}

const IDENTITY_TYPES = new Set(['Patient', 'RelatedPerson', 'Person']);
const IDENTITY_FIELDS = new Set([
  'name',
  'telecom',
  'address',
  'birthDate',
  'identifier',
  'photo',
  'contact',
  'maritalStatus',
]);
const FREE_TEXT_FIELDS = new Set(['contentString', 'div', 'note', 'data']);

/** Strip identifying / free-text fields from a sample resource before it goes to the model. */
export function redact(resource: FhirResource, allowUnredacted: boolean): unknown {
  if (allowUnredacted) return resource;
  const identity = IDENTITY_TYPES.has(resource.resourceType);
  const walk = (node: unknown, depth: number): unknown => {
    if (Array.isArray(node)) return node.map((n) => walk(n, depth));
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if ((identity && depth === 0 && IDENTITY_FIELDS.has(key)) || FREE_TEXT_FIELDS.has(key)) out[key] = '[redacted]';
        else out[key] = walk(value, depth + 1);
      }
      return out;
    }
    return node;
  };
  return walk(resource, 0);
}
