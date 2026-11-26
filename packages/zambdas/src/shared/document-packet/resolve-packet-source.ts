import Oystehr from '@oystehr/sdk';
import { DocumentReference, Encounter, List, Location, Patient, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getReferralDetails, getReferralEarlierDocumentIds, getReferralStatus } from 'utils/lib/fhir/referral';
import { Secrets } from 'utils/lib/secrets';
import {
  DOCUMENT_PACKET_DOCUMENT_LABELS,
  DocumentPacketSource,
  PACKET_DOCUMENT_ORDER,
  REFERRAL_FORM_PACKET_DOCUMENT_KIND,
} from 'utils/lib/types/api/document-packet.types';
import { isReferralEditable, REFERRAL_STATUS_LABELS } from 'utils/lib/types/api/referrals/referrals.types';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { mapWithConcurrency } from '../concurrency';
import { getPatientFolders } from '../patient-folders';
import { PacketCoverSheetSubject } from '../pdf/types';
import { getAppointmentAndRelatedResources } from '../pdf/visit-details-pdf/get-video-resources';
import { FullAppointmentResourcePackage } from '../pdf/visit-details-pdf/types';
import { loadReferral } from '../referrals/load-referral';
import { getOrCreateReferralForm } from '../referrals/referral-form';
import {
  buildDocumentPacketSection,
  createDocumentPacketByteBudget,
  DocumentPacketSection,
} from './build-document-packet';
import {
  collectDocumentParts,
  collectMedicalRecordParts,
  collectReferralDocumentParts,
  getPacketSourceDocument,
} from './collect-patient-documents';
import { collectVisitPacketParts, DocumentPacketPart } from './collect-visit-documents';
import { resolvePatientDisplayId, resolveVisitTypeLabel } from './deliver-document-packet';

/**
 * How many visits are looked up at once. Each lookup is a wide `_include` search, so the fan-out is
 * kept well below the ten visits a packet may carry.
 */
const VISIT_LOOKUP_CONCURRENCY = 3;

/** Everything a packet needs that depends on what is being faxed rather than on who receives it. */
export interface DocumentPacketPlan {
  sourceType: DocumentPacketSource['type'];
  patient: Patient;
  sections: DocumentPacketSection[];
  /** Set only when the packet is about exactly one visit, so it can be filed against that visit. */
  appointmentId?: string;
  encounterId?: string;
  /** The office of a single-visit packet; its address heads the cover sheet's From block. */
  location?: Location;
  /** The office's timezone for a single-visit packet; patient-level packets fall back to the practice. */
  timezone?: string;
  listResources: List[];
  /** `ServiceRequest/<id>` for a referral packet, recorded on each delivery attempt as `Task.basedOn`. */
  basedOnReference?: string;
  basedOnVersionId?: string;
}

/**
 * Turns a requested source into the sections that make up the packet. Each visit becomes its own
 * section, so a multi-visit send introduces every visit with its own cover sheet.
 */
export const resolveDocumentPacketPlan = async (args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  source: DocumentPacketSource;
}): Promise<DocumentPacketPlan> => {
  const { oystehr, token, secrets, source } = args;

  switch (source.type) {
    case 'visit':
      return resolveVisits({
        oystehr,
        token,
        secrets,
        sourceType: source.type,
        appointmentIds: [source.appointmentId],
      });
    case 'visits':
      return resolveVisits({
        oystehr,
        token,
        secrets,
        sourceType: source.type,
        appointmentIds: source.appointmentIds,
        expectedPatientId: source.patientId,
      });
    case 'medical-record':
      return resolvePatientDocuments({
        oystehr,
        token,
        sourceType: source.type,
        patientId: source.patientId,
        visitTypeLabel: 'Medical Record',
        collect: () => collectMedicalRecordParts(oystehr, source.patientId, source.dateRange),
      });
    case 'document':
      return resolveDocument({
        oystehr,
        token,
        patientId: source.patientId,
        documentReferenceId: source.documentReferenceId,
      });
    case 'referral':
      return resolveReferral({ oystehr, token, secrets, referralId: source.referralId });
  }
};

export interface ReferralFaxContext {
  serviceRequest: ServiceRequest;
  patientId: string;
  encounterId?: string;
  appointmentId?: string;
}

export const assertReferralFaxable = (serviceRequest: ServiceRequest): void => {
  const status = getReferralStatus(serviceRequest);
  if (!isReferralEditable(status)) {
    throw INVALID_INPUT_ERROR(`A referral that is ${REFERRAL_STATUS_LABELS[status]} cannot be faxed`);
  }
};

export const resolveReferralFaxContext = async (oystehr: Oystehr, referralId: string): Promise<ReferralFaxContext> => {
  const serviceRequest = await loadReferral(oystehr, referralId);
  assertReferralFaxable(serviceRequest);
  const patientId = getIdFromReference(serviceRequest.subject?.reference, 'Patient');
  if (!patientId) throw INVALID_INPUT_ERROR(`Referral ${referralId} names no patient`);

  const encounterId = getIdFromReference(serviceRequest.encounter?.reference, 'Encounter');
  if (!encounterId) return { serviceRequest, patientId };

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  if (encounter.subject?.reference !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR(`Referral ${referralId} names a visit of another patient`);
  }
  const appointmentId = getIdFromReference(encounter.appointment?.[0]?.reference, 'Appointment');
  return { serviceRequest, patientId, encounterId, appointmentId };
};

