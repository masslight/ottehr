import { DateTime } from 'luxon';
import { CreateInvoiceablePatientsReportZambdaInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): {
  startFrom?: DateTime;
  secrets: Secrets;
} {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  console.log('validating request parameters');
  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  const parsedJSON = JSON.parse(input.body) as unknown;
  const { startFrom: inputDate } = CreateInvoiceablePatientsReportZambdaInput.parse(parsedJSON);
  if (inputDate) {
    const startFrom = DateTime.fromISO(inputDate);
    if (!startFrom.isValid) {
      throw new Error(`Invalid date format provided: ${startFrom.invalidReason}`);
    }
    return { secrets: input.secrets, startFrom };
  }

  return {
    secrets: input.secrets,
  };
}
