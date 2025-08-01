import {
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsHeartbeatObservationDTO,
  VitalsHeightObservationDTO,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
  VitalsRespirationRateObservationDTO,
  VitalsTemperatureObservationDTO,
  VitalsVisionObservationDTO,
  VitalsWeightObservationDTO,
} from '../../types';
import { formatDateTimeToZone } from '../../utils';
import { cmToInches, getVisionExtraOptionsFormattedString, kgToLbs, VitalsVisitNoteData } from '../vitals';

export const mapVitalsToDisplay = (
  vitalsObservations: VitalsObservationDTO[],
  showTime = true,
  timezone?: string
): VitalsVisitNoteData | undefined =>
  vitalsObservations?.reduce((vitals, observation) => {
    const field = observation.field;
    const time = formatDateTimeToZone(observation.lastUpdated, timezone ?? 'America/New_York');
    let text;
    let parsed;

    switch (field) {
      case VitalFieldNames.VitalTemperature:
        parsed = observation as VitalsTemperatureObservationDTO;
        text = `${parsed.value} C ${parsed.observationMethod ? ` (${parsed.observationMethod})` : ''}`;
        break;
      case VitalFieldNames.VitalHeartbeat:
        parsed = observation as VitalsHeartbeatObservationDTO;
        text = `${parsed.value}/min${parsed.observationMethod ? ` (${parsed.observationMethod})` : ''}`;
        break;
      case VitalFieldNames.VitalRespirationRate:
        parsed = observation as VitalsRespirationRateObservationDTO;
        text = `${parsed.value}/min`;
        break;
      case VitalFieldNames.VitalBloodPressure:
        parsed = observation as VitalsBloodPressureObservationDTO;
        text = `${parsed.systolicPressure}/${parsed.diastolicPressure} mm Hg${
          parsed.observationMethod ? ` (${parsed.observationMethod})` : ''
        }`;
        break;
      case VitalFieldNames.VitalOxygenSaturation:
        parsed = observation as VitalsOxygenSatObservationDTO;
        text = `${parsed.value}%${parsed.observationMethod ? ` (${parsed.observationMethod})` : ''}`;
        break;
      case VitalFieldNames.VitalWeight:
        parsed = observation as VitalsWeightObservationDTO;
        text = `${parsed.value} kg / ${kgToLbs(parsed.value)} lbs`;
        break;
      case VitalFieldNames.VitalHeight:
        parsed = observation as VitalsHeightObservationDTO;
        text = `${parsed.value} cm / ${cmToInches(parsed.value)} inch`;
        break;
      case VitalFieldNames.VitalVision:
        parsed = observation as VitalsVisionObservationDTO;
        text = `Left eye: ${parsed.leftEyeVisionText}; Right eye: ${parsed.rightEyeVisionText};${
          parsed.extraVisionOptions && parsed.extraVisionOptions.length > 0
            ? ` ${getVisionExtraOptionsFormattedString(parsed.extraVisionOptions)}`
            : ''
        }`;
        break;
      default:
        break;
    }

    if (text) {
      if (!vitals[field]) {
        vitals[field] = [];
      }
      vitals[field]!.push(showTime ? `${time} - ${text}` : text);
    }

    return vitals;
  }, {} as VitalsVisitNoteData);
