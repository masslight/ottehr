import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getPatientFriendlyId } from 'utils/lib/fhir/patient';
import { SendFaxTarget } from 'utils/lib/types/api/send-fax.types';
import { VISIT_NOTE_SUMMARY_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { resolveTimezone } from '../helpers';
import { collectPatientRecordAttachments, getAllPatientDocumentReferences } from '../patient-documents';
import { getPatientLastFirstName } from '../patients';
import { FaxAttachment } from './fax-packet';

/** One fax to send: a cover sheet plus the documents it introduces. */
export interface FaxTransmission {
  patientId: string;
  /** Carried so the sender can fall back to the patient's own PCP for an unnamed recipient. */
  patient: Patient;
  /** Set when the fax covers exactly one visit, so the attempt shows up under that visit. */
  appointmentId?: string;
  /** Set when the fax carries exactly one document. */
  documentReferenceId?: string;
  cover: { title: string; identifiers: string[] };
  attachments: FaxAttachment[];
  /**
   * The office's timezone, for faxes about a single visit. Absent for patient-wide faxes, which
   * fall back to the sending organization's timezone.
   */
  timezone?: string;
}

/**
 * Expands a fax target into the transmissions it stands for. Selecting several visits fans out into
 * one fax per visit, so each gets its own cover sheet and its own retryable delivery attempt.
 */
export const resolveFaxTransmissions = async (target: SendFaxTarget, oystehr: Oystehr): Promise<FaxTransmission[]> => {
  switch (target.type) {
    case 'visit-note':
      return [await resolveVisit(target.appointmentId, oystehr, { visitNoteOnly: true })];
    case 'visit-documents':
      return Promise.all(
        target.appointmentIds.map((id) =>
          resolveVisit(id, oystehr, { visitNoteOnly: false, expectedPatientId: target.patientId })
        )
      );
    case 'medical-record':
      return [await resolveMedicalRecord(target.patientId, oystehr)];
    case 'document':
      return [await resolveDocument(target.patientId, target.documentReferenceId, oystehr)];
  }
};

const resolveVisit = async (
  appointmentId: string,
  oystehr: Oystehr,
  options: { visitNoteOnly: boolean; expectedPatientId?: string }
): Promise<FaxTransmission> => {
  const resources = (
    await oystehr.fhir.search<Appointment | Encounter | Patient | Location | DocumentReference>({
      resourceType: 'Encounter',
      params: [
        { name: 'appointment', value: `Appointment/${appointmentId}` },
        { name: '_include', value: 'Encounter:appointment' },
        { name: '_include', value: 'Encounter:subject' },
        { name: '_include:iterate', value: 'Encounter:location' },
        // Documents attach to a visit either through the encounter or through the appointment,
        // depending on which flow created them, so both links are collected.
        { name: '_revinclude', value: 'DocumentReference:encounter' },
        { name: '_revinclude:iterate', value: 'DocumentReference:related' },
      ],
    })
  ).unbundle();

  const appointment = resources.find(
    (resource): resource is Appointment => resource.resourceType === 'Appointment' && resource.id === appointmentId
  );
  const patient = resources.find((resource): resource is Patient => resource.resourceType === 'Patient');
  if (!appointment || !patient?.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Visit ${appointmentId} or its patient was not found`);
  }
  // The caller names the patient whose record is being faxed; a visit belonging to anyone else is
  // not theirs to send.
  if (options.expectedPatientId && options.expectedPatientId !== patient.id) {
    throw INVALID_INPUT_ERROR(`Visit ${appointmentId} does not belong to this patient`);
  }

  // A document linked both to the encounter and to the appointment comes back once per link.
  const documents = [
    ...new Map(
      resources
        .filter((resource): resource is DocumentReference => resource.resourceType === 'DocumentReference')
        .map((document) => [document.id, document])
    ).values(),
  ];
  // The visit-note fax sends the note alone; everything else sends the visit's whole chart, in the
  // order it was produced.
  const faxable = options.visitNoteOnly ? latestVisitNote(documents) : sortByDate(documents.filter(isCurrent));

  const timezone = resolveTimezone(
    undefined,
    resources.find((resource): resource is Location => resource.resourceType === 'Location')
  );
  const serviceCategory = getCoding(appointment.serviceCategory, SERVICE_CATEGORY_SYSTEM);
  const visitLabel = serviceCategory?.display ?? serviceCategory?.code;
  const dateOfService = appointment.start
    ? DateTime.fromISO(appointment.start).setZone(timezone).toFormat('MM/dd/yyyy')
    : undefined;

  return {
    patientId: patient.id,
    patient,
    appointmentId,
    documentReferenceId: options.visitNoteOnly ? faxable[0]?.id : undefined,
    cover: {
      title: `${visitLabel ? `${visitLabel} ` : ''}Visit of ${patientDisplayName(patient)}`,
      identifiers: [
        ...patientIdentifiers(patient),
        `VID: ${appointmentId}`,
        ...(dateOfService ? [`DOS: ${dateOfService}`] : []),
      ],
    },
    attachments: collectPatientRecordAttachments(faxable),
    timezone,
  };
};

const resolveMedicalRecord = async (patientId: string, oystehr: Oystehr): Promise<FaxTransmission> => {
  const [patient, documents] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    getAllPatientDocumentReferences(oystehr, patientId),
  ]);

  return {
    patientId,
    patient,
    cover: {
      title: `Medical Record of ${patientDisplayName(patient)}`,
      identifiers: patientIdentifiers(patient),
    },
    // Same content as the downloadable archive, minus the formats a fax can't render.
    attachments: collectPatientRecordAttachments(sortByDate(documents)),
  };
};

const resolveDocument = async (
  patientId: string,
  documentReferenceId: string,
  oystehr: Oystehr
): Promise<FaxTransmission> => {
  const [patient, document] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    oystehr.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id: documentReferenceId }),
  ]);
  if (document.subject?.reference !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR('The requested document does not belong to this patient');
  }

  return {
    patientId,
    patient,
    documentReferenceId,
    cover: {
      title: patientDisplayName(patient),
      identifiers: patientIdentifiers(patient),
    },
    attachments: collectPatientRecordAttachments([document]),
  };
};

const patientDisplayName = (patient: Patient): string => getPatientLastFirstName(patient) ?? 'Patient';

/** Patients migrated without a friendly id have none to print. */
const patientIdentifiers = (patient: Patient): string[] => {
  const friendlyId = getPatientFriendlyId(patient);
  return friendlyId ? [`PID: ${friendlyId}`] : [];
};

/** The note as it stands today: newest wins if a visit ended up with more than one current note. */
const latestVisitNote = (documents: DocumentReference[]): DocumentReference[] => {
  const notes = sortByDate(
    documents.filter(
      (document) =>
        isCurrent(document) && document.type?.coding?.some((coding) => coding.code === VISIT_NOTE_SUMMARY_CODE)
    )
  );
  return notes.length ? [notes[notes.length - 1]] : [];
};

const isCurrent = (document: DocumentReference): boolean => document.status === 'current';

/** Oldest first, so a faxed packet reads in the order the visit happened. */
const sortByDate = (documents: DocumentReference[]): DocumentReference[] =>
  [...documents].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
