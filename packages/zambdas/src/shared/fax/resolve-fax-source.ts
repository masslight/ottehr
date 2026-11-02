import Oystehr from '@oystehr/sdk';
import { Encounter, List, Location, Patient, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getReferralDetails, getReferralStatus } from 'utils/lib/fhir/referral';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import {
  FAX_DOCUMENT_ORDER,
  FAX_PACKET_DOCUMENT_LABELS,
  FaxPacketSource,
  REFERRAL_FORM_FAX_DOCUMENT_KIND,
} from 'utils/lib/types/api/fax.types';
import { REFERRAL_STATUS_LABELS, ReferralStatus } from 'utils/lib/types/api/referrals/referrals.types';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { mapWithConcurrency } from '../concurrency';
import { FaxCoverSheetSubject } from '../pdf/types';
import { getAppointmentAndRelatedResources } from '../pdf/visit-details-pdf/get-video-resources';
import { loadReferral } from '../referrals/load-referral';
import { getOrCreateReferralForm } from '../referrals/referral-form';
import { buildFaxPacketSection, createFaxPacketByteBudget, FaxPacketSection } from './build-fax-packet';
import { collectDocumentParts, collectMedicalRecordParts } from './collect-patient-documents';
import { collectFaxParts, FaxPacketPart } from './collect-visit-documents';
import { resolvePatientDisplayId, resolveVisitTypeLabel } from './run-fax-packet';

/** A referral can be faxed until it is answered or finished; re-sending a sent one is allowed. */
const FAXABLE_REFERRAL_STATUSES: ReferralStatus[] = ['not-sent', 'sent', 'given-to-patient'];

/**
 * How many visits are looked up at once. Each lookup is a wide `_include` search, so the fan-out is
 * kept well below the ten visits a packet may carry.
 */
const VISIT_LOOKUP_CONCURRENCY = 3;

/** Everything a packet needs that depends on what is being faxed rather than on who receives it. */
export interface FaxPacketPlan {
  sourceType: FaxPacketSource['type'];
  patient: Patient;
  sections: FaxPacketSection[];
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
}

/**
 * Turns a requested source into the sections that make up the packet. Each visit becomes its own
 * section, so a multi-visit send introduces every visit with its own cover sheet.
 */
export const resolveFaxPacketPlan = async (args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  source: FaxPacketSource;
}): Promise<FaxPacketPlan> => {
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
      return resolvePatientDocuments({
        oystehr,
        token,
        sourceType: source.type,
        patientId: source.patientId,
        collect: () => collectDocumentParts(oystehr, source.patientId, source.documentReferenceId),
      });
    case 'referral':
      return resolveReferral({ oystehr, token, secrets, referralId: source.referralId });
  }
};

/** A referral as the fax pipeline needs it: the ServiceRequest, its patient and its visit (when it has one). */
export interface ReferralFaxContext {
  serviceRequest: ServiceRequest;
  patientId: string;
  encounterId?: string;
  appointmentId?: string;
}

/**
 * Loads a referral for faxing and checks it is one: tagged `referral`, in a status that can still be sent,
 * and (when it names a visit) a visit of its own patient. Every referral fax entry point goes through this.
 */
export const resolveReferralFaxContext = async (oystehr: Oystehr, referralId: string): Promise<ReferralFaxContext> => {
  const serviceRequest = await loadReferral(oystehr, referralId);
  const status = getReferralStatus(serviceRequest);
  if (!FAXABLE_REFERRAL_STATUSES.includes(status)) {
    throw INVALID_INPUT_ERROR(`A referral that is ${REFERRAL_STATUS_LABELS[status]} cannot be faxed`);
  }
  const patientId = removePrefix('Patient/', serviceRequest.subject?.reference ?? '');
  if (!patientId) throw INVALID_INPUT_ERROR(`Referral ${referralId} names no patient`);

  const encounterId = removePrefix('Encounter/', serviceRequest.encounter?.reference ?? '') || undefined;
  if (!encounterId) return { serviceRequest, patientId };

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  if (encounter.subject?.reference !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR(`Referral ${referralId} names a visit of another patient`);
  }
  const appointmentId = removePrefix('Appointment/', encounter.appointment?.[0]?.reference ?? '') || undefined;
  return { serviceRequest, patientId, encounterId, appointmentId };
};

/**
 * The referral form first, then whichever of the referral's chosen visit documents exist. One section:
 * the existing cover sheet stays page 1 and the form is the first document after it.
 */