const resolveReferral = async (args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  referralId: string;
}): Promise<DocumentPacketPlan> => {
  const { oystehr, token, secrets, referralId } = args;
  const sourceType = 'referral';

  const { serviceRequest, patientId, appointmentId } = await resolveReferralFaxContext(oystehr, referralId);
  const basedOnReference = `ServiceRequest/${referralId}`;
  const basedOnVersionId = serviceRequest.meta?.versionId;
  const [formPart, earlierParts] = await Promise.all([
    resolveReferralFormPart(serviceRequest, { oystehr, secrets, token }),
    collectReferralDocumentParts(oystehr, patientId, getReferralEarlierDocumentIds(serviceRequest), secrets),
  ]);
  const budget = createDocumentPacketByteBudget(sourceType);

  if (appointmentId) {
    const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
    if (!visitResources?.appointment?.id || !visitResources.patient?.id) {
      throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Visit resources could not be resolved for appointment ${appointmentId}`);
    }
    if (visitResources.patient.id !== patientId) {
      throw INVALID_INPUT_ERROR(`Visit ${appointmentId} does not belong to this patient`);
    }
    const kinds = getReferralDetails(serviceRequest)?.includeDocuments ?? [];
    const parts = [
      formPart,
      ...(await collectVisitPacketParts({ oystehr, token, secrets, kinds, visitResources })),
      ...earlierParts,
    ];
    return {
      sourceType,
      patient: visitResources.patient,
      sections: [
        await buildDocumentPacketSection({ token, subject: buildVisitSubject(visitResources), parts, budget }),
      ],
      appointmentId: visitResources.appointment.id,
      encounterId: visitResources.encounter?.id,
      location: visitResources.location,
      timezone: visitResources.timezone,
      listResources: visitResources.listResources,
      basedOnReference,
      basedOnVersionId,
    };
  }

  const [patient, listResources] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    getPatientFolders(oystehr, patientId),
  ]);
  const subject: PacketCoverSheetSubject = {
    patientName: getFullestAvailableName(patient, true) ?? '',
    patientId: resolvePatientDisplayId(patient),
    visitTypeLabel: 'Referral',
  };
  return {
    sourceType,
    patient,
    sections: [await buildDocumentPacketSection({ token, subject, parts: [formPart, ...earlierParts], budget })],
    listResources,
    basedOnReference,
    basedOnVersionId,
  };
};

const resolveReferralFormPart = async (
  serviceRequest: ServiceRequest,
  args: { oystehr: Oystehr; secrets: Secrets | null; token: string }
): Promise<DocumentPacketPart> => {
  const { documentReference, z3Url } = await getOrCreateReferralForm(serviceRequest, args);
  if (!documentReference.id) throw new Error(`Referral ${serviceRequest.id} form DocumentReference has no id`);
  return {
    kind: REFERRAL_FORM_PACKET_DOCUMENT_KIND,
    title: DOCUMENT_PACKET_DOCUMENT_LABELS[REFERRAL_FORM_PACKET_DOCUMENT_KIND],
    documentReferenceId: documentReference.id,
    z3Url,
    contentType: documentReference.content?.[0]?.attachment?.contentType,
  };
};

const resolveVisits = async (args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  sourceType: Extract<DocumentPacketSource['type'], 'visit' | 'visits'>;
  appointmentIds: string[];
  expectedPatientId?: string;
}): Promise<DocumentPacketPlan> => {
  const { oystehr, token, secrets, sourceType, appointmentIds, expectedPatientId } = args;

  const visits = await mapWithConcurrency(appointmentIds, VISIT_LOOKUP_CONCURRENCY, async (appointmentId) => {
    const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
    if (!visitResources?.appointment?.id || !visitResources.patient?.id) {
      throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Visit resources could not be resolved for appointment ${appointmentId}`);
    }
    // The caller names the patient whose record is being faxed; a visit belonging to anyone else
    // is not theirs to send.
    if (expectedPatientId && visitResources.patient.id !== expectedPatientId) {
      throw INVALID_INPUT_ERROR(`Visit ${appointmentId} does not belong to this patient`);
    }
    return visitResources;
  });

  // Sections are built one at a time, and each one downloads its documents with its own bounded pool.
  // The size limit belongs to the packet, so every section draws down the same budget and an
  // oversized selection stops at the visit that crosses it.
  const budget = createDocumentPacketByteBudget(sourceType);
  const sections: DocumentPacketSection[] = [];
  for (const visitResources of visits) {
    const parts = await collectVisitPacketParts({
      oystehr,
      token,
      secrets,
      kinds: PACKET_DOCUMENT_ORDER,
      visitResources,
    });
    // A visit with nothing to send is skipped rather than introduced by an empty cover sheet.
    if (parts.length === 0) continue;
    sections.push(
      await buildDocumentPacketSection({ token, subject: buildVisitSubject(visitResources), parts, budget })
    );
  }

  const first = visits[0];
  const singleVisit = visits.length === 1 ? first : undefined;
  return {
    sourceType,
    patient: first.patient!,
    sections,
    appointmentId: singleVisit?.appointment.id,
    encounterId: singleVisit?.encounter?.id,
    location: singleVisit?.location,
    timezone: singleVisit?.timezone,
    // A packet spanning visits is filed against the patient, so it needs the patient's own folders.
    // An empty array would not skip filing — `createFilesDocumentReferences` treats it as "no folder
    // exists yet" and creates a duplicate of the folder the patient already has.
    listResources: singleVisit?.listResources ?? (await getPatientFolders(oystehr, first.patient!.id!)),
  };
};

