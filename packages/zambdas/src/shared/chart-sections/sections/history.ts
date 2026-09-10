import { Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { ChartSearchParams, patientScopedSearch } from '../../chart-data/search-requests';
import { mapChartResources } from '../map';
import { ChartSectionDefinition } from '../types';

/** Patient-level history: shared across the patient's encounters, so every search is patient-scoped. */
export const historySection: ChartSectionDefinition<'history'> = {
  section: 'history',
  requests: (encounterId, params) => {
    const medicationParams: ChartSearchParams = {
      _include: 'MedicationStatement:source',
      _sort: '-effective',
      ...(params?.medicationCount ? { _count: params.medicationCount } : {}),
    };
    return [
      patientScopedSearch('AllergyIntolerance', encounterId, { _tag: 'known-allergy' }),
      patientScopedSearch('Condition', encounterId, { _tag: 'medical-condition' }),
      patientScopedSearch('MedicationStatement', encounterId, {
        _tag: 'current-medication,prescribed-medication',
        ...medicationParams,
      }),
      patientScopedSearch('MedicationStatement', encounterId, { _tag: 'in-house-medication', ...medicationParams }),
      patientScopedSearch('Procedure', encounterId, { _tag: 'surgical-history' }),
      patientScopedSearch('EpisodeOfCare', encounterId, { _tag: 'hospitalization' }),
      patientScopedSearch('Observation', encounterId, { _tag: `${PRIVATE_EXTENSION_BASE_URL}/birth-history|` }),
    ];
  },
  build: async ({ encounter, encounterId }, resources) => {
    const mapped = mapChartResources(encounter, resources, encounterId, {
      allergies: [],
      conditions: [],
      medications: [],
      inhouseMedications: [],
      surgicalHistory: [],
      episodeOfCare: [],
      birthHistory: [],
    });
    return {
      allergies: mapped.allergies ?? [],
      conditions: mapped.conditions ?? [],
      medications: mapped.medications ?? [],
      inhouseMedications: mapped.inhouseMedications ?? [],
      surgicalHistory: mapped.surgicalHistory ?? [],
      episodeOfCare: mapped.episodeOfCare ?? [],
      birthHistory: mapped.birthHistory ?? [],
      practitioners: resources.filter((r): r is Practitioner => r.resourceType === 'Practitioner'),
    };
  },
};
