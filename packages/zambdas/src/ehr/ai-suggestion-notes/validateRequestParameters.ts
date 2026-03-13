import { AISuggestionNotesInput, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): AISuggestionNotesInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  // no complication
  const { type, hpi, details } = JSON.parse(input.body);

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