const resolveReferral = async (args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  referralId: string;
}): Promise<FaxPacketPlan> => {
  const { oystehr, token, secrets, referralId } = args;
  const sourceType = 'referral';

  const { serviceRequest, patientId, appointmentId } = await resolveReferralFaxContext(oystehr, referralId);
  const basedOnReference = `ServiceRequest/${referralId}`;
  const formPart = await resolveReferralFormPart(serviceRequest, { oystehr, secrets, token });
  const budget = createFaxPacketByteBudget(sourceType);

  if (appointmentId) {
    const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
    if (!visitResources?.appointment?.id || !visitResources.patient?.id) {
      throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Visit resources could not be resolved for appointment ${appointmentId}`);
    }
    if (visitResources.patient.id !== patientId) {
      throw INVALID_INPUT_ERROR(`Visit ${appointmentId} does not belong to this patient`);
    }
    const kinds = getReferralDetails(serviceRequest)?.includeDocuments ?? [];
    const parts = [formPart, ...(await collectFaxParts({ oystehr, token, secrets, kinds, visitResources }))];
    return {
      sourceType,
      patient: visitResources.patient,
      sections: [await buildFaxPacketSection({ token, subject: buildVisitSubject(visitResources), parts, budget })],
      appointmentId: visitResources.appointment.id,
      encounterId: visitResources.encounter?.id,
      location: visitResources.location,
      timezone: visitResources.timezone,
      listResources: visitResources.listResources,
      basedOnReference,
    };
  }

  const [patient, listResources] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    getPatientFolders(oystehr, patientId),
  ]);
  const subject: FaxCoverSheetSubject = {
    patientName: getFullestAvailableName(patient, true) ?? '',
    patientId: resolvePatientDisplayId(patient),
    visitTypeLabel: 'Referral',
  };
  return {
    sourceType,
    patient,
    sections: [await buildFaxPacketSection({ token, subject, parts: [formPart], budget })],
    listResources,
    basedOnReference,
  };
};

/** The referral's form as it stands now: the one on file, or a fresh render when the referral changed since. */
const resolveReferralFormPart = async (
  serviceRequest: ServiceRequest,
  args: { oystehr: Oystehr; secrets: Secrets | null; token: string }
): Promise<FaxPacketPart> => {
  const { documentReference, z3Url } = await getOrCreateReferralForm(serviceRequest, args);
  if (!documentReference.id) throw new Error(`Referral ${serviceRequest.id} form DocumentReference has no id`);
  return {
    kind: REFERRAL_FORM_FAX_DOCUMENT_KIND,
    title: FAX_PACKET_DOCUMENT_LABELS[REFERRAL_FORM_FAX_DOCUMENT_KIND],
    documentReferenceId: documentReference.id,
    z3Url,
    contentType: documentReference.content?.[0]?.attachment?.contentType,
  };
};

const resolveVisits = async (args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  sourceType: Extract<FaxPacketSource['type'], 'visit' | 'visits'>;
  appointmentIds: string[];
  expectedPatientId?: string;
}): Promise<FaxPacketPlan> => {
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
  const budget = createFaxPacketByteBudget(sourceType);
  const sections: FaxPacketSection[] = [];
  for (const visitResources of visits) {
    const parts = await collectFaxParts({ oystehr, token, secrets, kinds: FAX_DOCUMENT_ORDER, visitResources });
    // A visit with nothing to send is skipped rather than introduced by an empty cover sheet.
    if (parts.length === 0) continue;
    sections.push(await buildFaxPacketSection({ token, subject: buildVisitSubject(visitResources), parts, budget }));
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
  sourceType: Extract<FaxPacketSource['type'], 'medical-record' | 'document'>;
  patientId: string;
  visitTypeLabel?: string;
  collect: () => Promise<Awaited<ReturnType<typeof collectMedicalRecordParts>>>;
}): Promise<FaxPacketPlan> => {
  const { oystehr, token, sourceType, patientId, visitTypeLabel, collect } = args;

  const [patient, parts, listResources] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    collect(),
    getPatientFolders(oystehr, patientId),
  ]);

  const subject: FaxCoverSheetSubject = {
    patientName: getFullestAvailableName(patient, true) ?? '',
    patientId: resolvePatientDisplayId(patient),
    visitTypeLabel,
  };

  return {
    sourceType,
    patient,
    sections: parts.length
      ? [await buildFaxPacketSection({ token, subject, parts, budget: createFaxPacketByteBudget(sourceType) })]
      : [],
    listResources,
  };
};

const buildVisitSubject = (visitResources: {
  appointment: { id?: string; start?: string };
  encounter?: unknown;
  patient?: Patient;
  timezone?: string;
}): FaxCoverSheetSubject => {
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

/** The patient's document folders, so a packet (or a referral form) lands in the Docs UI like any other document. */
export const getPatientFolders = async (oystehr: Oystehr, patientId: string): Promise<List[]> =>
  (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'code', value: PATIENT_FOLDERS_CODE },
      ],
    })
  ).unbundle();
