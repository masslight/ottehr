import {
  INVALID_INPUT_ERROR,
  isPhoneNumberValid,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  SendFaxPacketInput,
  SendFaxPacketInputSchema,
  standardizePhoneNumber,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

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
    documents: parsed.documents,
    recipients,
    secrets: input.secrets,
  };
}
