import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetVisit, GetFlowsheetInput } from 'utils/lib/types/api/flowsheets.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitFlowsheets } from '../../src/features/flowsheets/pages/VisitFlowsheets';
import { routesInPerson } from '../../src/features/visits/in-person/routing/routesInPerson';

const visit = (start: string, extra: Partial<FlowsheetVisit> = {}): FlowsheetVisit => ({
  start,
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  provider: '',
  values: {},
  ...extra,
});

const visits: FlowsheetVisit[] = [
  visit('2026-11-14T14:05:00', {
    appointmentId: 'a1',
    encounterId: 'e1',
    reason: 'Cough',
    primaryDiagnosis: 'J06.9: Acute upper respiratory infection, unspecified',
    provider: 'Jane Smith',
    values: {
      [VitalFieldNames.VitalHeartbeat]: [
        { time: '2026-11-14T14:00:00', values: [140], flag: VitalAlertCriticality.Abnormal },
        { time: '2026-11-14T14:10:00', values: [92] },
      ],
      [VitalFieldNames.VitalWeight]: [{ time: '2026-11-14T14:10:00', values: [5.8] }],
    },
  }),
  visit('2026-11-14T08:14:00', { appointmentId: 'a2', encounterId: 'e2' }),
  visit('2026-09-03T10:00:00', {
    appointmentId: 'a3',
    encounterId: 'e3',
    values: {
      [VitalFieldNames.VitalHeartbeat]: [
        { time: '2026-09-03T10:05:00', values: [182], flag: VitalAlertCriticality.Critical },
      ],
    },
  }),
];

let practiceSetting: VitalsHeaderUnitSystem = 'metric';
let query: { data?: { visits: FlowsheetVisit[] }; isPending: boolean; error: Error | null };
const useGetFlowsheet = vi.fn((_input: GetFlowsheetInput) => query);

