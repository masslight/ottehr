import { Observation } from 'fhir/r4b';
import { AdHocEncounterRow, ENCOUNTER_LAYERS, EncounterLayerId } from 'utils/lib/types/adhoc/datasets/encounters';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { fetchScopedResources } from '../../../adhoc-report';
import { AnyEncounterLayerModule, defineEncounterLayer } from '../context';
import { indexByEncounter, stripEnc } from '../helpers';
import { vitalsLayer } from './vitals';

const vitalSubLayer = (id: EncounterLayerId, tags: VitalFieldNames[]): AnyEncounterLayerModule => {
  const fields = Object.keys(ENCOUNTER_LAYERS[id].schema.shape);
  return defineEncounterLayer<{ observationsByEncounterId: Map<string, Observation[]> }>({
    id,
    fetch: async (ctx) => ({
      observationsByEncounterId: indexByEncounter(
        await fetchScopedResources<Observation>(ctx.oystehr, 'Observation', 'encounter', ctx.encRefs, [
          { name: '_tag', value: tags.join(',') },
        ]),
        (o) => stripEnc(o.encounter?.reference)
      ),
    }),
    map: (input, out, ctx) => {
      const all = vitalsLayer.map(input, out, ctx) as Record<string, unknown>;
      return Object.fromEntries(fields.filter((f) => f in all).map((f) => [f, all[f]])) as Partial<AdHocEncounterRow>;
    },
  });
};

export const vitalsTemperatureLayer = vitalSubLayer('vitalsTemperature', [VitalFieldNames.VitalTemperature]);
export const vitalsBloodPressureLayer = vitalSubLayer('vitalsBloodPressure', [VitalFieldNames.VitalBloodPressure]);
export const vitalsHeartRateLayer = vitalSubLayer('vitalsHeartRate', [VitalFieldNames.VitalHeartbeat]);
export const vitalsRespirationLayer = vitalSubLayer('vitalsRespiration', [VitalFieldNames.VitalRespirationRate]);
export const vitalsOxygenLayer = vitalSubLayer('vitalsOxygen', [VitalFieldNames.VitalOxygenSaturation]);
export const vitalsBodyLayer = vitalSubLayer('vitalsBody', [
  VitalFieldNames.VitalWeight,
  VitalFieldNames.VitalHeight,
  VitalFieldNames.VitalHeadCircumference,
]);
