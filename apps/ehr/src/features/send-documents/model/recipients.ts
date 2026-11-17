import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import {
  DOCUMENT_PACKET_MAX_RECIPIENTS,
  DocumentPacketRecipient,
  DocumentPacketSource,
  isPacketEmailValid,
  SendDocumentPacketInput,
} from 'utils/lib/types/api/document-packet.types';
import { RecipientFormValue, SendDocumentsFormValues } from './types';

export const emptyRecipient = (): RecipientFormValue => ({
  name: '',
  credential: '',
  organization: '',
  channel: 'fax',
  faxNumber: '',
  email: '',
  phoneNumber: '',
  saveAsPcp: false,
});

/**
 * First recipient, prefilled from the patient's PCP when one is on file. `saveAsPcp` defaults to on only
 * when the patient has no PCP yet.
 */
export const initialRecipients = (
  pcp: DocumentPacketRecipient | undefined,
  hasSavedPcp: boolean
): RecipientFormValue[] => [
  {
    name: pcp?.name ?? '',
    credential: pcp?.credential ?? '',
    organization: pcp?.organization ?? '',
    channel: FEATURE_FLAGS.SENDGRID_ENABLED && pcp?.email ? 'email' : 'fax',
    faxNumber: pcp?.faxNumber ?? '',
    email: pcp?.email ?? '',
    phoneNumber: pcp?.phoneNumber ?? '',
    saveAsPcp: !hasSavedPcp,
  },
];

/**
 * The patient record holds exactly one PCP, so the checkbox behaves like a radio across recipients:
 * ticking one clears the others. Ticking the already-selected one clears it.
 */
export const applySaveAsPcp = (recipients: RecipientFormValue[], index: number, value: boolean): RecipientFormValue[] =>
  recipients.map((recipient, position) => ({ ...recipient, saveAsPcp: position === index ? value : false }));

export const canAddRecipient = (recipients: RecipientFormValue[]): boolean =>
  recipients.length < DOCUMENT_PACKET_MAX_RECIPIENTS;

export const isRecipientFaxNumberValid = (recipient: RecipientFormValue): boolean =>
  isPhoneNumberValid(recipient.faxNumber);

/** A valid address for the channel the recipient is on. */
export const isRecipientAddressValid = (recipient: RecipientFormValue): boolean =>
  recipient.channel === 'email' ? isPacketEmailValid(recipient.email) : isRecipientFaxNumberValid(recipient);

/** Every recipient needs a valid fax number or email, and there must be something to send. */
export const canSend = (recipients: RecipientFormValue[], hasDocuments: boolean): boolean => {
  if (!hasDocuments || recipients.length === 0) return false;
  return recipients.every(isRecipientAddressValid);
};

const trimmedOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** Whatever the source names is sent in full; only the choice of visits comes from the form. */
export const toSendDocumentPacketInput = (
  source: DocumentPacketSource,
  values: SendDocumentsFormValues
): SendDocumentPacketInput => ({
  source:
    source.type === 'visits' && values.selectedAppointmentIds
      ? { ...source, appointmentIds: values.selectedAppointmentIds }
      : source,
  recipients: values.recipients.map((recipient) => ({
    name: trimmedOrUndefined(recipient.name),
    credential: trimmedOrUndefined(recipient.credential),
    organization: trimmedOrUndefined(recipient.organization),
    ...(recipient.channel === 'email'
      ? { email: recipient.email.trim().toLowerCase() }
      : { faxNumber: recipient.faxNumber.trim() }),
    phoneNumber: trimmedOrUndefined(recipient.phoneNumber),
    // PCP management belongs to the original single-visit flow. Patient-level dialogs do not expose
    // that control, and stale form state must not make those sends mutate generalPractitioner.
    // The PCP record has no email, so only a fax recipient can be saved as the PCP.
    ...(source.type === 'visit' && recipient.channel === 'fax' && recipient.saveAsPcp ? { saveAsPcp: true } : {}),
  })),
});
