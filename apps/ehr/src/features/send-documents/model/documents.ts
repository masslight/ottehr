import {
  PACKET_DOCUMENT_LABELS,
  PACKET_DOCUMENT_ORDER,
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

/** Splits the visit's documents into what the packet will and won't contain, for the read-only tooltip. */
export const documentLabelGroups = (availability: PacketDocumentAvailability[]): PacketDocumentLabelGroups => {
  const included: string[] = [];
  const excluded: string[] = [];
  for (const kind of PACKET_DOCUMENT_ORDER) {
    const entry = availability.find((item) => item.kind === kind);
    if (!entry) continue;
    (isInPacket(entry) ? included : excluded).push(PACKET_DOCUMENT_LABELS[kind]);
  }
  return { included, excluded };
};

/** Labels of the documents that will actually go into the packet. */
export const availableDocumentLabels = (availability: PacketDocumentAvailability[]): string[] =>
  documentLabelGroups(availability).included;

/** Nothing to send: the Send button must stay disabled. */
export const hasNothingToSend = (availability: PacketDocumentAvailability[]): boolean =>
  availableDocumentLabels(availability).length === 0;
