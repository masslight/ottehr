import { AISuggestionNotesInput } from 'utils/lib/types/api/ai-suggestions-notes';
import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): AISuggestionNotesInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  // no complication
  const { type, hpi, details, appointmentId, encounterId } = safeJsonParse(input.body);

  if (!type) {
    throw MISSING_REQUIRED_PARAMETERS(['type']);
  }

  if (!['procedure', 'missing-hpi', 'note-review'].includes(type)) {
    throw INVALID_INPUT_ERROR(`type must be one of: procedure, missing-hpi, note-review; received "${type}"`);
  }

  if (type === 'procedure' && details?.procedureDetails == undefined) {
    throw new Error('If type is procedure, procedureDetails is required');
  }

  if (type === 'missing-hpi' && hpi == undefined) {
    throw new Error('If type is missing-hpi, hpi is required');
  }

  if (type === 'note-review') {
    const missing = [...(appointmentId ? [] : ['appointmentId']), ...(encounterId ? [] : ['encounterId'])];
    if (missing.length > 0) {
      throw MISSING_REQUIRED_PARAMETERS(missing);
    }
  }

  return {
    type,
    hpi,
    details,
    appointmentId,
    encounterId,
    secrets: input.secrets,
  };
}
