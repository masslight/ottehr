const { chartDataMock } = vi.hoisted(() => ({
  chartDataMock: { current: {} as Record<string, unknown> },
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({ chartData: chartDataMock.current }),
}));

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: undefined }) }));
vi.mock('../../src/features/visits/in-person/components/procedures/useProcedureSelectOptions', () => ({
  useProcedureSelectOptions: () => ({
    data: { procedureTypes: [{ code: 'burn-treatment', name: 'Burn Treatment / Dressing' }] },
  }),
}));
vi.mock('../../src/features/visits/telemed/components/admin/admin.queries', () => ({
  useProcedureQuickPicksQuery: () => ({
    data: [
      {
        id: 'pick',
        name: 'Saved burn care',
        procedureType: 'burn-treatment',
        structuredFacts: { degree: 'partial thickness', tbsa: 5 },
        cptCodes: [
          { code: '16025', display: 'Burn care', billableUnits: 2, modifier: [{ code: 'LT', display: 'Left' }] },
        ],
      },
    ],
  }),
}));

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProceduresContainer } from '../../src/features/visits/shared/components/review-tab/components/ProceduresContainer';
import ProcedureQuickPickDetailPage from '../../src/features/visits/telemed/components/admin/ProcedureQuickPickDetailPage';

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

  it('renders the family labels, explicit false answers, modifiers and units', () => {
    chartDataMock.current = {
      procedures: [
        {
          resourceId: 'proc-1',
          procedureType: 'Nail Trephination (Subungual Hematoma Drainage)',
          structuredFacts: { count: 2, nailRemoved: false },
          cptCodes: [
            { code: '11740', display: 'Drainage', billableUnits: 2, modifier: [{ code: 'F1', display: 'Finger' }] },
          ],
        },
      ],
    };
    render(<ProceduresContainer />);
    const item = screen.getByTestId('procedure-item');
    expect(item).toHaveTextContent('Digits treated: 2');
    expect(item).toHaveTextContent('Nail removed: No');
    expect(item).toHaveTextContent('11740-F1 × 2');
    expect(item).not.toHaveTextContent('nailRemoved');
  });

  it('shows only the structured labels that have a value, and keeps an unknown saved value visible', () => {
    chartDataMock.current = {
      procedures: [
        { resourceId: 'proc-1', procedureType: 'EKG', bodySite: 'Chest' },
        { resourceId: 'proc-2', procedureType: 'Laceration Repair', repairDepth: 'legacy-unknown-depth' },
      ],
    };
    render(<ProceduresContainer />);

    const [ekg, laceration] = screen.getAllByTestId('procedure-item');
    expect(ekg).toHaveTextContent('Site/location: Chest');
    expect(ekg).not.toHaveTextContent('Wound/lesion size');
    expect(ekg).not.toHaveTextContent('Repair depth');
    expect(ekg).not.toHaveTextContent('Infusion time');
    expect(laceration).toHaveTextContent('Repair depth: legacy-unknown-depth');
  });
});

describe('quick-pick detail', () => {
  it('resolves the catalog name and displays saved findings with labels and the complete billing line', () => {
    render(
      <MemoryRouter initialEntries={['/pick']}>
        <Routes>
          <Route path="/:quickPickId" element={<ProcedureQuickPickDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Burn Treatment / Dressing')).toBeInTheDocument();
    expect(screen.getByText(/Deepest burn degree treated: partial thickness/)).toHaveTextContent(
      'Treated partial-thickness body surface (%): 5'
    );
    expect(screen.getByText('16025-LT × 2 — Burn care')).toBeInTheDocument();
  });
});
