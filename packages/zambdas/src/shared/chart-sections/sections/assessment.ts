import { enrichCptCodesWithMedicationAdministration } from '../../chart-data/cpt-billing';
import { encounterScopedSearch } from '../../chart-data/search-requests';
import { mapChartResources } from '../map';
import { ChartSectionDefinition } from '../types';

/** Diagnoses, billing codes and procedures of this visit. */
export const assessmentSection: ChartSectionDefinition<'assessment'> = {
  section: 'assessment',
  requests: (encounterId) => [
    // Encounter.diagnosis points at these; they are the only Conditions save-chart-data tags `diagnosis`.
    encounterScopedSearch('Condition', encounterId, { _tag: 'diagnosis' }),
    encounterScopedSearch('Procedure', encounterId, { _tag: 'cpt-code,em-code' }),
    encounterScopedSearch('ServiceRequest', encounterId, { _tag: 'procedure', status: 'completed' }),
  ],
  build: async ({ encounter, encounterId, oystehr }, resources) => {
    const mapped = mapChartResources(encounter, resources, encounterId, { diagnosis: [], cptCodes: [] });
    const cptCodes = await enrichCptCodesWithMedicationAdministration(mapped.cptCodes ?? [], resources, oystehr);
    return {
      diagnosis: mapped.diagnosis ?? [],
      cptCodes,
      emCode: mapped.emCode,
      procedures: mapped.procedures ?? [],
    };
  },
};
