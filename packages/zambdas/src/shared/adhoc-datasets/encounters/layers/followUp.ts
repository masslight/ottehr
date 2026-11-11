import {
  formatFhirEncounterToPatientFollowupDetails,
  getAnnotationFollowupStatusLabel,
  isAnnotationFollowupEncounter,
} from 'utils/lib/fhir/encounter';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { defineEncounterLayer } from '../context';

// Follow-up notes: the note itself on a follow-up row, the count of notes on a visit row.
export const followUpLayer = defineEncounterLayer<{ followUpNoteCountByParentId: Map<string, number> }>({
  id: 'followUp',
  fetch: async (ctx) => {
    // Follow-up notes (annotation follow-ups) per visit they were added to.
    const followUpNoteCountByParentId = new Map<string, number>();
    for (const e of ctx.root.encounterById.values()) {
      const parentId = e.partOf?.reference?.replace('Encounter/', '');

      if (parentId && isAnnotationFollowupEncounter(e)) {
        followUpNoteCountByParentId.set(parentId, (followUpNoteCountByParentId.get(parentId) ?? 0) + 1);
      }
    }
    return { followUpNoteCountByParentId };
  },
  map: (input, out) => {
    const { encounter, patient, isFollowUpRow } = input;
    const { followUpNoteCountByParentId } = out;
    const row: Partial<AdHocEncounterRow> = {};
    if (isFollowUpRow) {
      // The follow-up note as the follow-up page reads it.
      const details = formatFhirEncounterToPatientFollowupDetails(encounter, patient?.id ?? '');
      const status = getAnnotationFollowupStatusLabel(encounter.status);
      row.followUpNoteCount = 0;
      row.followUpReason = details.reason ?? '';
      row.followUpReasonOther = details.otherReason ?? '';
      row.followUpCaller = details.caller ?? '';
      row.followUpAnswered = details.answered ?? '';
      row.followUpProvider = details.provider?.name ?? '';
      row.followUpMessage = details.message ?? '';
      row.followUpStatus = status;
      row.followUpResolvedAt = status === 'RESOLVED' ? encounter.period?.end ?? null : null;
    } else {
      row.followUpNoteCount = encounter.id ? followUpNoteCountByParentId.get(encounter.id) ?? 0 : 0;
      row.followUpReason = '';
      row.followUpReasonOther = '';
      row.followUpCaller = '';
      row.followUpAnswered = '';
      row.followUpProvider = '';
      row.followUpMessage = '';
      row.followUpStatus = null;
      row.followUpResolvedAt = null;
    }
    return row;
  },
});
