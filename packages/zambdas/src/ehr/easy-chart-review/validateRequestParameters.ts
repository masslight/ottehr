import { ChartReviewRequest } from 'utils/lib/easy-chart/api';
import { ZambdaInput } from '../../shared/types/common';

/** A whole ambient transcript is a legitimate narrative to review a note against. */
export const MAX_NARRATIVE_CHARS = 120_000;

export function validateRequestParameters(input: ZambdaInput): ChartReviewRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const body = JSON.parse(input.body) as Partial<ChartReviewRequest>;

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
    noteContext: body.noteContext,
    chartState: typeof body.chartState === 'string' ? body.chartState : undefined,
    chartedExamFindings: asStringArray(body.chartedExamFindings),
    templateTitles: asStringArray(body.templateTitles),
    encounterId: body.encounterId,
    secrets: input.secrets,
  };
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}
