import { Box, Typography } from '@mui/material';
import { FC, Fragment } from 'react';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { formatBMIWithUnit } from 'utils/lib/helpers/vitals/vitals-bmi.helper';
import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { formatOxygenSatObservationMethod } from 'utils/lib/helpers/vitals/vitals-oxygen-saturation.helper';
import { celsiusToFahrenheit, roundTemperatureValue } from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { formatWeightKg, formatWeightLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { VitalAlertIcon } from '../../shared/components/vitals/components/VitalAlertIcon';

interface KeyVitalField {
  field: VitalFieldNames;
  label: string;
  shortLabel?: string;
}

interface KeyVital {
  label: string;
  shortLabel: string;
  value: string;
  details?: string;
  alertCriticality?: VitalAlertCriticality;
}

const KEY_VITAL_FIELDS: KeyVitalField[] = [
  { field: VitalFieldNames.VitalTemperature, label: 'Temp', shortLabel: 'T' },
  { field: VitalFieldNames.VitalHeartbeat, label: 'HR' },
  { field: VitalFieldNames.VitalRespirationRate, label: 'RR' },
  { field: VitalFieldNames.VitalBloodPressure, label: 'BP' },
  { field: VitalFieldNames.VitalOxygenSaturation, label: 'Oxygen sat' },
  { field: VitalFieldNames.VitalWeight, label: 'Weight' },
  { field: VitalFieldNames.VitalHeight, label: 'Height' },
  { field: VitalFieldNames.VitalBMI, label: 'BMI' },
];

const NO_WRAP_SX = { whiteSpace: 'nowrap' };

const ALERT_TEXT_COLOR: Record<VitalAlertCriticality, string> = {
  [VitalAlertCriticality.Critical]: 'error.main',
  [VitalAlertCriticality.Abnormal]: 'warning.main',
};

export const formatHeaderWeight = (weightKg: number, unitSystem: VitalsHeaderUnitSystem): string =>
  unitSystem === 'imperial' ? `${formatWeightLbs(weightKg)}lbs` : `${formatWeightKg(weightKg)}kg`;

const formatKeyVitalValue = (
  observation: VitalsObservationDTO,
  unitSystem: VitalsHeaderUnitSystem
): string | undefined => {
  const isImperial = unitSystem === 'imperial';
  switch (observation.field) {
    case VitalFieldNames.VitalTemperature:
      return isImperial
        ? `${roundTemperatureValue(celsiusToFahrenheit(observation.value))} F`
        : `${roundTemperatureValue(observation.value)} C`;
    case VitalFieldNames.VitalHeartbeat:
    case VitalFieldNames.VitalRespirationRate:
      return `${observation.value}/min`;
    case VitalFieldNames.VitalBloodPressure:
      return `${observation.systolicPressure}/${observation.diastolicPressure} mm Hg`;
    case VitalFieldNames.VitalOxygenSaturation:
      return `${observation.value}%`;
    case VitalFieldNames.VitalWeight:
      return typeof observation.value === 'number'
        ? formatHeaderWeight(observation.value, unitSystem)
        : 'Patient Refused';
    case VitalFieldNames.VitalHeight: {
      const height = HeightMeasurement.fromCm(observation.value);
      return isImperial ? height.getFeetInchesLabel() : `${height.getCm(HEIGHT_CM_DISPLAY_PRECISION)} cm`;
    }
    case VitalFieldNames.VitalBMI:
      return formatBMIWithUnit(observation.value);
    default:
      return undefined;
  }
};

const getKeyVitals = (vitals: GetVitalsResponseData, unitSystem: VitalsHeaderUnitSystem): KeyVital[] =>
  KEY_VITAL_FIELDS.flatMap(({ field, label, shortLabel = label }) => {
    const latest: VitalsObservationDTO | undefined = vitals[field]?.[0];
    const value = latest && formatKeyVitalValue(latest, unitSystem);
    if (!value) return [];
    return {
      label,
      shortLabel,
      value,
      details:
        latest.field === VitalFieldNames.VitalOxygenSaturation ? formatOxygenSatObservationMethod(latest) : undefined,
      alertCriticality: latest.alertCriticality,
    };
  });

const KeyVitalValue: FC<{ vital: KeyVital }> = ({ vital: { value, alertCriticality } }) => (
  <Box component="span" sx={{ color: alertCriticality && ALERT_TEXT_COLOR[alertCriticality] }}>
    {value}
    <VitalAlertIcon criticality={alertCriticality} />
  </Box>
);

const KeyVitalsTooltip: FC<{ keyVitals: KeyVital[] }> = ({ keyVitals }) => (
  <Box
    sx={{
      display: 'grid',
      gridAutoFlow: 'column',
      gridTemplateRows: `repeat(${Math.ceil(keyVitals.length / 2)}, auto)`,
      columnGap: 3,
      rowGap: 0.5,
      p: 1,
    }}
  >
    {keyVitals.map((vital) => (
      <Typography key={vital.label} variant="body2">
        <strong>{vital.label}:</strong> <KeyVitalValue vital={vital} />
        {vital.details && ` (${vital.details})`}
      </Typography>
    ))}
  </Box>
);

interface KeyVitalsProps {
  vitals: GetVitalsResponseData | undefined;
  unitSystem: VitalsHeaderUnitSystem;
}

export const KeyVitals: FC<KeyVitalsProps> = ({ vitals, unitSystem }) => {
  const keyVitals = vitals ? getKeyVitals(vitals, unitSystem) : [];
  if (keyVitals.length === 0) return null;

  const alertedVitals = keyVitals.filter((vital) => vital.alertCriticality);

  return (
    <GenericToolTip title={<KeyVitalsTooltip keyVitals={keyVitals} />} placement="bottom-start" customWidth={600}>
      <Typography
        variant="body2"
        color="text.secondary"
        component="div"
        sx={{ ml: 3 }}
        data-testid={dataTestIds.inPersonHeader.keyVitals}
      >
        {alertedVitals.length === 0 ? (
          <Box component="span" sx={NO_WRAP_SX}>
            Key Vitals: Normal
          </Box>
        ) : (
          alertedVitals.map((vital, index) => (
            <Fragment key={vital.label}>
              {index > 0 && ' | '}
              <Box component="span" sx={NO_WRAP_SX}>
                {vital.shortLabel}: <KeyVitalValue vital={vital} />
              </Box>
            </Fragment>
          ))
        )}
      </Typography>
    </GenericToolTip>
  );
};
