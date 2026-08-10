import { AISuggestionNotesInput } from 'utils/lib/types/api/ai-suggestions-notes';
import { MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): AISuggestionNotesInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  // no complication
  const { type, hpi, details } = safeJsonParse(input.body);

  if (!type) {
    throw MISSING_REQUIRED_PARAMETERS(['type']);
  }

  if (!['procedure', 'missing-hpi'].includes(type)) {
    throw new Error('Invalid type');
  }

  if (type === 'procedure' && details.procedureDetails == undefined) {
    throw new Error('If type is procedure, procedureDetails is required');
  }

  if (type === 'missing-hpi' && hpi == undefined) {
    throw new Error('If type is missing-hpi, hpi is required');
  }

  return {
    type,
    hpi,
    details,
    secrets: input.secrets,
  };
}
