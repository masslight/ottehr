import {
  isTemperatureVitalObservation,
  roundNumberToDecimalPlaces,
  textToNumericValue,
  VitalsObservationDTO,
  VitalsTemperatureObservationDTO,
} from 'utils';
import { composeVitalsHistoryEntries } from '../utils';
import { VitalTemperatureHistoryEntry } from './VitalTemperatureHistoryEntry';

export const textToTemperatureNumber = (text: string): number | undefined => {
  const tempVal = textToNumericValue(text);
  if (!tempVal) return;
  return roundTemperatureValue(tempVal);
};

export const celsiusToFahrenheit = (tempInCelsius: number): number =>
  roundTemperatureValue((9 / 5) * tempInCelsius + 32);

const roundTemperatureValue = (temperature: number): number => roundNumberToDecimalPlaces(temperature, 1);

export const isValidTemperatureCelsius = (tempCelsius: number): boolean => {
  return tempCelsius >= 32 && tempCelsius <= 43;
};

export const TEMPERATURE_WARNING_THRESHOLD = 37;
const checkIsTemperatureWarning = (temperatureCelsius: number): boolean => {
  return temperatureCelsius > TEMPERATURE_WARNING_THRESHOLD;
};

export const composeTemperatureVitalsHistoryEntries = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
): VitalTemperatureHistoryEntry[] => {
  return composeVitalsHistoryEntries<VitalsTemperatureObservationDTO, VitalTemperatureHistoryEntry>(
    encounterId,
    userId,
    vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient,
    isTemperatureVitalObservation,
    (observation) => {
      return {
        temperatureCelsius: observation.value,
        isTemperatureWarning: checkIsTemperatureWarning(observation.value),
      };
    }
  );
};