const resolvePatientDocuments = async (args: {
  oystehr: Oystehr;
  token: string;
  sourceType: Extract<DocumentPacketSource['type'], 'medical-record' | 'document'>;
  patientId: string;
  visitTypeLabel?: string;
  collect: () => Promise<Awaited<ReturnType<typeof collectMedicalRecordParts>>>;
}): Promise<DocumentPacketPlan> => {
  const { oystehr, token, sourceType, patientId, visitTypeLabel, collect } = args;

  const [patient, parts, listResources] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    collect(),
    getPatientFolders(oystehr, patientId),
  ]);

  const subject: PacketCoverSheetSubject = {
    patientName: getFullestAvailableName(patient, true) ?? '',
    patientId: resolvePatientDisplayId(patient),
    visitTypeLabel,
  };

  return {
    sourceType,
    patient,
    sections: parts.length
      ? [
          await buildDocumentPacketSection({
            token,
            subject,
            parts,
            budget: createDocumentPacketByteBudget(sourceType),
          }),
        ]
      : [],
    listResources,
  };
};

/** A document filed on a visit is filed with that visit, and its office is who the recipient contacts. */
const resolveDocument = async (args: {
  oystehr: Oystehr;
  token: string;
  patientId: string;
  documentReferenceId: string;
}): Promise<DocumentPacketPlan> => {
  const { oystehr, token, patientId, documentReferenceId } = args;

  const document = await getPacketSourceDocument(oystehr, patientId, documentReferenceId);
  const [plan, visit] = await Promise.all([
    resolvePatientDocuments({
      oystehr,
      token,
      sourceType: 'document',
      patientId,
      collect: async () => collectDocumentParts(document),
    }),
    getDocumentVisit(oystehr, document),
  ]);
  if (!visit || visit.patient?.id !== patientId) return plan;

  return {
    ...plan,
    appointmentId: visit.appointment.id,
    encounterId: getDocumentEncounterId(document) ?? visit.encounter.id,
    location: visit.location,
    timezone: visit.timezone,
  };
};

const getDocumentEncounterId = (document: DocumentReference): string | undefined =>
  getIdFromReference(document.context?.encounter?.[0]?.reference, 'Encounter');

/** EHR uploads name only the encounter; intake documents name only the Appointment, in `context.related`. */
const getDocumentVisit = async (
  oystehr: Oystehr,
  document: DocumentReference
): Promise<FullAppointmentResourcePackage | undefined> => {
  const encounterId = getDocumentEncounterId(document);
  const appointmentId =
    document.context?.related?.map((related) => getIdFromReference(related.reference, 'Appointment')).find(Boolean) ??
    (encounterId ? await getEncounterAppointmentId(oystehr, encounterId) : undefined);
  return appointmentId ? getAppointmentAndRelatedResources(oystehr, appointmentId, true) : undefined;
};

const getEncounterAppointmentId = async (oystehr: Oystehr, encounterId: string): Promise<string | undefined> => {
  const [encounter] = (
    await oystehr.fhir.search<Encounter>({ resourceType: 'Encounter', params: [{ name: '_id', value: encounterId }] })
  ).unbundle();
  return getIdFromReference(encounter?.appointment?.[0]?.reference, 'Appointment');
};

const buildVisitSubject = (visitResources: {
  appointment: { id?: string; start?: string };
  encounter?: unknown;
  patient?: Patient;
  timezone?: string;
}): PacketCoverSheetSubject => {
  const { appointment, patient, timezone } = visitResources;
  return {
    patientName: patient ? getFullestAvailableName(patient, true) ?? '' : '',
    patientId: patient ? resolvePatientDisplayId(patient) : '',
    visitId: appointment.id ?? '',
    dateOfService: appointment.start
      ? DateTime.fromISO(appointment.start)
          .setZone(timezone || undefined)
          .toFormat('MM/dd/yyyy')
      : '',
    visitTypeLabel: resolveVisitTypeLabel(visitResources as Parameters<typeof resolveVisitTypeLabel>[0]),
  };
};
