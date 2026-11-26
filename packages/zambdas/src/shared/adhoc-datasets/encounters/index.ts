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
import {
  vitalsBloodPressureLayer,
  vitalsBodyLayer,
  vitalsHeartRateLayer,
  vitalsOxygenLayer,
  vitalsRespirationLayer,
  vitalsTemperatureLayer,
} from './layers/vitals-split';
import {
  buildEncounterBaseRow,
  fetchEncounterBaseLookups,
  fetchEncounterRoot,
  loadEncounterRootLookups,
  timezoneLookup,
} from './root';

export const ENCOUNTER_LAYER_MODULES: Record<EncounterLayerId, AnyEncounterLayerModule> = {
  codes: codesLayer,
  timing: timingLayer,
  ai: aiLayer,
  medications: medicationsLayer,
  vitals: vitalsLayer,
  vitalsTemperature: vitalsTemperatureLayer,
  vitalsBloodPressure: vitalsBloodPressureLayer,
  vitalsHeartRate: vitalsHeartRateLayer,
  vitalsRespiration: vitalsRespirationLayer,
  vitalsOxygen: vitalsOxygenLayer,
  vitalsBody: vitalsBodyLayer,
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

  const startedAt = Date.now();
  const root = await fetchEncounterRoot(oystehr, dateRange);
  const rootMs = Date.now() - startedAt;

  const sharedMs = new Map<string, number>();
  const ctx = createEncounterContext({
    oystehr,
    dateRange,
    environment: options.environment ?? '',
    requested: new Set(requested),
    root,
    loadRootLookups: () => loadEncounterRootLookups(oystehr, root),
    timings: sharedMs,
  });

  const fetchMs = new Map<string, number>();
  const timed = async <T>(id: string, run: () => Promise<T>): Promise<T> => {
    const fetchStartedAt = Date.now();
    const out = await run();
    fetchMs.set(id, Date.now() - fetchStartedAt);
    return out;
  };
  const foreignMs = new Map<string, number>();
  const [, lookups, outs, foreignColumns] = await Promise.all([
    timed('rootLookups', () => ctx.rootLookups()),
    timed('baseLookups', () => fetchEncounterBaseLookups(oystehr, root, ctx.rootLookups)),
    Promise.all(modules.map((module) => timed(module.id, () => module.fetch(ctx)))),
    timed('patients.*', () =>
      ctx.rootLookups().then(() =>
        fetchForeignPatientColumns(oystehr, {
          dateRange,
          patients: Array.from(root.patientMap.values()),
          appointments: Array.from(root.appointmentMap.values()),
          encounters: Array.from(root.encounterById.values()),
          foreign: ENCOUNTER_FOREIGN_LAYERS,
          requested: requestedForeignPatientLayers(ENCOUNTER_FOREIGN_LAYERS, params),
          timings: foreignMs,
        })
      )
    ),
  ]);

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

  console.log(
    `[adhoc] encounters timing: rows=${rows.length} root ms=${rootMs} layers ms=${fetchedAt - startedAt - rootMs} ` +
      `map ms=${Date.now() - fetchedAt} | ` +
      ['rootLookups', 'baseLookups', 'patients.*']
        .map((id) => `${id}: fetch ${fetchMs.get(id) ?? 0} map 0`)
        .concat(modules.map((m, i) => `${m.id}: fetch ${fetchMs.get(m.id) ?? 0} map ${mapMs[i]}`))
        .concat(Array.from(foreignMs, ([id, ms]) => `${id}: fetch ${ms} map 0`))
        .concat(Array.from(sharedMs, ([id, ms]) => `${id}: fetch ${ms} map 0`))
        .join(', ')
  );

  return rows;
}
