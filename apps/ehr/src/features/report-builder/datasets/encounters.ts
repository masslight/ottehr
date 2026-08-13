import { layerOptions } from 'utils/lib/types/adhoc/datasets/dataset';
import {
  AdHocEncounterRow,
  AdHocEncountersOutput,
  ENCOUNTER_DOMAIN_FIELDS,
  ENCOUNTER_INTERNAL_FIELDS,
  ENCOUNTER_LAYERS,
  EncounterBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/encounters';
import { VisitStatusLabel } from 'utils/lib/types/api/appointment.types';
import { buildTrackingBoardPath } from '../../../pages/reports/trackingBoardLink';
import { ADHOC_QUERY_STALE_MS, runAdHocReport, toLocalYmd } from '../query/dataset-query';
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

  const result = await queryClient.fetchQuery({
    queryKey: ['adhoc-encounters', dateRange, opts],
    queryFn: () =>
      runAdHocReport<AdHocEncountersOutput>(oystehrZambda, {
        datasetId: 'encounters-comprehensive',
        dateRange,
        options: opts,
      }),
    staleTime: ADHOC_QUERY_STALE_MS,
  });

  return result.encounters.map(localizeEncounterRow);
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
