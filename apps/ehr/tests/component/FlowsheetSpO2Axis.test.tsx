import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as echarts from 'echarts';
import { MemoryRouter } from 'react-router-dom';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';
import { Flowsheets } from '../../src/features/flowsheets/components/Flowsheets';

const visit = (start: string, value: number): FlowsheetVisit => ({
  start,
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values: { oxygenSaturation: { time: start, value, readings: [{ time: start, value }] } },
});
const visits = [visit('2026-07-13T14:00:00.000Z', 98), visit('2026-03-09T15:00:00.000Z', 97)];

const charts: Record<string, any>[] = [];
vi.mock('src/api/api', () => ({}));
vi.mock('src/hooks/useGetFlowsheet', () => ({
  useGetFlowsheet: () => ({ data: { visits }, isLoading: false, error: null }),
}));
vi.mock('src/hooks/useServiceCategoryAbbreviation', () => ({
  useServiceCategoryAbbreviationResolver: () => () => undefined,
}));
vi.mock('src/features/visits/shared/components/vitals/hooks/useVitalsHeaderUnitSystem', () => ({
  useVitalsHeaderUnitSystem: () => 'metric',
}));
vi.mock('src/features/report-builder/runtime/components/EChart', () => ({
  EChart: ({ option }: { option: Record<string, any> }) => {
    charts.push(option);
    return null;
  },
}));

describe('SpO₂ trend chart', () => {
  it('its y-axis runs 85 to 100 in round steps, so the top tick is 100', async () => {
    render(
      <MemoryRouter>
        <Flowsheets patientId="p1" />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Vitals' }));
    const option = charts.filter((chart) => chart.yAxis.name === '%').pop()!;
    // Draw the y-axis as ECharts does at the card's height (jsdom has no canvas to measure text).
    echarts.setPlatformAPI({ measureText: (text: string) => ({ width: text.length * 7 }) } as never);
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 560, height: 280 });
    chart.setOption({ ...option, animation: false, xAxis: { ...option.xAxis, axisLabel: { show: false } } });
    const labels = [...chart.renderToSVGString().matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    chart.dispose();
    expect(labels.filter((label) => /^\d+$/.test(label))).toEqual(['85', '90', '95', '100']);
  });
});
