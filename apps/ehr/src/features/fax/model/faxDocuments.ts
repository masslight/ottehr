import { FAX_DOCUMENT_LABELS, FAX_DOCUMENT_ORDER, FaxDocumentAvailability } from 'utils';

/** Labels of the documents that will actually go into the packet, for the read-only "what's included" tooltip. */
export const availableDocumentLabels = (availability: FaxDocumentAvailability[]): string[] =>
  FAX_DOCUMENT_ORDER.filter((kind) => availability.some((entry) => entry.kind === kind && entry.available)).map(
    (kind) => FAX_DOCUMENT_LABELS[kind]
  );

/** Nothing to send: the Send button must stay disabled. */
export const hasNothingToSend = (availability: FaxDocumentAvailability[]): boolean =>
  availableDocumentLabels(availability).length === 0;
