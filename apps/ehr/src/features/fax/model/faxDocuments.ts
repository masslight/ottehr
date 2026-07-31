import { FAX_DOCUMENT_LABELS, FAX_DOCUMENT_ORDER, FaxDocumentAvailability } from 'utils';

export interface FaxDocumentLabelGroups {
  /** Documents that will go into the packet. */
  included: string[];
  /** Documents this visit doesn't have, so the recipient knows what is missing. */
  excluded: string[];
}

/** Splits the visit's documents into what the packet will and won't contain, for the read-only tooltip. */
export const documentLabelGroups = (availability: FaxDocumentAvailability[]): FaxDocumentLabelGroups => {
  const included: string[] = [];
  const excluded: string[] = [];
  for (const kind of FAX_DOCUMENT_ORDER) {
    const entry = availability.find((item) => item.kind === kind);
    if (!entry) continue;
    (entry.available ? included : excluded).push(FAX_DOCUMENT_LABELS[kind]);
  }
  return { included, excluded };
};

/** Labels of the documents that will actually go into the packet. */
export const availableDocumentLabels = (availability: FaxDocumentAvailability[]): string[] =>
  documentLabelGroups(availability).included;

/** Nothing to send: the Send button must stay disabled. */
export const hasNothingToSend = (availability: FaxDocumentAvailability[]): boolean =>
  availableDocumentLabels(availability).length === 0;
