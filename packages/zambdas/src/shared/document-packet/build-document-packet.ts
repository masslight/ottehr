import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { uploadObjectToZ3 } from 'utils/lib/helpers/presigned-file-url/helpers';
import { Secrets } from 'utils/lib/secrets';
import {
  DOCUMENT_PACKET_MAX_BYTES,
  DOCUMENT_PACKET_MAX_PAGES,
  DocumentPacketRecipient,
  DocumentPacketSource,
  formatRecipientName,
} from 'utils/lib/types/api/document-packet.types';
import { getMimeType } from 'utils/lib/utils/file';
import { mapWithConcurrency } from '../concurrency';
import { makeDocumentPacketDocumentReference } from '../pdf/make-document-packet-document-reference';
import {
  createFaxAttachmentPlaceholderPdf,
  downloadFileBytes,
  mergePdfDocuments,
  normalizeFileToPdf,
} from '../pdf/merge-pdfs';
import { createPacketCoverSheetPdfBytes } from '../pdf/packet-cover-sheet-pdf';
import { PdfInfo } from '../pdf/pdf-utils';
import { PacketCoverSheetData, PacketCoverSheetSubject } from '../pdf/types';
import { makeZ3Url } from '../presigned-file-urls/helpers';
import { createPresignedUrl } from '../z3Utils';
import { DocumentPacketPart } from './collect-visit-documents';

/**
 * One cover sheet's worth of documents, merged into a single PDF. A packet has one section per
 * visit, so a multi-visit send introduces each visit with its own cover sheet.
 */
export interface DocumentPacketSection {
  subject: PacketCoverSheetSubject;
  bytes: Uint8Array;
  pageCount: number;
  parts: DocumentPacketPart[];
}

/**
 * The selected documents merged into PDFs, without cover sheets.
 *
 * The body is identical for every recipient (only the cover sheets differ), so it is built once per
 * request and reused. If recipients later get per-recipient options that affect the body, this will need to
 * be rebuilt per recipient.
 */
export interface DocumentPacketBody {
  sections: DocumentPacketSection[];
  /** Document pages across every section; cover sheets are added per recipient. */
  pageCount: number;
  parts: DocumentPacketPart[];
}

/**
 * How many source documents are fetched at once. A medical-record packet spans every document on
 * file, so an unbounded fan-out would open one Z3 round-trip per document simultaneously.
 */
const PART_DOWNLOAD_CONCURRENCY = 5;

/**
 * Running total of the source bytes pulled for one packet, so an oversized selection is rejected
 * while it downloads instead of after the whole thing has been fetched and merged. Shared across a
 * multi-visit packet's sections, because the limit applies to the packet as a whole.
 */
export interface DocumentPacketByteBudget {
  consume: (byteCount: number) => void;
}

export const createDocumentPacketByteBudget = (
  sourceType: DocumentPacketSource['type'],
  maxBytes: number = DOCUMENT_PACKET_MAX_BYTES
): DocumentPacketByteBudget => {
  let used = 0;
  return {
    consume: (byteCount) => {
      used += byteCount;
      if (used > maxBytes) {
        throw new DocumentPacketTooLargeError(
          `Document packet source documents are over ${(used / (1024 * 1024)).toFixed(1)} MB, which exceeds the ` +
            `${MAX_BYTES_MB} MB limit. ${documentPacketLimitGuidance(sourceType)}`
        );
      }
    },
  };
};

/** Merges already-collected parts into one section. */
export async function buildDocumentPacketSection(args: {
  token: string;
  subject: PacketCoverSheetSubject;
  parts: DocumentPacketPart[];
  /** Defaults to a budget covering this section alone; pass one in to span a multi-section packet. */
  budget?: DocumentPacketByteBudget;
}): Promise<DocumentPacketSection> {
  const { token, subject, parts } = args;
  const budget = args.budget ?? createDocumentPacketByteBudget('visit');

  const partBytes = await mapWithConcurrency(parts, PART_DOWNLOAD_CONCURRENCY, async (part) => {
    let raw: Uint8Array;
    try {
      raw = part.bytes ?? (await downloadPart(part, token));
    } catch (error) {
      if (error instanceof DocumentPacketError) throw error;
      const reason = error instanceof Error ? error.message : 'could not be retrieved';
      throw new DocumentPacketError(
        `Document packet part "${part.title}" ${reason}. The entire packet was not sent.`,
        error
      );
    }

    // Counted before rendering so an oversized selection stops downloading the rest.
    budget.consume(raw.length);

    try {
      return await normalizeFileToPdf(raw, part.contentType ?? (part.z3Url ? getMimeType(part.z3Url) : undefined));
    } catch (error) {
      // The recipient must be told when content is omitted. Preserve the packet order with a notice
      // page instead of silently dropping the attachment or rejecting the remaining documents.
      console.error(`[document-packet] could not render "${part.title}"; inserting a replacement notice`, error);
      try {
        return await createFaxAttachmentPlaceholderPdf(part.title);
      } catch (placeholderError) {
        throw new DocumentPacketError(
          `Document packet part "${part.title}" could not be rendered and its replacement notice could not be created. ` +
            'The entire packet was not sent.',
          placeholderError
        );
      }
    }
  });

  let merged: Awaited<ReturnType<typeof mergePdfDocuments>>;
  try {
    merged = await mergePdfDocuments(partBytes);
  } catch (error) {
    throw new Error('A document packet source document is not a valid PDF. The entire packet was not sent.', {
      cause: error,
    });
  }
  const { bytes, pageCount } = merged;
  return { subject, bytes, pageCount, parts };
}

const downloadPart = async (part: DocumentPacketPart, token: string): Promise<Uint8Array> => {
  if (!part.z3Url) throw new Error('has neither generated bytes nor a stored file');
  return downloadFileBytes(part.z3Url, token);
};

