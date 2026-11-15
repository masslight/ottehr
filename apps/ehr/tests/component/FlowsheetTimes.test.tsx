import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const charts: { xAxis: { axisPointer?: { label?: { formatter?: (p: { value: number }) => string } } } }[] = [];
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
  });
});
