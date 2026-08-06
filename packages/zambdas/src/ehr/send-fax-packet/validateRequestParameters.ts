import { INVALID_INPUT_ERROR, MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { SendFaxPacketInput, SendFaxPacketInputSchema } from 'utils/lib/types/api/fax.types';
import { isPhoneNumberValid, standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

/** Dialable form: `+1` followed by the last ten digits. Matches what `send-fax` stores. */
const toDialableFaxNumber = (faxNumber: string): string => `+1${faxNumber.replace(/\D/g, '').slice(-10)}`;

export function validateRequestParameters(input: ZambdaInput): SendFaxPacketInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeValidate(SendFaxPacketInputSchema, safeJsonParse(input.body));

  const recipients = parsed.recipients.map((recipient) => {
    if (!isPhoneNumberValid(recipient.faxNumber)) {
      throw INVALID_INPUT_ERROR(`"${recipient.faxNumber}" is not a valid fax number`);
    }
    return {
      ...recipient,
      faxNumber: toDialableFaxNumber(recipient.faxNumber),
      // The follow-up phone is printed on the cover sheet and never dialled, so a number we cannot
      // standardize is passed through as typed rather than rejected.
      phoneNumber: recipient.phoneNumber
        ? standardizePhoneNumber(recipient.phoneNumber) ?? recipient.phoneNumber
        : undefined,
    };
  });

  return {
    appointmentId: parsed.appointmentId,
    recipients,
    secrets: input.secrets,
  };
}
