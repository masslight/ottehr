import {
  FAX_MAX_RECIPIENTS,
  FaxDocumentAvailability,
  FaxDocumentKind,
  FaxRecipient,
  isPhoneNumberValid,
  SendFaxPacketInput,
} from 'utils';
import { resolveSelection } from './faxDocuments';
import { FaxDocumentSelectionMode, FaxFormValues, FaxRecipientFormValue } from './types';

export const emptyRecipient = (): FaxRecipientFormValue => ({
  name: '',
  organization: '',
  faxNumber: '',
  phoneNumber: '',
  saveAsPcp: false,
});

/**
 * First recipient, prefilled from the patient's PCP when one is on file.
 *
 * `saveAsPcp` defaults to on only when the patient has no PCP yet — a fax dialog must never silently overwrite data.
 */
export const initialRecipients = (pcp: FaxRecipient | undefined, hasSavedPcp: boolean): FaxRecipientFormValue[] => [
  {
    name: pcp?.name ?? '',
    organization: pcp?.organization ?? '',
    faxNumber: pcp?.faxNumber ?? '',
    phoneNumber: pcp?.phoneNumber ?? '',
    saveAsPcp: !hasSavedPcp,
  },
];

/**
 * The patient record holds exactly one PCP, so the checkbox behaves like a radio across recipients:
 * ticking one clears the others. Ticking the already-selected one clears it.
 */
export const applySaveAsPcp = (
  recipients: FaxRecipientFormValue[],
  index: number,
  value: boolean
): FaxRecipientFormValue[] =>
  recipients.map((recipient, position) => ({
    ...recipient,
    saveAsPcp: position === index ? value : false,
  }));

export const canAddRecipient = (recipients: FaxRecipientFormValue[]): boolean => recipients.length < FAX_MAX_RECIPIENTS;

export const isRecipientFaxNumberValid = (recipient: FaxRecipientFormValue): boolean =>
  isPhoneNumberValid(recipient.faxNumber);

/** Every recipient needs a valid fax number, and at least one document has to be going out. */
export const canSend = (args: {
  mode: FaxDocumentSelectionMode;
  availability: FaxDocumentAvailability[];
  selectedKinds: FaxDocumentKind[];
  recipients: FaxRecipientFormValue[];
}): boolean => {
  const documents = resolveSelection(args.mode, args.availability, args.selectedKinds);
  if (documents.length === 0) return false;
  if (args.recipients.length === 0) return false;
  return args.recipients.every(isRecipientFaxNumberValid);
};

const trimmedOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const toSendFaxPacketInput = (
  appointmentId: string,
  values: FaxFormValues,
  availability: FaxDocumentAvailability[]
): SendFaxPacketInput => ({
  appointmentId,
  documents: resolveSelection(values.mode, availability, values.selectedKinds),
  recipients: values.recipients.map((recipient) => ({
    name: trimmedOrUndefined(recipient.name),
    organization: trimmedOrUndefined(recipient.organization),
    faxNumber: recipient.faxNumber.trim(),
    phoneNumber: trimmedOrUndefined(recipient.phoneNumber),
    ...(recipient.saveAsPcp ? { saveAsPcp: true } : {}),
  })),
});
