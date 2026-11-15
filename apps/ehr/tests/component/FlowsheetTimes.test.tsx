import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as echarts from 'echarts';
import { DateTime } from 'luxon';
import { MemoryRouter } from 'react-router-dom';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';
import { Flowsheets } from '../../src/features/flowsheets/components/Flowsheets';

// Local times, so the expected text does not depend on the test machine's zone.
const local = (hour: number, minute = 0): string =>
  DateTime.fromObject({ year: 2026, month: 7, day: 13, hour, minute }).toISO()!;
const visit = (start: string, values: FlowsheetVisit['values']): FlowsheetVisit => ({
  start,
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});
// Two visits on one day, so the column labels carry the time; the afternoon one has two heart rates.
const visits = [
  visit(local(14), {
    heartRate: {
      time: local(14, 5),
      value: 112,
      flag: VitalAlertCriticality.Abnormal,
      readings: [
        { time: local(13, 40), value: 98 },
        { time: local(14, 5), value: 112, flag: VitalAlertCriticality.Abnormal },
      ],
    },
  }),
  visit(local(9), { heartRate: { time: local(9, 10), value: 80, readings: [{ time: local(9, 10), value: 80 }] } }),
];

const charts: {
  xAxis: { axisPointer?: { label?: { formatter?: (p: { value: number }) => string } } } & Record<string, unknown>;
  tooltip: { renderMode?: string };
}[] = [];
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
  EChart: ({ option }: { option: (typeof charts)[number] }) => {
    charts.push(option);
    return null;
  },
}));

describe('Flowsheet times', () => {
  it('are 12-hour like the rest of Ottehr: column labels, the readings hover and the chart tooltip', async () => {
    render(
      <MemoryRouter>
        <Flowsheets patientId="p1" />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Vitals' }));
    const grid = screen.getAllByRole('table')[0];
    const header = grid.querySelector('thead')!;
    expect(within(header).getByText('07/13/2026 2:00 PM')).toBeInTheDocument();
    expect(within(header).getByText('07/13/2026 9:00 AM')).toBeInTheDocument();

    const heartRate = within(grid).getByText('Heart rate (/min)').closest('tr')!;
    await userEvent.hover(within(heartRate).getByText('112', { exact: false }));
    expect(await screen.findByText('2:05 PM 112 (abnormal)')).toBeInTheDocument();
    expect(screen.getByText('1:40 PM 98')).toBeInTheDocument();

    const tooltipLabel = charts[charts.length - 1].xAxis.axisPointer?.label?.formatter;
    expect(tooltipLabel?.({ value: Date.parse(local(14, 5)) })).toBe('07/13/2026 2:05 PM');
    // Plain canvas text, never HTML.
    expect(charts[charts.length - 1].tooltip.renderMode).toBe('richText');
  });

  it('label the trend chart axis 12-hour for a short span, and dates as MM/dd', async () => {
    render(
      <MemoryRouter>
        <Flowsheets patientId="p1" />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Vitals' }));
    const { formatter } = (charts[charts.length - 1].xAxis.axisLabel ?? {}) as {
      formatter?: (value: number) => string;
    };
    // ECharts formats the function's result as a template; plain text comes through as is.
    const tick = (iso: string): string =>
      echarts.time.format(Date.parse(iso), formatter?.(Date.parse(iso)) ?? '', false);
    expect(tick(local(16))).toBe('4 PM');
    expect(tick(local(16, 30))).toBe('4:30 PM');
    // After midnight the hour is 12, never 0; midnight itself is the day's tick.
    expect(tick(local(0, 30))).toBe('12:30 AM');
    expect(tick(local(0))).toBe('07/13');
    expect(tick(DateTime.fromISO(local(0)).set({ month: 1, day: 1 }).toISO()!)).toBe('2026');
  });
});
