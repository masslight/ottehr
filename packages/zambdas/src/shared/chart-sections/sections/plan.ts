import { Patient, Practitioner, QuestionnaireResponse } from 'fhir/r4b';
import { ERX_MEDICATION_META_TAG_CODE } from 'utils/lib/fhir/constants';
import { SCHOOL_WORK_NOTE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { makePreferredPharmacies } from '../../chart-data/preferred-pharmacies';
import { encounterScopedSearch, encounterSubjectScopedSearchUrl } from '../../chart-data/search-requests';
import { mapChartResources } from '../map';
import { ChartSectionDefinition } from '../types';

/** Disposition, patient instructions, school/work excuses and prescriptions of this visit. */
export const planSection: ChartSectionDefinition<'plan'> = {
  section: 'plan',
  requests: (encounterId) => [
    encounterScopedSearch('ServiceRequest', encounterId, { _tag: 'disposition-follow-up,sub-follow-up' }),
    encounterScopedSearch('Communication', encounterId, { _tag: 'patient-instruction', _sort: '-sent' }),
    encounterScopedSearch('DocumentReference', encounterId, { _tag: SCHOOL_WORK_NOTE }),
    encounterScopedSearch('MedicationRequest', encounterId, {
      _tag: ERX_MEDICATION_META_TAG_CODE,
      _include: 'MedicationRequest:requester',
    }),
    // The intake paperwork names the preferred pharmacy; the Patient contains the pharmacy Organizations.
    encounterScopedSearch('QuestionnaireResponse', encounterId),
    { method: 'GET', url: encounterSubjectScopedSearchUrl('Patient', null, encounterId) },
  ],
  build: async ({ encounter, encounterId }, resources) => {
    const mapped = mapChartResources(encounter, resources, encounterId, {
      instructions: [],
      schoolWorkNotes: [],
      prescribedMedications: [],
    });
    const patient = resources.find((r): r is Patient => r.resourceType === 'Patient');
    const questionnaireResponse = resources.find(
      (r): r is QuestionnaireResponse => r.resourceType === 'QuestionnaireResponse'
    );
    return {
      disposition: mapped.disposition,
      instructions: mapped.instructions ?? [],
      schoolWorkNotes: mapped.schoolWorkNotes ?? [],
      prescribedMedications: mapped.prescribedMedications ?? [],
      preferredPharmacies: makePreferredPharmacies(patient, questionnaireResponse),
      practitioners: resources.filter((r): r is Practitioner => r.resourceType === 'Practitioner'),
    };
  },
};
