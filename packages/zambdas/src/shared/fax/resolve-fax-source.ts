import Oystehr from '@oystehr/sdk';
import { List, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { Secrets } from 'utils/lib/secrets';
import { FAX_DOCUMENT_ORDER, FaxPacketSource } from 'utils/lib/types/api/fax.types';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { mapWithConcurrency } from '../concurrency';
import { FaxCoverSheetSubject } from '../pdf/types';
import { getAppointmentAndRelatedResources } from '../pdf/visit-details-pdf/get-video-resources';
import { buildFaxPacketSection, createFaxPacketByteBudget, FaxPacketSection } from './build-fax-packet';
import { collectDocumentParts, collectMedicalRecordParts } from './collect-patient-documents';
import { collectFaxParts } from './collect-visit-documents';
import { resolvePatientDisplayId, resolveVisitTypeLabel } from './run-fax-packet';

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
        collect: () => collectMedicalRecordParts(oystehr, source.patientId),
      });
    case 'document':
      return resolvePatientDocuments({
        oystehr,
        token,
        sourceType: source.type,
        patientId: source.patientId,
        collect: () => collectDocumentParts(oystehr, source.patientId, source.documentReferenceId),
      });
  }
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
    listResources: singleVisit?.listResources ?? [],
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

/** The patient's document folders, so a packet lands in the Docs UI like any other document. */
const getPatientFolders = async (oystehr: Oystehr, patientId: string): Promise<List[]> =>
  (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'code', value: PATIENT_FOLDERS_CODE },
      ],
    })
  ).unbundle();
