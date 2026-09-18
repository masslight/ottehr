import { SaveTranscriptRequest } from 'utils/lib/easy-chart/api';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
// The same ceiling as the planner: a transcript this endpoint stores is one the planner must accept back.
import { MAX_NARRATIVE_CHARS } from '../easy-chart-plan/validateRequestParameters';

export function validateRequestParameters(input: ZambdaInput): SaveTranscriptRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const body = JSON.parse(input.body) as Partial<SaveTranscriptRequest>;

  if (typeof body.transcript !== 'string' || !body.transcript.trim()) {
    throw INVALID_INPUT_ERROR('"transcript" is required');
  }
  if (body.transcript.length > MAX_NARRATIVE_CHARS) {
    throw INVALID_INPUT_ERROR(`"transcript" exceeds ${MAX_NARRATIVE_CHARS} characters`);
  }
  if (typeof body.encounterId !== 'string' || !body.encounterId) {
    throw INVALID_INPUT_ERROR('"encounterId" is required');
  }
  if (body.documentId !== undefined && (typeof body.documentId !== 'string' || !body.documentId)) {
    throw INVALID_INPUT_ERROR('"documentId" must be a non-empty string');
  }

  return {
    transcript: body.transcript.trim(),
    encounterId: body.encounterId,
    documentId: body.documentId,
    secrets: input.secrets,
  };
}
