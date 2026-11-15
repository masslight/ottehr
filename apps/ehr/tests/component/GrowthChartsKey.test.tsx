import { act, render, screen } from '@testing-library/react';
import { LmsRow } from 'utils/lib/helpers/vitals/growth-lms';
import { GROWTH_CHART_IDS, GrowthChartData } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';
import { GrowthCharts } from '../../src/features/flowsheets/components/GrowthCharts';

// The charts' hover handlers, so a test can hover a point the way ECharts reports it.
const hovers: ((datum: Record<string, unknown> | null) => void)[] = [];
vi.mock('src/features/report-builder/runtime/components/EChart', () => ({
  EChart: ({ onHover }: { onHover?: (datum: Record<string, unknown> | null) => void }) => {
    if (onHover) hovers.push(onHover);
    return null;
  },
}));

// A small WHO-like table (months 0-24) for every chart; one weight at 6 months, so only weight-for-age has a point.
const table: LmsRow[] = Array.from({ length: 25 }, (_, month) => [month, 0, 3.3 + month * 0.37, 0.12]);
const growth: GrowthChartData = {
  sex: 'female',
  ageMonths: 6,
  points: [
    {
      chart: 'who-wfa',
      encounterId: 'e1',
      time: '2026-07-10T14:05:00.000Z',
      age: '6 mo',
      x: 6,
      y: 5.5,
      z: 0.1,
      percentile: '54th',
    },
  ],
  outsideRange: {},
  tables: Object.fromEntries(GROWTH_CHART_IDS.map((id) => [id, table])) as GrowthChartData['tables'],
};

describe('Growth chart key', () => {
  it('lists "measurement" only under a chart that draws one', () => {
    render(<GrowthCharts growth={growth} visits={[]} />);
    const keys = screen.queryAllByText(
      (_, element) => element?.tagName === 'SPAN' && element.textContent?.trim() === '● measurement'
    );
    expect(keys).toHaveLength(1);
  });
});

describe('Growth chart out-of-range note', () => {
  it('points to the other chart set only where it has that chart: never from BMI-for-age, which WHO lacks', () => {
    render(
      <GrowthCharts growth={{ ...growth, ageMonths: 30, outsideRange: { 'cdc-wfa': 1, 'cdc-bmi': 1 } }} visits={[]} />
    );
    expect(screen.getByText('1 measurement is outside 2 to 20 years — see the other chart set.')).toBeInTheDocument();
    expect(screen.getByText('1 measurement is outside 2 to 20 years.')).toBeInTheDocument();
  });

  it('never points to the other chart set from weight-for-length, which CDC lacks', () => {
    const cdcPoint = { ...growth.points[0], chart: 'cdc-wfa' as const, x: 30, y: 13 };
    render(
      <GrowthCharts
        growth={{
          ...growth,
          points: [...growth.points, cdcPoint],
          outsideRange: { 'who-wfa': 1, 'who-wfl': 1 },
        }}
        visits={[]}
      />
    );
    const notes = screen.getAllByText(/^1 measurement is outside/).map((note) => note.textContent);
    expect(notes).toEqual([
      '1 measurement is outside birth to 24 months — see the other chart set.',
      '1 measurement is outside birth to 24 months.',
    ]);
  });
});

describe('Growth chart hover', () => {
  it('hovering a point marks its table row (ECharts hands back a copy of the point, not the same object)', () => {
    hovers.length = 0;
    render(<GrowthCharts growth={growth} visits={[]} />);
    const row = screen.getByText('54th').closest('tr')!;
    expect(row).not.toHaveClass('Mui-selected');
    // Every card's chart reports the hover; only weight-for-age has the point.
    act(() => hovers.forEach((hover) => hover({ point: { ...growth.points[0] } })));
    expect(row).toHaveClass('Mui-selected');
  });
});
