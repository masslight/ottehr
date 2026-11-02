import { FAX_PACKET_DOCUMENT_LABELS, FaxDocumentAvailability } from 'utils/lib/types/api/fax.types';

export interface FaxDocumentLabelGroups {
  /** Documents that will go into the packet. */
  included: string[];
  /** Documents this visit doesn't have, so the recipient knows what is missing. */
  excluded: string[];
}

/**
 * Splits the packet's documents into what it will and won't contain, for the read-only tooltip. The server
 * lists them in packet order (a referral form first, then the visit documents in merge order).
 */
export const documentLabelGroups = (availability: FaxDocumentAvailability[]): FaxDocumentLabelGroups => {
  const included: string[] = [];
  const excluded: string[] = [];
  for (const entry of availability) {
    (entry.available ? included : excluded).push(FAX_PACKET_DOCUMENT_LABELS[entry.kind]);
  }
  return { included, excluded };
};

/** Labels of the documents that will actually go into the packet. */
export const availableDocumentLabels = (availability: FaxDocumentAvailability[]): string[] =>
  documentLabelGroups(availability).included;

/** Nothing to send: the Send button must stay disabled. */
export const hasNothingToSend = (availability: FaxDocumentAvailability[]): boolean =>
  availableDocumentLabels(availability).length === 0;
