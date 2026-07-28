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

const expectLabelOrder = (item: HTMLElement, labels: string[]): void => {
  const text = item.textContent ?? '';
  const positions = labels.map((label) => text.indexOf(label));
  expect(positions).not.toContain(-1);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
};

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

  it('renders no label rows at all for a procedure that carries no documented fields', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'Nebulizer Treatment',
      },
    ]);
    render(<ProceduresContainer />);
    expect(screen.getByTestId(PROCEDURE_ITEM_TESTID).textContent).toBe('Nebulizer Treatment');
  });

  it('renders the structured lines between Side of body and Technique', () => {
    setProcedures([
      {
        resourceId: 'proc-laceration',
        procedureType: 'Laceration Repair',
        bodySide: 'Left',
        lengthCm: 3.2,
        repairDepth: 'subcutaneous-layered',
        technique: ['Simple interrupted sutures'],
      },
      {
        resourceId: 'proc-infusion',
        procedureType: 'IV Fluid Administration',
        bodySide: 'Right',
        infusionStartTime: '14:05',
        infusionStopTime: '14:47',
        technique: ['Peripheral IV'],
      },
    ]);
    render(<ProceduresContainer />);
    const [laceration, infusion] = screen.getAllByTestId(PROCEDURE_ITEM_TESTID);
    expectLabelOrder(laceration, ['Side of body', 'Wound/lesion size', 'Repair depth', 'Technique']);
    expectLabelOrder(infusion, ['Side of body', 'Infusion time', 'Technique']);
  });

  it('renders the human label for a known repair depth option, not the stored code', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'Laceration Repair',
        repairDepth: 'tissue-adhesive-only',
      },
    ]);
    render(<ProceduresContainer />);
    const item = screen.getByTestId(PROCEDURE_ITEM_TESTID);
    expect(item).toHaveTextContent('Repair depth: Tissue adhesive only (e.g. Dermabond)');
    expect(item).not.toHaveTextContent('tissue-adhesive-only');
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

  it('renders a zero-length infusion range rather than suppressing the duration', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'IV Push',
        infusionStartTime: '14:05',
        infusionStopTime: '14:05',
      },
    ]);
    render(<ProceduresContainer />);
    expect(screen.getByTestId(PROCEDURE_ITEM_TESTID)).toHaveTextContent('Infusion time: 14:05–14:05 (0 min)');
  });

  it('renders a malformed stored endpoint verbatim instead of dropping the line', () => {
    setProcedures([
      {
        resourceId: 'proc-1',
        procedureType: 'IV Fluid Administration',
        infusionStartTime: '14:05',
        infusionStopTime: '2:5 pm',
      },
    ]);
    render(<ProceduresContainer />);
    const item = screen.getByTestId(PROCEDURE_ITEM_TESTID);
    expect(item).toHaveTextContent('Infusion time: 14:05–2:5 pm');
    expect(item).not.toHaveTextContent('min)');
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
