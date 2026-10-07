import { BatchInputGetRequest } from '@oystehr/sdk';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { IN_PERSON_NOTE_ID, NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ENCOUNTER_SCOPED_NOTE_TYPES } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { encounterScopedSearch, patientScopedSearch } from '../../chart-data/search-requests';
import { mapChartResources } from '../map';
import { ChartSectionDefinition } from '../types';

const noteTags = (types: NOTE_TYPE[]): string =>
  types.map((type) => `${PRIVATE_EXTENSION_BASE_URL}/${type}|${IN_PERSON_NOTE_ID}`).join(',');

/**
 * Provider notes of the requested types. Scope is decided per type on the server: the visit-specific lists
 * (intake, internal, addendum) come from this encounter only, the history-style types from every encounter
 * of the patient, which is how the progress note has always shown them.
 */
export const notesSection: ChartSectionDefinition<'notes'> = {
  section: 'notes',
  requests: (encounterId, params) => {
    const types = [...new Set(params.types)];
    const encounterScoped = types.filter((type) => ENCOUNTER_SCOPED_NOTE_TYPES.includes(type));
    const patientScoped = types.filter((type) => !ENCOUNTER_SCOPED_NOTE_TYPES.includes(type));
    const requests: BatchInputGetRequest[] = [];
    if (encounterScoped.length > 0) {
      requests.push(
        encounterScopedSearch('Communication', encounterId, { _sort: '-_lastUpdated', _tag: noteTags(encounterScoped) })
      );
    }
    if (patientScoped.length > 0) {
      requests.push(
        patientScopedSearch('Communication', encounterId, { _sort: '-_lastUpdated', _tag: noteTags(patientScoped) })
      );
    }
    return requests;
  },
  build: async ({ encounter, encounterId }, resources) => {
    const mapped = mapChartResources(encounter, resources, encounterId, { notes: [] });
    return { notes: mapped.notes ?? [] };
  },
};
