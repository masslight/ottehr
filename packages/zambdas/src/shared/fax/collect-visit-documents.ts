import Oystehr from '@oystehr/sdk';
import { DocumentReference, ServiceRequest } from 'fhir/r4b';
import {
  DISCHARGE_SUMMARY_CODE,
  PATIENT_EDUCATION_DOC_TYPE_CODE,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import {
  FAX_DOCUMENT_LABELS,
  FAX_DOCUMENT_ORDER,
  FAX_DOCUMENT_UNAVAILABLE_REASONS,
  FAX_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON,
  FaxDocumentAvailability,
  FaxDocumentKind,
} from 'utils/lib/types/api/fax.types';
import { LAB_RESULT_DOC_REF_CODING_CODE } from 'utils/lib/types/data/labs/labs.constants';
import { ORDER_TYPE_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { Secrets } from 'utils/lib/secrets';
import { searchRadiologyResultDocRefs } from '../../ehr/radiology/shared/result-doc-refs';
import { assembleProgressNoteInput } from '../pdf/assemble-progress-note-input';
import { createProgressNotePdfBytes } from '../pdf/progress-note-pdf';
import { FullAppointmentResourcePackage } from '../pdf/visit-details-pdf/types';

/**
 * One document that goes into a fax packet, in merge order. Either it already exists in Z3 (`z3Url`,
 * the usual case) or it was generated for this packet only (`bytes`, e.g. an unsigned visit note).
 */
export interface FaxPacketPart {
  kind: FaxDocumentKind;
  /** Human label, used for logging and for the Task.input snapshot of what was faxed. */
  title: string;
  documentReferenceId?: string;
  /** Set when the part comes from an existing DocumentReference. */
  z3Url?: string;
  /** Set when the part was generated on the fly. */
  bytes?: Uint8Array;
}

type DocumentsByKind = Record<FaxDocumentKind, DocumentReference[]>;

// Newest first
const byDateDescending = (a: DocumentReference, b: DocumentReference): number => {
  const timeOf = (docRef: DocumentReference): number => {
    const value = docRef.date ?? docRef.meta?.lastUpdated;
    return value ? new Date(value).getTime() : 0;
  };

  return timeOf(b) - timeOf(a);
};

const searchDocumentReferences = async (
  oystehr: Oystehr,
  params: { name: string; value: string }[]
): Promise<DocumentReference[]> =>
  (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params,
    })
  ).unbundle();

/**
 * Radiology results do not hang off the encounter directly: they are attached to the encounter's
 * radiology ServiceRequests. Resolve those first, then fan out over them.
 */
const findRadiologyResultDocRefs = async (oystehr: Oystehr, encounterId: string): Promise<DocumentReference[]> => {
  const serviceRequests = (
    await oystehr.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: '_tag', value: `${ORDER_TYPE_CODE_SYSTEM}|radiology` },
        { name: 'status:not', value: 'revoked' },
      ],
    })
  ).unbundle();

  const perOrder = await Promise.all(
    serviceRequests
      .filter((serviceRequest) => !!serviceRequest.id)
      .map((serviceRequest) => searchRadiologyResultDocRefs(serviceRequest.id!, oystehr))
  );

  // A single result document can be related to more than one ServiceRequest, so de-duplicate by id.
  const byId = new Map<string, DocumentReference>();

  perOrder.flat().forEach((docRef) => {
    if (docRef.id && !byId.has(docRef.id)) byId.set(docRef.id, docRef);
  });

  return [...byId.values()];
};

/**
 * Every source document that could go into a fax packet for this visit, one FHIR search per kind.
 */
const findVisitDocuments = async (
  oystehr: Oystehr,
  appointmentId: string,
  encounterId: string
): Promise<DocumentsByKind> => {
  const [progressNote, dischargeSummary, labResults, radiologyResults, patientEducation] = await Promise.all([
    searchDocumentReferences(oystehr, [
      { name: 'related', value: `Appointment/${appointmentId}` },
      { name: 'type', value: VISIT_NOTE_SUMMARY_CODE },
      { name: 'status', value: 'current' },
    ]),
    searchDocumentReferences(oystehr, [
      { name: 'encounter', value: `Encounter/${encounterId}` },
      { name: 'type', value: DISCHARGE_SUMMARY_CODE },
      { name: 'status', value: 'current' },
    ]),
    searchDocumentReferences(oystehr, [
      { name: 'encounter', value: `Encounter/${encounterId}` },
      { name: 'type', value: `${LAB_RESULT_DOC_REF_CODING_CODE.system}|${LAB_RESULT_DOC_REF_CODING_CODE.code}` },
      { name: 'status', value: 'current' },
    ]),
    findRadiologyResultDocRefs(oystehr, encounterId),
    searchDocumentReferences(oystehr, [
      { name: 'encounter', value: `Encounter/${encounterId}` },
      { name: 'type', value: PATIENT_EDUCATION_DOC_TYPE_CODE },
      { name: 'status', value: 'current' },
    ]),
  ]);

  return {
    'progress-note': progressNote.sort(byDateDescending),
    'discharge-summary': dischargeSummary.sort(byDateDescending),
    // docStatus goes preliminary -> final on review; only reviewed results may leave the building.
    'lab-results': labResults.filter((docRef) => docRef.docStatus === 'final').sort(byDateDescending),
    'radiology-results': radiologyResults.sort(byDateDescending),
    'patient-education': patientEducation.sort(byDateDescending),
  };
};

