import {
  AdHocEncounterRow,
  ENCOUNTER_DOMAIN_FIELDS,
  ENCOUNTER_INTERNAL_FIELDS,
  ENCOUNTER_LAYERS,
  EncounterBaseRowSchema,
  layerIncludeFlags,
  layerOptions,
  VisitStatusLabel,
} from 'utils';
import { getAdHocEncounters } from '../../../api/api';
import { buildTrackingBoardPath } from '../../../pages/reports/trackingBoardLink';
import { ADHOC_QUERY_STALE_MS, dedupeByEncounter, fetchBatchedRange, toLocalYmd } from '../query/batching';
import { buildLlmDatasetSchema } from './schema';
import { AdHocDataset, AdHocDatasetOption, AdHocRow, FetchContext } from './types';

// Comprehensive one-row-per-encounter dataset. Visit/patient/location come back on every fetch;
// opt-in layers (checkboxes) add weight only when asked for. Checkboxes derive from the Zod layer
// map (id/label/description).
export const ADHOC_ENCOUNTERS_OPTIONS: AdHocDatasetOption[] = layerOptions(ENCOUNTER_LAYERS);

// Zone-dependent derivation happens here in the browser (zambda emits raw ISO only): `date` becomes
// the viewer-local day, and trackingBoardHref is built client-side with the same visit-type branching
// the Complete Encounters report uses for its appointment-time link.
function localizeEncounterRow(row: AdHocEncounterRow): AdHocEncounterRow {
  return {
    ...row,
    date: toLocalYmd(row.startTime),
    trackingBoardHref:
      row.visitType === 'In-Person' && row.locationId
        ? buildTrackingBoardPath({
            appointmentStart: row.startTime,
            locationId: row.locationId,
            visitStatus: row.visitStatus as VisitStatusLabel,
          })
        : row.visitType === 'Telemed'
        ? '/visits'
        : '',
  };
}

async function fetchAdHocEncounters({
  oystehrZambda,
  queryClient,
  dateRange,
  options,
}: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};

  // One include<Layer> flag per layer, derived from the layer map.
  const flags = layerIncludeFlags(ENCOUNTER_LAYERS, opts);

  const rows = await fetchBatchedRange(
    dateRange,
    (range) =>
      // Through react-query so identical window fetches are deduped/cached (no duplicate zambda calls
      // from StrictMode re-runs, re-renders, or the infer→needsLayers pipeline).
      queryClient
        .fetchQuery({
          queryKey: ['adhoc-encounters', range, flags],
          queryFn: () => getAdHocEncounters(oystehrZambda, { dateRange: range, ...flags }),
          staleTime: ADHOC_QUERY_STALE_MS,
        })
        .then((r) => r.encounters.map(localizeEncounterRow)),
    dedupeByEncounter
  );

  return rows as unknown as AdHocRow[];
}

export const adhocEncountersDataset: AdHocDataset = {
  id: 'encounters-comprehensive',
  label: 'Encounters',
  description:
    'One row per encounter with visit, patient, contact, and location/provider detail; optional ' +
    'clinical codes, KPI timing, and AI-assistance layers.',
  options: ADHOC_ENCOUNTERS_OPTIONS,
  fetch: fetchAdHocEncounters,
  buildSchema: (rows, options) => {
    const opts = options ?? {};
    return buildLlmDatasetSchema({
      datasetId: 'encounters-comprehensive',
      label: 'Encounters',
      description: 'One row per encounter — visit, patient, contact, location/provider, and any enabled layers.',
      rows,
      base: EncounterBaseRowSchema,
      layers: ENCOUNTER_LAYERS,
      selected: opts,
      internalFields: ENCOUNTER_INTERNAL_FIELDS,
      domainFields: ENCOUNTER_DOMAIN_FIELDS,
    });
  },
};
