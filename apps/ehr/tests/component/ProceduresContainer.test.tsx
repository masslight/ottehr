const { chartDataMock } = vi.hoisted(() => ({
  chartDataMock: { current: {} as Record<string, unknown> },
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({ chartData: chartDataMock.current }),
}));

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProceduresContainer } from '../../src/features/visits/shared/components/review-tab/components/ProceduresContainer';

describe('structured fields in the procedure summary', () => {
  beforeEach(() => {
    chartDataMock.current = {};
  });

  it('renders persisted structured values using provider-facing labels', () => {
    chartDataMock.current = {
      procedures: [
        {
          resourceId: 'proc-1',
          procedureType: 'Laceration Repair',
          lengthCm: 3.2,
          repairDepth: 'subcutaneous-layered',
          infusionStartTime: '14:05',
          infusionStopTime: '14:47',
        },
      ],
    };
    render(<ProceduresContainer />);

    const item = screen.getByTestId('procedure-item');
    expect(item).toHaveTextContent('Wound/lesion size: 3.2 cm');
    expect(item).toHaveTextContent('Repair depth: Subcutaneous — layered closure');
    expect(item).toHaveTextContent('Infusion time: 14:05–14:47 (42 min)');
    expect(item).not.toHaveTextContent('subcutaneous-layered');
  });

  it('does not render structured labels when their values are absent', () => {
    chartDataMock.current = {
      procedures: [{ resourceId: 'proc-1', procedureType: 'EKG', bodySite: 'Chest' }],
    };
    render(<ProceduresContainer />);

    const item = screen.getByTestId('procedure-item');
    expect(item).toHaveTextContent('Site/location: Chest');
    expect(item).not.toHaveTextContent('Wound/lesion size');
    expect(item).not.toHaveTextContent('Repair depth');
    expect(item).not.toHaveTextContent('Infusion time');
  });

  it('keeps an unknown persisted repair-depth value visible', () => {
    chartDataMock.current = {
      procedures: [
        {
          resourceId: 'proc-1',
          procedureType: 'Laceration Repair',
          repairDepth: 'legacy-unknown-depth',
        },
      ],
    };
    render(<ProceduresContainer />);

    expect(screen.getByTestId('procedure-item')).toHaveTextContent('Repair depth: legacy-unknown-depth');
  });
});
