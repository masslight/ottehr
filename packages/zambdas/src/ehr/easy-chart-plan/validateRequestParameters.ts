import { ChartPlanRequest, ConversationTurn } from 'utils/lib/easy-chart/api';
import { pickNoteContext } from 'utils/lib/easy-chart/note-fields';
import { ZambdaInput } from '../../shared/types/common';

/**
 * The rolling conversation window. Capped here, on the server, rather than trusting the client:
 * every turn re-sends the history, so cost grows superlinearly with an uncapped window.
 */
export const MAX_HISTORY_TURNS = 6;
export const MAX_HISTORY_CHARS = 6000;
/** A whole ambient transcript is a legitimate narrative. Anything past this is not a dictation. */
export const MAX_NARRATIVE_CHARS = 120_000;

export function validateRequestParameters(input: ZambdaInput): ChartPlanRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const body = JSON.parse(input.body) as Partial<ChartPlanRequest>;

  if (typeof body.narrative !== 'string' || !body.narrative.trim()) {
    throw new Error('"narrative" is required');
  }
  if (body.narrative.length > MAX_NARRATIVE_CHARS) {
    throw new Error(`"narrative" exceeds ${MAX_NARRATIVE_CHARS} characters`);
  }
  if (body.encounterId !== undefined && typeof body.encounterId !== 'string') {
    throw new Error('"encounterId" must be a string');
  }

  return {
    narrative: body.narrative,
    noteContext: pickNoteContext(body.noteContext),
    chartState: typeof body.chartState === 'string' ? body.chartState : undefined,
    chartedExamFindings: asStringArray(body.chartedExamFindings),
    templateTitles: asStringArray(body.templateTitles),
    encounterId: body.encounterId,
    incremental: body.incremental === true,
    // Only the two known values; anything else is dropped rather than passed to the prompt.
    patientStatus:
      body.patientStatus === 'new' || body.patientStatus === 'established' ? body.patientStatus : undefined,
    history: capHistory(body.history),
    secrets: input.secrets,
  };
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/**
 * Keep the most recent turns, then trim from the oldest end until the whole window fits the
 * character ceiling. A transcript must never enter this window — it is the largest single payload in
 * the feature and would dominate every subsequent call — so provider turns are truncated too.
 */
export function capHistory(history: unknown): ConversationTurn[] | undefined {
  if (!Array.isArray(history) || history.length === 0) return undefined;

  const turns = history
    .filter((turn): turn is ConversationTurn => !!turn && typeof turn === 'object')
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({
      role: turn.role === 'assistant' ? ('assistant' as const) : ('provider' as const),
      text: typeof turn.text === 'string' ? turn.text : undefined,
      charted: asStringArray(turn.charted),
      skipped: asStringArray(turn.skipped),
    }));

  while (turns.length > 0 && JSON.stringify(turns).length > MAX_HISTORY_CHARS) {
    turns.shift();
  }
  return turns.length > 0 ? turns : undefined;
}
