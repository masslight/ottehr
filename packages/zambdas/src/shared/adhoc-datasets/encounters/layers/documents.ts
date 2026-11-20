import { DocumentReference } from 'fhir/r4b';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { PATIENT_PHOTO_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { fetchScopedResources } from '../../../adhoc-report';
import { defineEncounterLayer } from '../context';
import { hasDocRefTypeCode } from '../helpers';

// Work / school notes and condition photos of the visit.
export const documentsLayer = defineEncounterLayer<{
  docRefsByEncounterId: Map<string, DocumentReference[]>;
  conditionPhotoDocRefsByAppointmentId: Map<string, DocumentReference[]>;
}>({
  id: 'documents',
  fetch: async (ctx) => {
    // Patient condition photos hang off the Appointment (upload-patient-condition-photo / the paperwork harvest),
    // not the Encounter: the visit's current photo DocumentReferences, as the chart's photos card lists them.
    const [docRefsByEncounterId, photoDocRefs] = await Promise.all([
      ctx.shared.docRefs(),
      fetchScopedResources<DocumentReference>(
        ctx.oystehr,
        'DocumentReference',
        'related',
        ctx.encRefs.length ? Array.from(ctx.root.appointmentMap.keys()) : [],
        [
          { name: 'status', value: 'current' },
          { name: 'type', value: PATIENT_PHOTO_CODE },
          { name: '_elements', value: 'type,status,context,content' },
        ]
      ),
    ]);

    const conditionPhotoDocRefsByAppointmentId = new Map<string, DocumentReference[]>();

    for (const docRef of photoDocRefs) {
      for (const related of docRef.context?.related ?? []) {
        const appointmentId = related.reference?.startsWith('Appointment/')
          ? related.reference.replace('Appointment/', '')
          : undefined;

        if (appointmentId) {
          conditionPhotoDocRefsByAppointmentId.set(appointmentId, [
            ...(conditionPhotoDocRefsByAppointmentId.get(appointmentId) ?? []),
            docRef,
          ]);
        }
      }
    }

    return { docRefsByEncounterId, conditionPhotoDocRefsByAppointmentId };
  },
  map: (input, out) => {
    const { encounter, appointment } = input;
    const { docRefsByEncounterId, conditionPhotoDocRefsByAppointmentId } = out;
    const row: Partial<AdHocEncounterRow> = {};
    const docs = encounter.id ? docRefsByEncounterId.get(encounter.id) ?? [] : [];
    const workSchoolNotes: string[] = [];

    for (const d of docs) {
      const isSchoolWork =
        d.type?.coding?.some((c) => c.code === '47420-5') ||
        d.meta?.tag?.some((t) => t.system?.includes('school-work-note'));

      if (!isSchoolWork) continue;
      const typeTag = d.meta?.tag?.find((t) => t.system?.includes('school-work-note'))?.code;
      workSchoolNotes.push(typeTag || 'note');
    }

    row.workSchoolNotes = workSchoolNotes;
    row.workSchoolNoteCount = workSchoolNotes.length;

    // As the chart's photos card counts them: one per attachment of the visit's current photo documents.
    row.patientConditionPhotoCount = (
      appointment.id ? conditionPhotoDocRefsByAppointmentId.get(appointment.id) ?? [] : []
    )
      .filter((docRef) => hasDocRefTypeCode(docRef, PATIENT_PHOTO_CODE))
      .reduce((count, docRef) => count + (docRef.content ?? []).filter((c) => c.attachment?.url).length, 0);
    return row;
  },
});
