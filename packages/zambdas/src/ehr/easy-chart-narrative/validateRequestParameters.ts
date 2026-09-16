import { ChartNarrativeRequest } from 'utils/lib/easy-chart/api';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
// The same ceiling as the planner: a transcript this endpoint accepts is one the planner must accept back.
import { MAX_NARRATIVE_CHARS } from '../easy-chart-plan/validateRequestParameters';

export function validateRequestParameters(input: ZambdaInput): ChartNarrativeRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const body = JSON.parse(input.body) as Partial<ChartNarrativeRequest>;

  if (typeof body.transcript !== 'string' || !body.transcript.trim()) {
    throw INVALID_INPUT_ERROR('"transcript" is required');
  }
  if (body.transcript.length > MAX_NARRATIVE_CHARS) {
    throw INVALID_INPUT_ERROR(`"transcript" exceeds ${MAX_NARRATIVE_CHARS} characters`);
  }
  if (body.encounterId !== undefined && typeof body.encounterId !== 'string') {
    throw INVALID_INPUT_ERROR('"encounterId" must be a string');
  }
  if (body.documentId !== undefined && typeof body.documentId !== 'string') {
    throw INVALID_INPUT_ERROR('"documentId" must be a string');
  }

  return {
    transcript: body.transcript,
    encounterId: body.encounterId,
    documentId: body.documentId,
    secrets: input.secrets,
  };
}
