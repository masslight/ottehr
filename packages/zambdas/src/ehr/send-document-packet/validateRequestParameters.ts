import { formatPhoneNumber, isPhoneNumberValid, standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { isEmailRecipient, SendFaxPacketInput, SendFaxPacketInputSchema } from 'utils/lib/types/api/fax.types';
import { INVALID_INPUT_ERROR, MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): SendFaxPacketInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeValidate(SendFaxPacketInputSchema, safeJsonParse(input.body));

  const recipients = parsed.recipients.map((recipient) => {
    // The follow-up phone is printed on the cover sheet and never dialled, so a number we cannot
    // standardize is passed through as typed rather than rejected.
    const phoneNumber = recipient.phoneNumber
      ? standardizePhoneNumber(recipient.phoneNumber) ?? recipient.phoneNumber
      : undefined;
    if (isEmailRecipient(recipient)) {
      // The schema has already trimmed, lowercased and format-checked the address.
      return { ...recipient, phoneNumber };
    }
    if (!isPhoneNumberValid(recipient.faxNumber)) {
      throw INVALID_INPUT_ERROR(`"${recipient.faxNumber}" is not a valid fax number`);
    }
    const faxNumber = formatPhoneNumber(recipient.faxNumber);
    if (!faxNumber) {
      throw INVALID_INPUT_ERROR(`"${recipient.faxNumber}" is not a valid fax number`);
    }
    return { ...recipient, faxNumber, phoneNumber };
  });

  return {
    source: parsed.source,
    recipients,
    secrets: input.secrets,
  };
}
