import {
  DOCUMENT_PACKET_DOCUMENT_LABELS,
  PACKET_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON,
  PacketDocumentAvailability,
} from 'utils/lib/types/api/document-packet.types';

export interface PacketDocumentLabelGroups {
  /** Documents that will go into the packet. */
  included: string[];
  /** Documents this visit doesn't have, so the recipient knows what is missing. */
  excluded: string[];
}

const isInPacket = (entry: PacketDocumentAvailability): boolean =>
  entry.available || entry.unavailableReason === PACKET_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON;

/**
 * Splits the packet's documents into what it will and won't contain, for the read-only tooltip. The server
 * lists them in packet order (a referral form first, then the visit documents in merge order, then a referral's earlier-visit documents).
 */
export const documentLabelGroups = (availability: PacketDocumentAvailability[]): PacketDocumentLabelGroups => {
  const included: string[] = [];
  const excluded: string[] = [];
  for (const entry of availability) {
    (isInPacket(entry) ? included : excluded).push(entry.title ?? DOCUMENT_PACKET_DOCUMENT_LABELS[entry.kind]);
  }
  return { included, excluded };
};

/** Labels of the documents that will actually go into the packet. */
export const availableDocumentLabels = (availability: PacketDocumentAvailability[]): string[] =>
  documentLabelGroups(availability).included;

/** Nothing to send: the Send button must stay disabled. */
export const hasNothingToSend = (availability: PacketDocumentAvailability[]): boolean =>
  availableDocumentLabels(availability).length === 0;
