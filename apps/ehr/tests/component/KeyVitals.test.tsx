import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { convertVitalsListToMap } from 'utils/lib/helpers/vitals/utils';
import {
  VitalAlertCriticality,
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { describe, expect, it } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { KeyVitals } from '../../src/features/visits/in-person/components/KeyVitals';

const NORMAL_VITALS: VitalsObservationDTO[] = [
  { field: VitalFieldNames.VitalTemperature, value: 36.6 },
  { field: VitalFieldNames.VitalHeartbeat, value: 72 },
  { field: VitalFieldNames.VitalRespirationRate, value: 13 },
  { field: VitalFieldNames.VitalBloodPressure, systolicPressure: 120, diastolicPressure: 80 },
  {
    field: VitalFieldNames.VitalOxygenSaturation,
    value: 98,
    observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2,
    supplementalO2: { flowRate: 4.5, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula },
  },
  { field: VitalFieldNames.VitalWeight, value: 67 },
  { field: VitalFieldNames.VitalHeight, value: 171 },
  { field: VitalFieldNames.VitalBMI, value: 22.9 },
];

const ALERTED_VITALS: VitalsObservationDTO[] = [
  { field: VitalFieldNames.VitalTemperature, value: 38, alertCriticality: VitalAlertCriticality.Abnormal },
  { field: VitalFieldNames.VitalHeartbeat, value: 72 },
  { field: VitalFieldNames.VitalRespirationRate, value: 6, alertCriticality: VitalAlertCriticality.Critical },
];

const renderKeyVitals = (list: VitalsObservationDTO[], unitSystem: VitalsHeaderUnitSystem = 'metric'): void => {
  render(<KeyVitals vitals={convertVitalsListToMap(list)} unitSystem={unitSystem} />);
};

const getKeyVitals = (): HTMLElement => screen.getByTestId(dataTestIds.inPersonHeader.keyVitals);

const hoverKeyVitals = async (): Promise<HTMLElement> => {
  await userEvent.setup().hover(getKeyVitals());
  return screen.findByRole('tooltip');
};

describe('KeyVitals', () => {
  it('renders nothing while vitals are loading', () => {
    render(<KeyVitals vitals={undefined} unitSystem="metric" />);
    expect(screen.queryByTestId(dataTestIds.inPersonHeader.keyVitals)).not.toBeInTheDocument();
  });

  it('renders nothing when no key vitals are recorded', () => {
    renderKeyVitals([{ field: VitalFieldNames.VitalLastMenstrualPeriod, value: '2026-11-01' }]);
    expect(screen.queryByTestId(dataTestIds.inPersonHeader.keyVitals)).not.toBeInTheDocument();
  });

  it('shows "Key Vitals: Normal" and every key vital on hover when nothing is alerted', async () => {
    renderKeyVitals(NORMAL_VITALS);
    expect(getKeyVitals()).toHaveTextContent(/^Key Vitals: Normal$/);

    const tooltip = await hoverKeyVitals();
    [
      'Temp: 36.6 C',
      'HR: 72/min',
      'RR: 13/min',
      'BP: 120/80 mm Hg',
      'Oxygen sat: 98% (On supplemental O2 - 4.5 L/min - Nasal Cannula)',
      'Weight: 67kg',
      'Height: 171 cm',
      'BMI: 22.9 kg/m2',
    ].forEach((text) => expect(tooltip).toHaveTextContent(text));
  });

  it('shows only alerted vitals with their criticality icons', async () => {
    renderKeyVitals(ALERTED_VITALS);
    const keyVitals = getKeyVitals();

    expect(keyVitals).toHaveTextContent(/^T: 38 C \| RR: 6\/min$/);
    expect(within(keyVitals).getByTestId('WarningAmberOutlinedIcon')).toBeInTheDocument();
    expect(within(keyVitals).getByTestId('ErrorIcon')).toBeInTheDocument();

    const tooltip = await hoverKeyVitals();
    expect(tooltip).toHaveTextContent('Temp: 38 C');
    expect(tooltip).toHaveTextContent('HR: 72/min');
    expect(tooltip).toHaveTextContent('RR: 6/min');
  });

  it('uses the latest observation of each vital', () => {
    renderKeyVitals([
      { field: VitalFieldNames.VitalHeartbeat, value: 190, alertCriticality: VitalAlertCriticality.Critical },
      { field: VitalFieldNames.VitalHeartbeat, value: 72 },
    ]);
    expect(getKeyVitals()).toHaveTextContent(/^HR: 190\/min$/);
  });

  it('shows temperature, weight and height in imperial units', async () => {
    renderKeyVitals(NORMAL_VITALS, 'imperial');

    const tooltip = await hoverKeyVitals();
    expect(tooltip).toHaveTextContent('Temp: 97.9 F');
    expect(tooltip).toHaveTextContent('Weight: 147.7lbs');
    expect(tooltip).toHaveTextContent(`Height: 5'7.5"`);
  });

  it('shows a refused weight', async () => {
    renderKeyVitals([{ field: VitalFieldNames.VitalWeight, extraWeightOptions: ['patient_refused'] }]);

    const tooltip = await hoverKeyVitals();
    expect(tooltip).toHaveTextContent('Weight: Patient Refused');
  });
});