vi.mock('src/api/api', () => ({}));
vi.mock('src/hooks/useGetFlowsheet', () => ({
  useGetFlowsheet: (input: GetFlowsheetInput) => useGetFlowsheet(input),
}));
vi.mock('src/hooks/useServiceCategoryAbbreviation', () => ({
  useServiceCategoryAbbreviationResolver: () => () => undefined,
}));
vi.mock('src/features/visits/shared/components/vitals/hooks/useVitalsHeaderUnitSystem', () => ({
  useVitalsHeaderUnitSystem: () => practiceSetting,
}));
vi.mock('src/features/report-builder/runtime/components/EChart', () => ({
  EChart: ({
    option,
    onHover,
  }: {
    option: { series: { data: Record<string, unknown>[] }[] };
    onHover?: (datum: Record<string, unknown> | null) => void;
  }) => (
    <div data-testid="chart">
      {option.series[0].data.map((point, index) => (
        <button key={index} onMouseEnter={() => onHover?.(point)} onMouseLeave={() => onHover?.(null)}>
          {String(point.hoverText)}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('src/features/visits/shared/components/PageTitle', () => ({
  PageTitle: ({ label, actions }: { label: string; actions?: React.ReactNode }) => (
    <div>
      <h1>{label}</h1>
      {actions}
    </div>
  ),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    resources: { patient: { id: 'p1' } },
    encounter: { id: 'e1' },
    isAppointmentLoading: false,
    appointmentError: null,
  }),
}));

const renderPage = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <VisitFlowsheets />
    </MemoryRouter>
  );

const pressed = (name: string): string | null => screen.getByRole('button', { name }).getAttribute('aria-pressed');
const grid = (): HTMLElement => screen.getAllByRole('table')[0];
const gridRow = (name: string): HTMLElement => within(grid()).getByRole('rowheader', { name }).closest('tr')!;
const cellTexts = (row: HTMLElement): (string | null)[] =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

beforeEach(() => {
  practiceSetting = 'metric';
  query = { data: { visits }, isPending: false, error: null };
  useGetFlowsheet.mockClear();
});

describe('the Flowsheets sidebar entry', () => {
  it('sits right below Chief Complaint in the Intake group', () => {
    const intake = Object.values(routesInPerson).filter((route) => route.groupLabel === 'Intake');
    expect(intake.slice(0, 2).map((route) => route.text)).toEqual(['Chief Complaint', 'Flowsheets']);
  });

  it("is not on a follow-up's sidebar", () => {
    expect(routesInPerson.flowsheets.modes).toEqual(['main', 'readonly']);
  });
});

describe('the visit Flowsheets page', () => {
  it('opens on the Vitals tab and asks for the vitals flowsheet of the opened visit', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Flowsheets' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Vitals' })).toHaveAttribute('aria-selected', 'true');
    expect(useGetFlowsheet).toHaveBeenCalledWith({
      patientId: 'p1',
      flowsheetId: 'vitals',
      currentEncounterId: 'e1',
    });
  });

  it('shows the loader and no empty-chart message until the flowsheet has loaded', () => {
    query = { isPending: true, error: null };
    renderPage();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('No data for this patient')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when the flowsheet fails to load', () => {
    query = { isPending: false, error: new Error('You are not authorized to access this data') };
    renderPage();
    expect(screen.getByText('Could not load the flowsheet. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('the values by visit table', () => {
  it('has a column per visit, timed when two share a day, with the opened visit marked', () => {
    renderPage();
    const headers = within(grid())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Measure', 'This visit11/14/2026 2:05 PM', '11/14/2026 8:14 AM', '09/03/2026']);
  });

  it('links each date to that visit’s Review & Sign screen', () => {
    renderPage();
    expect(within(grid()).getByRole('link', { name: '09/03/2026' })).toHaveAttribute(
      'href',
      '/in-person/a3/review-and-sign?encounterId=e3'
    );
  });

  it('keeps every row, with "-" for a visit without the vital', () => {
    renderPage();
    expect(within(grid()).getAllByRole('rowheader')).toHaveLength(9);
    expect(cellTexts(gridRow('Head circumference (cm)'))).toEqual(['-', '-', '-']);
    expect(cellTexts(gridRow('BMI (kg/m²)'))).toEqual(['-', '-', '-']);
  });

  it('shows the latest reading with "+ N more" and only the latest reading’s flag', () => {
    renderPage();
    const row = gridRow('Heart rate (/min)');
    expect(cellTexts(row)).toEqual(['92 + 1 more', '-', '182']);
    const [rechecked, , critical] = within(row).getAllByRole('cell');
    expect(within(rechecked).queryByLabelText('Abnormal')).not.toBeInTheDocument();
    expect(within(critical).getByLabelText('Critical')).toBeInTheDocument();
  });

  it('lists every reading with its time, value, unit and flag on hover', async () => {
    renderPage();
    await userEvent.hover(within(gridRow('Heart rate (/min)')).getByText('92'));
    expect(await screen.findByText('11/14/2026 2:00 PM 140 /min abnormal')).toBeInTheDocument();
    expect(screen.getByText('11/14/2026 2:10 PM 92 /min')).toBeInTheDocument();
  });

  it('opens the readings from the keyboard too', async () => {
    renderPage();
    const value = within(gridRow('Heart rate (/min)')).getByText('92');
    expect(value).toHaveAttribute('tabindex', '0');
    while (document.activeElement !== value) await userEvent.tab();
    expect(await screen.findByText('11/14/2026 2:10 PM 92 /min')).toBeInTheDocument();
  });

  it('names the flag on hover of its icon', async () => {
    renderPage();
    await userEvent.hover(within(gridRow('Heart rate (/min)')).getByLabelText('Critical'));
    expect(await screen.findByRole('tooltip', { name: 'Critical' })).toBeInTheDocument();
  });
});

describe('the Metric/Imperial switch', () => {
  it('opens on the practice setting and switches rows, titles, hovers and charts', async () => {
    practiceSetting = 'imperial';
    renderPage();
    expect([pressed('Metric'), pressed('Imperial')]).toEqual(['false', 'true']);
    expect(cellTexts(gridRow('Weight (lbs)'))).toEqual(['12.79', '-', '-']);
    expect(screen.getByRole('button', { name: '11/14/2026 2:10 PM · 12.79 lbs ≈ 5.80 kg' })).toBeInTheDocument();
    await userEvent.hover(within(gridRow('Weight (lbs)')).getByText('12.79'));
    expect(await screen.findByText('11/14/2026 2:10 PM 12.79 lbs ≈ 5.80 kg')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Metric' }));
    expect(cellTexts(gridRow('Weight (kg)'))).toEqual(['5.80', '-', '-']);
    expect(screen.getAllByText('Weight (kg)')).toHaveLength(2);
    expect(screen.queryByText('Weight (lbs)')).not.toBeInTheDocument();
  });

  it('is not remembered: the page opens on the practice setting again', async () => {
    practiceSetting = 'imperial';
    const { unmount } = renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Metric' }));
    expect(pressed('Metric')).toBe('true');
    unmount();
    renderPage();
    expect([pressed('Metric'), pressed('Imperial')]).toEqual(['false', 'true']);
  });
});

describe('the trend charts', () => {
  it('show every chart, with a message in place of a chart that has no data', () => {
    renderPage();
    expect(screen.getAllByText('Heart rate (/min)')).toHaveLength(2);
    expect(screen.getAllByText('Blood pressure (mm Hg)')).toHaveLength(2);
    expect(screen.getAllByTestId('chart')).toHaveLength(2);
    expect(screen.getAllByText('No data for this patient')).toHaveLength(5);
  });

  it('key the flags that are plotted', () => {
    renderPage();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.queryByText('abnormal')).not.toBeInTheDocument();
  });

  it('highlight the visit’s cell and column header while a point is hovered', async () => {
    renderPage();
    const point = screen.getByRole('button', { name: '09/03/2026 10:05 AM · 182 /min · critical' });
    await userEvent.hover(point);
    const highlighted = (): (string | null)[] =>
      Array.from(grid().querySelectorAll('[data-highlighted]')).map((cell) => cell.textContent);
    expect(highlighted()).toEqual(['09/03/2026', '182']);
    await userEvent.unhover(point);
    expect(highlighted()).toEqual([]);
  });
});

describe('the Visits table', () => {
  it('lists the columns’ visits in the same order, with "-" for an empty field', () => {
    renderPage();
    const rows = within(screen.getByRole('table', { name: 'Visits' })).getAllByRole('row');
    expect(
      rows.map((row) =>
        within(row)
          .queryAllByRole('cell')
          .map((cell) => cell.textContent)
      )
    ).toEqual([
      [],
      ['11/14/2026 2:05 PM', '-', 'Cough', 'J06.9: Acute upper respiratory infection, unspecified', 'Jane Smith'],
      ['11/14/2026 8:14 AM', '-', '-', '-', '-'],
      ['09/03/2026', '-', '-', '-', '-'],
    ]);
  });
});
