import { EASY_CHART_NOTE_TEXT_FIELDS, EasyChartNoteContext } from 'utils/lib/types/data/easy-chart-agent.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../types/common';

// Shared request-body parsing for the easy-chart zambdas. Missing/malformed bodies are caller
// mistakes → structured APIErrors (a 4xxx the frontend can surface), never raw throws that page.
export function parseJsonBody(input: ZambdaInput): Record<string, unknown> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }
  return parsed as Record<string, unknown>;
}

// Whitelist-copy the noteContext snapshot (the 5 free-text note fields the client sends with every
// call). ONE copy shared by the agent, planner, and review zambdas — when a new note section is
// added it must be visible to all three, or the ones missing it silently strip the field and
// suggest/contradict content the note already contains.
export function validateNoteContext(noteContext: unknown): EasyChartNoteContext | undefined {
  if (!noteContext || typeof noteContext !== 'object') return undefined;
  const ctx: EasyChartNoteContext = {};
  for (const key of EASY_CHART_NOTE_TEXT_FIELDS) {
    const v = (noteContext as Record<string, unknown>)[key];
    if (typeof v === 'string') ctx[key] = v;
  }
  // patientStatus rides on noteContext but is NOT a note text field: it picks the E&M code family
  // (new → 99202-99205, established → 99212-99215). Whitelist the two valid values; anything else
  // is dropped and the zambda falls back to server-side derivation / the established default.
  const patientStatus = (noteContext as Record<string, unknown>).patientStatus;
  if (patientStatus === 'new' || patientStatus === 'established') ctx.patientStatus = patientStatus;
  return Object.keys(ctx).length > 0 ? ctx : undefined;
}
