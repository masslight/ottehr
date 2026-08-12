import {
  FAX_MAX_RECIPIENTS,
  FAX_MAX_TRANSMISSIONS,
  getPhoneNumberDigits,
  INVALID_INPUT_ERROR,
  isFaxNumberValid,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  SendFaxZambdaInput,
} from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const OptionalTextSchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => (value ? value : undefined));

const FaxRecipientSchema = z.object({
  faxNumber: z.string().min(1),
  name: OptionalTextSchema,
  organization: OptionalTextSchema,
  phoneNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

const SendFaxTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('visit-note'), appointmentId: z.string().uuid() }),
  z.object({
    type: z.literal('visit-documents'),
    patientId: z.string().uuid(),
    appointmentIds: z
      .array(z.string().uuid())
      .min(1)
      .max(FAX_MAX_TRANSMISSIONS)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'Each visit may only be selected once' }),
  }),
  z.object({ type: z.literal('medical-record'), patientId: z.string().uuid() }),
  z.object({
    type: z.literal('document'),
    patientId: z.string().uuid(),
    documentReferenceId: z.string().uuid(),
  }),
]);

const SendFaxBodySchema = z
  .object({
    target: SendFaxTargetSchema,
    recipients: z
      .array(FaxRecipientSchema)
      .min(1)
      .max(FAX_MAX_RECIPIENTS)
      .refine(
        (recipients) =>
          new Set(recipients.map((recipient) => getPhoneNumberDigits(recipient.faxNumber))).size === recipients.length,
        { message: 'Each fax number may only be entered once' }
      ),
  })
  // Every visit is faxed to every recipient, so the two counts multiply into the work this
  // request has to finish within one invocation.
  .refine((body) => countTransmissions(body) <= FAX_MAX_TRANSMISSIONS, {
    message: `A single request can send at most ${FAX_MAX_TRANSMISSIONS} faxes; select fewer visits or recipients`,
  });

const countTransmissions = (body: SendFaxZambdaInput): number =>
  (body.target.type === 'visit-documents' ? body.target.appointmentIds.length : 1) * body.recipients.length;

export function validateRequestParameters(input: ZambdaInput): SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const data = safeJsonParse(input.body);
  const { target, recipients } = safeValidate(SendFaxBodySchema, data);

  return {
    target,
    recipients: recipients.map((recipient) => {
      if (!isFaxNumberValid(recipient.faxNumber)) {
        throw INVALID_INPUT_ERROR('"faxNumber" is not a valid phone number');
      }
      if (recipient.phoneNumber && !isFaxNumberValid(recipient.phoneNumber)) {
        throw INVALID_INPUT_ERROR('"phoneNumber" is not a valid phone number');
      }
      // The fax provider expects E.164; the cover page renders it back to a readable form.
      return { ...recipient, faxNumber: `+1${getPhoneNumberDigits(recipient.faxNumber)}` };
    }),
    secrets: input.secrets,
  };
}
