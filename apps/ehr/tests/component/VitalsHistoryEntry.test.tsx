import { render, screen } from '@testing-library/react';
import {
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  VitalsHeartbeatObservationDTO,
  VitalsOxygenSatObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import VitalHistoryElement, {
  getObservationValueElements,
} from '../../src/features/visits/shared/components/vitals/components/VitalsHistoryEntry';

const LINE_COLOR = '#000000';

describe('getObservationValueElements', () => {
  describe('vital-bmi', () => {
    it('returns the BMI value with kg/m2 unit', () => {
      const obs = { field: VitalFieldNames.VitalBMI, value: 24.3 } as any;
      expect(getObservationValueElements(obs, LINE_COLOR)).toEqual(['24.3 kg/m2']);
    });

    it('displays BMI to exactly 1 decimal place', () => {
      const obs = { field: VitalFieldNames.VitalBMI, value: 22.9 } as any;
      expect(getObservationValueElements(obs, LINE_COLOR)[0]).toBe('22.9 kg/m2');
    });

    it('shows a trailing zero for integer BMI values', () => {
      const obs = { field: VitalFieldNames.VitalBMI, value: 25 } as any;
      expect(getObservationValueElements(obs, LINE_COLOR)[0]).toBe('25.0 kg/m2');
    });

    it('returns exactly one string element', () => {
      const obs = { field: VitalFieldNames.VitalBMI, value: 24.3 } as any;
      const elements = getObservationValueElements(obs, LINE_COLOR);
      expect(elements).toHaveLength(1);
      expect(typeof elements[0]).toBe('string');
    });
  });
});

describe('VitalHistoryElement — oxygen saturation', () => {
  const renderRow = (entry: Partial<VitalsOxygenSatObservationDTO>): HTMLElement => {
    render(
      <VitalHistoryElement
        dataTestId="row"
        historyEntry={{
          field: VitalFieldNames.VitalOxygenSaturation,
          value: 98,
          authorName: 'Brooks, Samanta',
          lastUpdated: '2024-04-28T17:18:00.000Z',
          ...entry,
        }}
      />
    );
    return screen.getByTestId('row');
  };

  it('shows the recorded supplemental O2 details after the qualifier', () => {
    const row = renderRow({
      observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2,
      supplementalO2: { flowRate: 4.5, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula },
    });
    expect(row).toHaveTextContent('by Brooks, Samanta - 98% (On supplemental O2 - 4.5 L/min - Nasal Cannula)');
  });

  it('shows the Other description', () => {
    const row = renderRow({
      observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2,
      supplementalO2: { deliveryType: VitalsSupplementalO2DeliveryType.Other, deliveryTypeOther: 'Face tent' },
    });
    expect(row).toHaveTextContent('98% (On supplemental O2 - Other: Face tent)');
  });

  it('shows a legacy supplemental O2 entry without details as before', () => {
    const row = renderRow({ observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2 });
    expect(row).toHaveTextContent(/98% \(On supplemental O2\)$/);
  });

  it('does not show details left on a room air entry', () => {
    const row = renderRow({
      observationMethod: VitalsOxygenSatObservationMethod.OnRoomAir,
      supplementalO2: { flowRate: 3 },
    });
    expect(row).toHaveTextContent(/98% \(On room air\)$/);
  });

  it('shows no parentheses without a qualifier', () => {
    expect(renderRow({})).toHaveTextContent(/98%$/);
  });

  it('keeps other vitals qualifiers unchanged', () => {
    const heartbeat: VitalsHeartbeatObservationDTO = {
      field: VitalFieldNames.VitalHeartbeat,
      value: 86,
      observationMethod: VitalHeartbeatObservationMethod.Sitting,
    };
    render(<VitalHistoryElement dataTestId="hr" historyEntry={heartbeat} />);
    expect(screen.getByTestId('hr')).toHaveTextContent(/86\/min \(Sitting\)$/);
  });
});