/** A failure already phrased for the user, so the per-part handler passes it through untouched. */
class DocumentPacketError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'DocumentPacketError';
  }
}

export class DocumentPacketTooLargeError extends DocumentPacketError {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentPacketTooLargeError';
  }
}

/** Collapses sections into the shape the sender works with. */
export const toDocumentPacketBody = (sections: DocumentPacketSection[]): DocumentPacketBody => ({
  sections,
  pageCount: sections.reduce((total, section) => total + section.pageCount, 0),
  parts: sections.flatMap((section) => section.parts),
});

export const interleaveDocumentPacketSections = (
  covers: Uint8Array[],
  sections: Pick<DocumentPacketSection, 'bytes'>[]
): Uint8Array[] => {
  if (covers.length !== sections.length) throw new Error('Every document packet section requires one cover sheet');
  return covers.flatMap((cover, index) => [cover, sections[index].bytes]);
};

const MAX_BYTES_MB = (DOCUMENT_PACKET_MAX_BYTES / (1024 * 1024)).toFixed(0);

export const documentPacketLimitGuidance = (sourceType: DocumentPacketSource['type']): string => {
  switch (sourceType) {
    case 'visit':
      return 'Select fewer visit documents and try again.';
    case 'visits':
      return 'Select fewer visits and try again.';
    case 'medical-record':
      return 'Fax the needed documents individually instead.';
    case 'document':
      return 'Reduce the document below the fax limit before trying again.';
  }
};

/**
 * Renders the recipient's cover sheet, merges it in front of the already-built body and enforces the
 * transmission limits.
 *
 * Never re-collects or re-merges the body: `body` is passed in precisely so that a multi-recipient
 * send does that work once.
 */
export async function buildPacketForRecipient(args: {
  body: DocumentPacketBody;
  recipient: DocumentPacketRecipient;
  /** Sender + generatedAt; each section supplies its own subject, and totalPages is filled in here. */
  coverSheet: Omit<PacketCoverSheetData, 'totalPages' | 'recipient' | 'subject'>;
  sourceType: DocumentPacketSource['type'];
}): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const { body, recipient, coverSheet, sourceType } = args;

  const recipientDetails = {
    name: formatRecipientName(recipient),
    organization: recipient.organization,
    faxNumber: recipient.faxNumber,
    email: recipient.email,
    phoneNumber: recipient.phoneNumber,
  };

  // Every cover sheet prints the whole transmission's page count, which depends on how long the
  // cover sheets themselves are. One correction pass is enough: the count only ever grows the
  // footer text.
  const renderCovers = async (totalPages: number): Promise<Uint8Array[]> =>
    Promise.all(
      body.sections.map((section) =>
        createPacketCoverSheetPdfBytes({
          ...coverSheet,
          subject: section.subject,
          recipient: recipientDetails,
          totalPages,
        })
      )
    );
  let covers = await renderCovers(body.sections.length + body.pageCount);
  let merged = await mergePdfDocuments(interleaveDocumentPacketSections(covers, body.sections));
  const coverPages = merged.pageCount - body.pageCount;

  if (coverPages !== body.sections.length) {
    covers = await renderCovers(coverPages + body.pageCount);
    merged = await mergePdfDocuments(interleaveDocumentPacketSections(covers, body.sections));
  }

  // Enforced before the upload so an oversized packet leaves nothing behind in storage.
  if (merged.pageCount > DOCUMENT_PACKET_MAX_PAGES) {
    throw new Error(
      `Document packet is ${merged.pageCount} pages, which exceeds the ${DOCUMENT_PACKET_MAX_PAGES} page limit. ` +
        documentPacketLimitGuidance(sourceType)
    );
  }
  if (merged.bytes.length > DOCUMENT_PACKET_MAX_BYTES) {
    throw new DocumentPacketTooLargeError(
      `Document packet is ${(merged.bytes.length / (1024 * 1024)).toFixed(
        1
      )} MB, which exceeds the ${MAX_BYTES_MB} MB ` + `limit. ${documentPacketLimitGuidance(sourceType)}`
    );
  }

  return { bytes: merged.bytes, pageCount: merged.pageCount };
}

export async function uploadDocumentPacket(args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  packet: { bytes: Uint8Array; pageCount: number };
  patientId: string;
  /** Absent when the packet does not belong to a single visit. */
  appointmentId?: string;
  encounterId?: string;
  listResources: List[];
}): Promise<{ pdfInfo: PdfInfo; documentReference: DocumentReference; pageCount: number }> {
  const { oystehr, token, secrets, packet, patientId, appointmentId, encounterId, listResources } = args;

  // A retry must re-send the original bytes, so every packet is its own immutable file: the unique
  // filename doubles as the DocumentReference title, which is what keeps earlier packets from being
  // superseded (see makeDocumentPacketDocumentReference).
  const fileName = `FaxPacket-${DateTime.now().toUTC().toFormat('yyyy-MM-dd-HHmmss')}-${randomUUID()}.pdf`;

  const uploadURL = makeZ3Url({
    secrets,
    bucketName: BUCKET_NAMES.FAXES,
    patientID: patientId,
    fileName,
  });

  const presignedUploadUrl = await createPresignedUrl(token, uploadURL, 'upload');

  await uploadObjectToZ3(packet.bytes, presignedUploadUrl);

  const pdfInfo: PdfInfo = { title: fileName, uploadURL };

  const documentReference = await makeDocumentPacketDocumentReference({
    oystehr,
    pdfInfo,
    patientId,
    appointmentId,
    encounterId,
    listResources,
  });

  return { pdfInfo, documentReference, pageCount: packet.pageCount };
}