/**
 * Which documents the provider may pick for this visit, and why the rest are greyed out.
 *
 * The progress note is always available: when the visit is unsigned and no DocumentReference exists
 * yet, `collectFaxParts` regenerates it into the packet.
 */
export async function resolveFaxDocumentAvailability(args: {
  oystehr: Oystehr;
  appointmentId: string;
  encounterId: string;
}): Promise<FaxDocumentAvailability[]> {
  const { oystehr, appointmentId, encounterId } = args;
  const documents = await findVisitDocuments(oystehr, appointmentId, encounterId);
  const hasDischargeSummary = documents['discharge-summary'].length > 0;

  return FAX_DOCUMENT_ORDER.map((kind) => {
    if (kind === 'progress-note') {
      return { kind, available: true, count: 1 };
    }

    const count = documents[kind].length;

    if (kind === 'patient-education') {
      // Education PDFs are physically merged into the discharge summary PDF, so offering both would
      // duplicate them. This is the only place that rule is expressed.
      if (count > 0 && hasDischargeSummary) {
        return {
          kind,
          available: false,
          count,
          unavailableReason: FAX_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON,
        };
      }
    }

    return count > 0
      ? { kind, available: true, count }
      : { kind, available: false, count, unavailableReason: FAX_DOCUMENT_UNAVAILABLE_REASONS[kind] };
  });
}

/**
 * Regenerates the visit/progress note PDF for this visit and returns its bytes, without uploading anything or
 * creating/superseding the canonical `75498-6` DocumentReference — the generated note lives only inside the
 * packet. The chart-data assembly is shared with the visit-note subscription (`assembleProgressNoteInput`),
 * so a note faxed before signing matches the one persisted afterwards.
 */
export async function buildProgressNoteBytes(args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  visitResources: FullAppointmentResourcePackage;
}): Promise<Uint8Array> {
  const { oystehr, token, secrets, visitResources } = args;
  const input = await assembleProgressNoteInput(oystehr, token, visitResources);
  return createProgressNotePdfBytes(input, secrets, token);
}

const partsFromDocRefs = (kind: FaxDocumentKind, docRefs: DocumentReference[]): FaxPacketPart[] =>
  docRefs
    .map((docRef) => ({
      kind,
      title: docRef.content?.[0]?.attachment?.title || FAX_DOCUMENT_LABELS[kind],
      documentReferenceId: docRef.id,
      z3Url: docRef.content?.[0]?.attachment?.url,
    }))
    .filter((part) => !!part.z3Url);

/**
 * Resolves the selected document kinds into the ordered list of PDFs that make up the packet body.
 * Sorted by `FAX_DOCUMENT_ORDER`, and newest first within a kind.
 */
export async function collectFaxParts(args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  kinds: FaxDocumentKind[];
  visitResources: FullAppointmentResourcePackage;
}): Promise<FaxPacketPart[]> {
  const { oystehr, token, secrets, kinds, visitResources } = args;
  const appointmentId = visitResources.appointment.id!;
  const encounterId = visitResources.encounter.id!;

  const documents = await findVisitDocuments(oystehr, appointmentId, encounterId);

  const requested = new Set(kinds);

  if (
    requested.has('patient-education') &&
    requested.has('discharge-summary') &&
    documents['discharge-summary'].length > 0
  ) {
    console.log('Skipping patient education parts: already merged into the discharge summary');
    requested.delete('patient-education');
  }

  const parts: FaxPacketPart[] = [];

  for (const kind of FAX_DOCUMENT_ORDER) {
    if (!requested.has(kind)) continue;

    if (kind === 'progress-note') {
      const existing = partsFromDocRefs(kind, documents['progress-note']);
      if (existing.length > 0) {
        parts.push(existing[0]);
      } else {
        console.log(`No visit note DocumentReference for appointment ${appointmentId}; regenerating for the packet`);
        parts.push({
          kind,
          title: FAX_DOCUMENT_LABELS[kind],
          bytes: await buildProgressNoteBytes({ oystehr, token, secrets, visitResources }),
        });
      }
      continue;
    }

    if (kind === 'discharge-summary') {
      // Only the current discharge summary is faxed; older ones are superseded documents.
      parts.push(...partsFromDocRefs(kind, documents[kind]).slice(0, 1));
      continue;
    }

    parts.push(...partsFromDocRefs(kind, documents[kind]));
  }

  return parts;
}
