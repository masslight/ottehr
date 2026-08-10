// Component tests for the review-tab ProceduresContainer (rendered in the progress note and
// follow-up note): the structured wound/lesion size, repair depth, and infusion time lines
// render with human labels when present and render nothing when absent.
//
// vi.mock calls must come before any component imports (Vitest hoists them).

const { chartDataMock } = vi.hoisted(() => ({
  chartDataMock: { current: {} as Record<string, unknown> },
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({ chartData: chartDataMock.current }),
}));

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProceduresContainer } from '../../src/features/visits/shared/components/review-tab/components/ProceduresContainer';

const setProcedures = (procedures: Record<string, unknown>[]): void => {
  chartDataMock.current = { procedures };
};

const PROCEDURE_ITEM_TESTID = 'procedure-item';

describe('ProceduresContainer — structured procedure detail lines', () => {
  beforeEach(() => {
    chartDataMock.current = {};
  });

  it('renders size, repair depth (label, not code), and infusion time lines when present', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'Laceration Repair',
        lengthCm: 3.2,
        repairDepth: 'subcutaneous-layered',
        infusionStartTime: '14:05',
        infusionStopTime: '14:47',
      },
    ]);
    render(<ProceduresContainer />);
    const item = screen.getByTestId(PROCEDURE_ITEM_TESTID);
    expect(item).toHaveTextContent('Wound/lesion size: 3.2 cm');
    expect(item).toHaveTextContent('Repair depth: Subcutaneous — layered closure');
    expect(item).toHaveTextContent('Infusion time: 14:05–14:47 (42 min)');
    // The raw stored code never renders.
    expect(item).not.toHaveTextContent('subcutaneous-layered');
  });

  it('renders nothing for the structured fields when they are absent', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'EKG',
        bodySite: 'Chest',
      },
    ]);
    render(<ProceduresContainer />);
    const item = screen.getByTestId(PROCEDURE_ITEM_TESTID);
    expect(item).toHaveTextContent('Site/location: Chest');
    expect(item).not.toHaveTextContent('Wound/lesion size');
    expect(item).not.toHaveTextContent('Repair depth');
    expect(item).not.toHaveTextContent('Infusion time');
  });

  it('falls back to the raw value for an unknown/legacy repair depth code', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'Laceration Repair',
        repairDepth: 'legacy-unknown-depth',
      },
    ]);
    render(<ProceduresContainer />);
    expect(screen.getByTestId(PROCEDURE_ITEM_TESTID)).toHaveTextContent('Repair depth: legacy-unknown-depth');
  });

  it('applies the cross-midnight rule to the infusion duration', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'IV Fluid Administration',
        infusionStartTime: '23:50',
        infusionStopTime: '00:20',
      },
    ]);
    render(<ProceduresContainer />);
    expect(screen.getByTestId(PROCEDURE_ITEM_TESTID)).toHaveTextContent('Infusion time: 23:50–00:20 (30 min)');
  });

  it('renders a lone start time verbatim without a duration', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'IV Fluid Administration',
        infusionStartTime: '14:05',
      },
    ]);
    render(<ProceduresContainer />);
    const item = screen.getByTestId(PROCEDURE_ITEM_TESTID);
    expect(item).toHaveTextContent('Infusion time: 14:05–');
    expect(item).not.toHaveTextContent('min)');
  });
});
