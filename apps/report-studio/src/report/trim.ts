// Field trimming (the redesign's "tune" step, first pass): from a profiled render, propose `_elements`
// for each fetch step so the server only sends the top-level fields the report code read. Only steps
// whose results are a single resource type are trimmed — `_elements` applies to every resource a
// search returns, so a step that also _includes Patients would lose their fields.
import type { FetchPlanInput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { RenderProfile } from '../../runtime/profiler';
import type { RunState } from '../state/store';

const ALWAYS = ['id', 'meta'];

export function suggestElements(plan: FetchPlanInput, run: RunState): Record<string, string[]> {
  const profile: RenderProfile | undefined = run.render?.profile;
  if (!profile) return {};
  const stats = Object.fromEntries((run.fetch?.stats ?? []).map((s) => [s.id, s]));
  const out: Record<string, string[]> = {};
  for (const step of plan.steps) {
    const stat = stats[step.id];
    const types = Object.keys(stat?.byType ?? {});
    if (!stat || stat.count === 0 || types.length !== 1 || types[0] !== step.resourceType) continue;
    const read = profile.byStep[step.id]?.[step.resourceType] ?? [];
    if (read.length === 0) continue;
    const elements = Array.from(new Set([...ALWAYS, ...read]))
      .filter((f) => f !== 'resourceType')
      .sort();
    const current = step.elements ? [...step.elements].sort() : undefined;
    if (current && current.join(',') === elements.join(',')) continue;
    out[step.id] = elements;
  }
  return out;
}

export function applyElements(plan: FetchPlanInput, suggestions: Record<string, string[]>): FetchPlanInput {
  return {
    ...plan,
    steps: plan.steps.map((step) => (suggestions[step.id] ? { ...step, elements: suggestions[step.id] } : step)),
  };
}
