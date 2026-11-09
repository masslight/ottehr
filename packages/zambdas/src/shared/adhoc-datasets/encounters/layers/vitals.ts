import { Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeVitalsObservationDTO } from 'utils/lib/fhir/vitals';
import { getVitalDTOCriticalityFromObservation } from 'utils/lib/helpers/vitals/utils';
import { HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  roundTemperatureValue,
} from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { isDotVisionScreeningEntry } from 'utils/lib/helpers/vitals/vitals-vision.helper';
import { kgToLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import {
  VitalAlertCriticality,
  VitalBloodPressureObservationMethod,
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsOxygenSatObservationMethod,
  VitalTemperatureObservationMethod,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO, VitalsVisionObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { fetchScopedResources, knownValueOrNull, presentFullName } from '../../../adhoc-report';
import { defineEncounterLayer } from '../context';
import {
  DIASTOLIC_CODES,
  indexByEncounter,
  round1,
  stripEnc,
  SYSTOLIC_CODES,
  VITAL_ALERT_FIELDS,
  VITAL_OBSERVATIONS_ENTRIES_PER_JOB,
  VITAL_TAG_CODES,
} from '../helpers';

// The visit's vital readings: latest values, every reading in order, alerts, how each was taken, vision, LMP.
export const vitalsLayer = defineEncounterLayer<{ observationsByEncounterId: Map<string, Observation[]> }>({
  id: 'vitals',
  fetch: async (ctx) => {
    // Only the vital readings (by tag), unless a layer that reads every Observation of the visit is loaded anyway.
    const observationsByEncounterId =
      ctx.requested.has('examRos') || ctx.requested.has('intake')
        ? await ctx.shared.observations()
        : indexByEncounter(
            await fetchScopedResources<Observation>(
              ctx.oystehr,
              'Observation',
              'encounter',
              ctx.encRefs,
              [{ name: '_tag', value: VITAL_TAG_CODES }],
              { entriesPerJob: VITAL_OBSERVATIONS_ENTRIES_PER_JOB }
            ),
            (o) => stripEnc(o.encounter?.reference)
          );

    // Names of the staff who recorded vitals: each reading's performer.
    const authorIds: (string | undefined)[] = [];
    for (const observations of observationsByEncounterId.values()) {
      for (const o of observations) {
        if (!o.meta?.tag?.some((t) => t.code?.startsWith('vital-'))) continue;
        authorIds.push(makeVitalsObservationDTO(o)?.authorId);
      }
    }
    await ctx.practitioners.load(authorIds);

    return { observationsByEncounterId };
  },
  map: (input, out, ctx) => {
    const { encounter } = input;
    const { observationsByEncounterId } = out;
    const practitionerMap = ctx.practitioners.map;
    const row: Partial<AdHocEncounterRow> = {};
    const obs = encounter.id ? observationsByEncounterId.get(encounter.id) ?? [] : [];
    const fieldCode = (o: Observation): string => o.meta?.tag?.find((t) => t.code?.startsWith('vital-'))?.code ?? '';

    const effectiveMillis = (o: Observation): number => {
      const ms = o.effectiveDateTime ? DateTime.fromISO(o.effectiveDateTime).toMillis() : NaN;
      return Number.isFinite(ms) ? ms : 0;
    };

    const chronological = (field: string): Observation[] =>
      obs.filter((o) => fieldCode(o) === field).sort((a, b) => effectiveMillis(a) - effectiveMillis(b));

    const latest = (field: string): Observation | undefined => chronological(field).at(-1);

    const qty = (o?: Observation): number | null =>
      typeof o?.valueQuantity?.value === 'number' ? o.valueQuantity.value : null;

    const toF = (o?: Observation): number | null => {
      const val = qty(o);
      if (val == null) return null;
      const unit = (o?.valueQuantity?.unit || o?.valueQuantity?.code || '').toUpperCase();
      return roundTemperatureValue(unit.startsWith('F') ? val : celsiusToFahrenheit(val));
    };

    row.temperatureF = toF(latest('vital-temperature'));

    // The chart stores °C, kg and cm; a reading charted in °F, lbs or inches is normalized first, so every
    // unit below is the same reading as the field it mirrors. The other units come from the chart's helpers.
    const celsiusOf = (o?: Observation): number | null => {
      const val = qty(o);
      if (val == null) return null;
      const unit = (o?.valueQuantity?.unit || o?.valueQuantity?.code || '').toUpperCase();
      return unit.startsWith('F') ? fahrenheitToCelsius(val) : val;
    };

    const roundedCelsius = (o?: Observation): number | null => {
      const celsius = celsiusOf(o);
      return celsius == null ? null : roundTemperatureValue(celsius);
    };

    row.temperatureC = roundedCelsius(latest('vital-temperature'));

    row.heartRate = qty(latest('vital-heartbeat'));
    row.respirationRate = qty(latest('vital-respiration-rate'));
    row.oxygenSaturation = qty(latest('vital-oxygen-sat'));

    const bpComp = (bpObs: Observation | undefined, codes: string[]): number | null => {
      const c = bpObs?.component?.find((cm) => cm.code?.coding?.some((cd) => cd.code && codes.includes(cd.code)));
      return typeof c?.valueQuantity?.value === 'number' ? c.valueQuantity.value : null;
    };

    const bp = latest('vital-blood-pressure');
    row.systolicBP = bpComp(bp, SYSTOLIC_CODES);
    row.diastolicBP = bpComp(bp, DIASTOLIC_CODES);

    const numbers = (values: (number | null)[]): number[] => values.filter((v): v is number => v != null);
    row.temperatureFReadings = numbers(chronological('vital-temperature').map(toF));
    row.temperatureCReadings = numbers(chronological('vital-temperature').map(roundedCelsius));
    row.heartRateReadings = numbers(chronological('vital-heartbeat').map(qty));
    row.respirationRateReadings = numbers(chronological('vital-respiration-rate').map(qty));
    row.oxygenSaturationReadings = numbers(chronological('vital-oxygen-sat').map(qty));

    const bpPairs = chronological('vital-blood-pressure')
      .map((o) => ({ systolic: bpComp(o, SYSTOLIC_CODES), diastolic: bpComp(o, DIASTOLIC_CODES) }))
      .filter((pair): pair is { systolic: number; diastolic: number } => {
        return pair.systolic != null && pair.diastolic != null;
      });

    row.systolicBPReadings = bpPairs.map((pair) => pair.systolic);
    row.diastolicBPReadings = bpPairs.map((pair) => pair.diastolic);

    const abnormalVitals: string[] = [];
    const criticalVitals: string[] = [];

    for (const [field, name] of Object.entries(VITAL_ALERT_FIELDS)) {
      const levels = chronological(field).map((o) => getVitalDTOCriticalityFromObservation(o));
      if (levels.some((level) => level != null)) abnormalVitals.push(name);
      if (levels.includes(VitalAlertCriticality.Critical)) criticalVitals.push(name);
    }

    row.abnormalVitals = abnormalVitals;
    row.criticalVitals = criticalVitals;

    const weightObs = latest('vital-weight');
    const weightVal = qty(weightObs);
    const weightUnit = (weightObs?.valueQuantity?.unit || '').toLowerCase();

    const weightInKg = weightVal == null ? null : weightUnit.startsWith('lb') ? weightVal * 0.453592 : weightVal;
    row.weightKg = weightInKg == null ? null : round1(weightInKg);
    row.weightLbs = weightInKg == null ? null : kgToLbs(weightInKg);

    const heightObs = latest('vital-height');
    const heightVal = qty(heightObs);
    const heightUnit = (heightObs?.valueQuantity?.unit || '').toLowerCase();

    const heightInCm = heightVal == null ? null : heightUnit.startsWith('in') ? heightVal * 2.54 : heightVal;
    row.heightCm = heightInCm == null ? null : round1(heightInCm);
    const height = heightInCm == null ? undefined : HeightMeasurement.fromCm(heightInCm);
    row.heightInches = height ? height.getInches() : null;
    row.heightFeetInches = height ? height.getFeetInchesLabel() : '';

    // How each reading was taken, vision and LMP — read with the chart's vitals DTO builder.
    const latestDto = (field: VitalFieldNames): VitalsObservationDTO | undefined => {
      const o = latest(field);
      return o ? makeVitalsObservationDTO(o) : undefined;
    };

    const methodOf = (dto: VitalsObservationDTO | undefined): string | undefined =>
      dto && 'observationMethod' in dto ? dto.observationMethod : undefined;

    row.temperatureMethod = knownValueOrNull(
      Object.values(VitalTemperatureObservationMethod),
      methodOf(latestDto(VitalFieldNames.VitalTemperature))
    );

    row.heartRateMethod = knownValueOrNull(
      Object.values(VitalHeartbeatObservationMethod),
      methodOf(latestDto(VitalFieldNames.VitalHeartbeat))
    );

    row.bloodPressureMethod = knownValueOrNull(
      Object.values(VitalBloodPressureObservationMethod),
      methodOf(latestDto(VitalFieldNames.VitalBloodPressure))
    );

    const oxygenSatDto = latestDto(VitalFieldNames.VitalOxygenSaturation);

    row.oxygenSaturationMethod = knownValueOrNull(
      Object.values(VitalsOxygenSatObservationMethod),
      methodOf(oxygenSatDto)
    );

    const supplementalO2 =
      oxygenSatDto?.field === VitalFieldNames.VitalOxygenSaturation ? oxygenSatDto.supplementalO2 : undefined;
    row.oxygenSaturationFlowRate = supplementalO2?.flowRate ?? null;
    row.oxygenSaturationDeliveryType = supplementalO2?.deliveryType ?? null;
    row.oxygenSaturationDeliveryTypeOther = supplementalO2?.deliveryTypeOther ?? '';

    const weightDto = latestDto(VitalFieldNames.VitalWeight);

    row.weightRefused =
      weightDto?.field === VitalFieldNames.VitalWeight && !!weightDto.extraWeightOptions?.includes('patient_refused');

    // A DOT vision screening is a separate entry on the same vital; the acuity reading is the latest other one.
    const vision = chronological(VitalFieldNames.VitalVision)
      .map((o) => makeVitalsObservationDTO(o))
      .filter(
        (dto): dto is VitalsVisionObservationDTO =>
          dto?.field === VitalFieldNames.VitalVision && !isDotVisionScreeningEntry(dto.dotVisionScreening)
      )
      .at(-1);

    row.visionLeftEye = vision?.leftEyeVisionText ?? '';
    row.visionRightEye = vision?.rightEyeVisionText ?? '';
    row.visionBothEyes = vision?.bothEyesVisionText ?? '';
    row.visionOptions = vision?.extraVisionOptions ?? [];

    const lmp = latestDto(VitalFieldNames.VitalLastMenstrualPeriod);
    const lmpDto = lmp?.field === VitalFieldNames.VitalLastMenstrualPeriod ? lmp : undefined;
    row.lastMenstrualPeriod = lmpDto?.value || null;
    row.lastMenstrualPeriodUnsure = lmpDto ? !!lmpDto.isUnsure : null;

    const dot = chronological(VitalFieldNames.VitalVision)
      .map((o) => makeVitalsObservationDTO(o))
      .filter(
        (dto): dto is VitalsVisionObservationDTO =>
          dto?.field === VitalFieldNames.VitalVision && isDotVisionScreeningEntry(dto.dotVisionScreening)
      )
      .at(-1)?.dotVisionScreening;
    row.dotHorizontalFieldLeftDegrees = dot?.horizontalFieldLeftDegrees ?? null;
    row.dotHorizontalFieldRightDegrees = dot?.horizontalFieldRightDegrees ?? null;
    row.dotCanRecognizeColors = dot?.canRecognizeColors ?? null;
    row.dotMonocularVision = dot?.hasMonocularVision ?? null;
    row.dotReferredToSpecialist = dot?.referredToSpecialist ?? null;
    row.dotReceivedReferralDocumentation = dot?.receivedDocumentation ?? null;

    // The vitals history names each reading's author as the chart does (getFullName of the performer).
    const vitalReadings = obs
      .filter((o) => fieldCode(o).length > 0)
      .sort((a, b) => effectiveMillis(a) - effectiveMillis(b));

    const recordedBy: string[] = [];

    for (const reading of vitalReadings) {
      const authorId = makeVitalsObservationDTO(reading)?.authorId;
      const author = authorId ? practitionerMap.get(authorId) : undefined;
      const name = presentFullName(author);
      if (name && !recordedBy.includes(name)) recordedBy.push(name);
    }

    row.vitalsRecordedBy = recordedBy;
    row.vitalsFirstRecordedAt = vitalReadings[0]?.effectiveDateTime ?? null;

    row.bmi =
      row.weightKg && row.heightCm && row.heightCm > 0 ? round1(row.weightKg / (row.heightCm / 100) ** 2) : null;
    return row;
  },
});
