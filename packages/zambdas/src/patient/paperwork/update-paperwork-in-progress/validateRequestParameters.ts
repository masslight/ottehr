import { DateTime } from 'luxon';
import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';

interface UpdatePaperworkInProgressParams {
  appointmentID: string;
  inProgress: string;
}

export function validateUpdatePaperworkParams(input: ZambdaInput): UpdatePaperworkInProgressParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const inputJSON = JSON.parse(input.body);
  console.log('inputJSON', JSON.stringify(inputJSON));
  const { appointmentID, inProgress } = inputJSON;

  if (inProgress === undefined || !DateTime.fromISO(inProgress).isValid) {
    throw new Error('Paperwork in progress update must supply a valid iso string for inProgress param');
  }

  return {
    appointmentID,
    inProgress,
  };
}
