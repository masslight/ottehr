import {
  FAX_DOCUMENT_TYPES,
  INVALID_INPUT_ERROR,
  isPhoneNumberValid,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  SendFaxZambdaInput,
} from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const FaxRecipientSchema = z.object({
  name: z.string().optional(),
  organization: z.string().optional(),
  faxNumber: z.string().min(1),
  phoneNumber: z.string().optional(),
});

const SendFaxBodySchema = z.object({
  appointmentId: z.string().uuid(),
  documents: z.array(z.enum(FAX_DOCUMENT_TYPES)).min(1),
  recipients: z.array(FaxRecipientSchema).min(1),
  timezone: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const data = safeJsonParse(input.body);
  const { appointmentId, documents, recipients, timezone } = safeValidate(SendFaxBodySchema, data);

  const normalizedRecipients = recipients.map((recipient) => {
    if (!isPhoneNumberValid(recipient.faxNumber)) {
      throw INVALID_INPUT_ERROR(`"faxNumber" ${recipient.faxNumber} is not a valid phone number`);
    }
    return { ...recipient, faxNumber: `+1${recipient.faxNumber}` };
  });

  // Dedupe and normalize to the canonical display order so the merged fax
  // document always reads cover page -> summary -> note -> results, etc.
  const orderedDocuments = FAX_DOCUMENT_TYPES.filter((type) => documents.includes(type));

  return {
    appointmentId,
    documents: orderedDocuments,
    recipients: normalizedRecipients,
    timezone,
    secrets: input.secrets,
  };
}
