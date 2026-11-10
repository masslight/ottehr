// The encounters dataset: root → base rows, then every requested layer in parallel, each layer one module
// (layers/*.ts) with its own fetch and map. Shared searches and by-id loaders live in the report context.
import Oystehr from '@oystehr/sdk';
import {
  AdHocEncounterRow,
  AdHocEncountersInput,
  ENCOUNTER_FOREIGN_LAYERS,
  EncounterLayerId,
} from 'utils/lib/types/adhoc/datasets/encounters';
import { resolveEncounterAppointment } from '../../adhoc-report';
import { fetchForeignPatientColumns, requestedForeignPatientLayers } from '../foreign';
import { AnyEncounterLayerModule, createEncounterContext } from './context';
import { aiLayer } from './layers/ai';
import { chartingLayer } from './layers/charting';
import { codesLayer } from './layers/codes';
import { dispositionLayer } from './layers/disposition';
import { documentsLayer } from './layers/documents';
import { employerLayer } from './layers/employer';
import { examRosLayer } from './layers/examRos';
import { followUpLayer } from './layers/followUp';
import { imagingLayer } from './layers/imaging';
import { immunizationsLayer } from './layers/immunizations';
import { intakeLayer } from './layers/intake';
import { labsLayer } from './layers/labs';
import { medicationsLayer } from './layers/medications';
import { nursingLayer } from './layers/nursing';
import { paperworkLayer } from './layers/paperwork';
import { proceduresLayer } from './layers/procedures';
import { resultsLayer } from './layers/results';
import { signingLayer } from './layers/signing';
import { timingLayer } from './layers/timing';
import { vitalsLayer } from './layers/vitals';
import { buildEncounterBaseRow, fetchEncounterBaseLookups, fetchEncounterRoot, timezoneLookup } from './root';

/** Every layer module of the dataset, by layer id. A layer listed in ENCOUNTER_LAYERS must have one. */
export const ENCOUNTER_LAYER_MODULES: Record<EncounterLayerId, AnyEncounterLayerModule> = {
  codes: codesLayer,
  timing: timingLayer,
  ai: aiLayer,
  medications: medicationsLayer,
  vitals: vitalsLayer,
  labs: labsLayer,
  imaging: imagingLayer,
  immunizations: immunizationsLayer,
  employer: employerLayer,
  disposition: dispositionLayer,
  examRos: examRosLayer,
  results: resultsLayer,
  nursing: nursingLayer,
  procedures: proceduresLayer,
  signing: signingLayer,
  paperwork: paperworkLayer,
  charting: chartingLayer,
  intake: intakeLayer,
  followUp: followUpLayer,
  documents: documentsLayer,
};

const includeFlag = (id: string): string => `include${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/** The layer ids an endpoint input asks for (its include<Layer> flags). */
export function requestedEncounterLayers(params: AdHocEncountersInput): EncounterLayerId[] {
  const flags = params as unknown as Record<string, boolean | undefined>;
  return (Object.keys(ENCOUNTER_LAYER_MODULES) as EncounterLayerId[]).filter((id) => flags[includeFlag(id)]);
}

export async function fetchAdHocEncounterRows(
  oystehr: Oystehr,
  params: AdHocEncountersInput,
  options: { environment?: string } = {}
): Promise<AdHocEncounterRow[]> {
  const { dateRange } = params;
  const requested = requestedEncounterLayers(params);
  const modules = requested.map((id) => ENCOUNTER_LAYER_MODULES[id]);

  // 1. Root: appointments + encounters of the range, then patients / locations / practitioners by id.
  const startedAt = Date.now();
  const { root, practitioners } = await fetchEncounterRoot(oystehr, dateRange);
  const rootMs = Date.now() - startedAt;

  const ctx = createEncounterContext({
    oystehr,
    dateRange,
    environment: options.environment ?? '',
    requested: new Set(requested),
    root,
    practitioners,
  });

  // 2. The base lookups and every requested layer, all at once: each needs only the root. The fetch helpers'
  //    job pool limits the requests, not the layers.
  //    The foreign patient layers (`patients.*`) run with them, for the patients of the root.
  const fetchMs = new Map<string, number>();
  const [lookups, outs, foreignColumns] = await Promise.all([
    fetchEncounterBaseLookups(oystehr, root),
    Promise.all(
      modules.map(async (module) => {
        const fetchStartedAt = Date.now();
        const out = await module.fetch(ctx);
        fetchMs.set(module.id, Date.now() - fetchStartedAt);
        return out;
      })
    ),
    fetchForeignPatientColumns(oystehr, {
      dateRange,
      patients: Array.from(root.patientMap.values()),
      foreign: ENCOUNTER_FOREIGN_LAYERS,
      requested: requestedForeignPatientLayers(ENCOUNTER_FOREIGN_LAYERS, params),
    }),
  ]);

  // 3. One row per encounter: the base, then each layer's columns.
  const fetchedAt = Date.now();
  const timezoneForLocation = timezoneLookup();
  const rows: AdHocEncounterRow[] = [];
  const mapMs = modules.map(() => 0);

  for (const encounter of root.encounterById.values()) {
    const appointment = resolveEncounterAppointment(encounter, root.appointmentMap, root.encounterById);

    if (!appointment) continue;

    const { row, input } = buildEncounterBaseRow(
      encounter,
      appointment,
      root,
      ctx.practitioners.map,
      lookups,
      timezoneForLocation
    );

    modules.forEach((module, index) => {
      const mapStartedAt = Date.now();
      Object.assign(row, module.map(input, outs[index], ctx));
      mapMs[index] += Date.now() - mapStartedAt;
    });
    Object.assign(row, foreignColumns.get(row.patientId));

    rows.push(row);
  }

  // Where the time went. Layer fetches run at once and share the job pool, so a layer's fetch time includes
  // waiting for a slot; map time is the work on this server.
  console.log(
    `[adhoc] encounters timing: rows=${rows.length} root ms=${rootMs} layers ms=${fetchedAt - startedAt - rootMs} ` +
      `map ms=${Date.now() - fetchedAt} | ` +
      modules.map((m, i) => `${m.id}: fetch ${fetchMs.get(m.id) ?? 0} map ${mapMs[i]}`).join(', ')
  );

  return rows;
}
