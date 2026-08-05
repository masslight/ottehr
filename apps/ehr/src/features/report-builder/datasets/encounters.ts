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

export const ADHOC_ENCOUNTERS_OPTIONS: AdHocDatasetOption[] = layerOptions(ENCOUNTER_LAYERS);

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

  const flags = layerIncludeFlags(ENCOUNTER_LAYERS, opts);

  const rows = await fetchBatchedRange(
    dateRange,
    (range) =>
      queryClient
        .fetchQuery({
          queryKey: ['adhoc-encounters', range, flags],
          queryFn: () => getAdHocEncounters(oystehrZambda, { dateRange: range, ...flags }),
          staleTime: ADHOC_QUERY_STALE_MS,
        })
        .then((r) => r.encounters.map(localizeEncounterRow)),
    dedupeByEncounter
  );

  return rows;
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
