import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LmsRow } from 'utils/lib/helpers/vitals/growth-lms';
import { FlowsheetVisit, GROWTH_CHART_IDS, GrowthChartData } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';
import { Flowsheets } from '../../src/features/flowsheets/components/Flowsheets';

const table: LmsRow[] = Array.from({ length: 25 }, (_, month) => [month, 0, 3.3 + month * 0.37, 0.12]);
const growthAt = (ageMonths: number): GrowthChartData => ({
  sex: 'female',
  ageMonths,
  points: [
    { chart: 'who-wfa', encounterId: 'e1', time: '2026-07-10T14:05:00.000Z', age: '20 mo', x: 20, y: 11, z: 0.1 },
  ],
  outsideRange: {},
  tables: Object.fromEntries(GROWTH_CHART_IDS.map((id) => [id, table])) as GrowthChartData['tables'],
});
let growth = growthAt(36);
const visits: FlowsheetVisit[] = [
  {
    encounterId: 'e1',
    start: '2026-07-10T14:00:00.000Z',
    isFollowUp: false,
    reason: '',
    primaryDiagnosis: '',
    attending: '',
    values: { weight: { time: '2026-07-10T14:05:00.000Z', value: 11, readings: [] } },
  },
];

vi.mock('src/api/api', () => ({}));
vi.mock('src/hooks/useGetFlowsheet', () => ({
  useGetFlowsheet: () => ({ data: { visits, growth }, isLoading: false, error: null }),
}));
vi.mock('src/hooks/useServiceCategoryAbbreviation', () => ({
  useServiceCategoryAbbreviationResolver: () => () => undefined,
}));
vi.mock('src/features/visits/shared/components/vitals/hooks/useVitalsHeaderUnitSystem', () => ({
  useVitalsHeaderUnitSystem: () => 'metric',
}));
vi.mock('src/features/report-builder/runtime/components/EChart', () => ({ EChart: () => null }));

const pressed = (): string | null | undefined =>
  screen.getAllByRole('button').find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent;

describe('Growth chart set', () => {
  it('reopens on the set for the age when the data changes under it ("All visits" back to "Up to this visit")', () => {
    // "All visits" for a child now 3: CDC.
    growth = growthAt(36);
    const { rerender } = render(
      <MemoryRouter>
        <Flowsheets patientId="p1" />
      </MemoryRouter>
    );
    expect(pressed()).toBe('2 to 20 years (CDC)');
    // Back to "Up to this visit" at a 20-month visit, answered from the cache: no remount, new data.
    growth = growthAt(20);
    rerender(
      <MemoryRouter>
        <Flowsheets patientId="p1" asOf="2026-07-10T23:59:59.999Z" />
      </MemoryRouter>
    );
    expect(pressed()).toBe('Birth to 24 months (WHO)');
  });
});
