import { encounterScopedSearch } from '../../chart-data/search-requests';
import { mapChartResources } from '../map';
import { ChartSectionDefinition } from '../types';

/**
 * Everything documented as a single value on this visit: the free-text Conditions, the medical decision,
 * the surgical-history note and the flags kept as Encounter extensions.
 */
export const encounterNotesSection: ChartSectionDefinition<'encounterNotes'> = {
  section: 'encounterNotes',
  requests: (encounterId) => [
    encounterScopedSearch('Condition', encounterId, {
      _tag: 'chief-complaint,history-of-present-illness,mechanism-of-injury,ros,accident',
    }),
    encounterScopedSearch('ClinicalImpression', encounterId, { _tag: 'medical-decision' }),
    encounterScopedSearch('Procedure', encounterId, { _tag: 'surgical-history-note' }),
  ],
  build: async ({ encounter, encounterId }, resources) => {
    const mapped = mapChartResources(encounter, resources, encounterId, {});
    const reasonForVisit = encounter.extension?.find((e) => e.url === 'reason-for-visit')?.valueString;
    return {
      reasonForVisit: { text: reasonForVisit ?? '' },
      chiefComplaint: mapped.chiefComplaint,
      historyOfPresentIllness: mapped.historyOfPresentIllness,
      mechanismOfInjury: mapped.mechanismOfInjury,
      ros: mapped.ros,
      accident: mapped.accident,
      surgicalHistoryNote: mapped.surgicalHistoryNote,
      medicalDecision: mapped.medicalDecision,
      addendumNote: mapped.addendumNote,
      patientInfoConfirmed: mapped.patientInfoConfirmed,
      addToVisitNote: mapped.addToVisitNote,
    };
  },
};
