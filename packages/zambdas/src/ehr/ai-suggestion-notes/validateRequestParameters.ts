import { AISuggestionNotesInput, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): AISuggestionNotesInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  // no complication
  const { type, details } = JSON.parse(input.body);

  if (!type) {
    throw MISSING_REQUIRED_PARAMETERS(['type']);
  }

  if (!['procedure'].includes(type)) {
    throw new Error('Invalid type');
  }

  if (!details) {
    throw MISSING_REQUIRED_PARAMETERS(['details']);
  }

  if (type === 'procedure' && details.procedureDetails == undefined) {
    throw new Error('If type is procedure, procedureDetails is required');
  }

  return {
    type,
    details,
    secrets: input.secrets,
  };
}
