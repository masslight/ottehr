import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ImmunizationForecast,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
} from 'utils/lib/immunization-forecast/types';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { buildDueToday, coverageOf, stockedVaccines } from '../../src/features/immunization/components/dueToday';
import { CoverageStrip, DueTodayBox, LineQuickPicks } from '../../src/features/immunization/components/DueTodayBox';
import { ImmunizationFormValues } from '../../src/features/immunization/components/immunizationLines';

const group = (
  id: ImmunizationGroupId,
  label: string,
  status: ImmunizationGroupForecast['status'],
  cvx: string[],
  mark?: ImmunizationGroupForecast['mark']
): ImmunizationGroupForecast => ({
  group: id,
  label,
  status,
  seriesStatus: 'Not Complete',
  seriesNames: [],
  targetDoses: 3,
  targetText: '3',
  doses: [],
  next:
    status === 'due' || status === 'pastdue' || status === 'uptodate'
      ? { n: 2, earliest: '2026-11-08', recommended: '2026-12-23', pastDue: null, latest: null, cvx }
      : null,
  notNeeded: [],
  notes: [],
  mark,
});

const forecast: ImmunizationForecast = {
  asOf: '2026-11-10',
  dataVersion: '2026-11',
  unmappedDoses: [],
  groups: [
    group('hepb', 'Hep B', 'uptodate', ['08']),
    group('dtap', 'DTaP/Tdap/Td', 'due', ['20', '120', '146']),
    group('hib', 'Hib', 'due', ['48', '120', '146']),
    group('ipv', 'Polio', 'due', ['10', '120', '146']),
    group('pcv', 'PCV', 'due', ['216']),
    group('rota', 'Rotavirus', 'declined', [], { type: 'declined', date: '2026-11-10', by: 'J. Nurse' }),
  ],
};
const cvxGroups = {
  '08': ['hepb' as const],
  '10': ['ipv' as const],
  '20': ['dtap' as const],
  '48': ['hib' as const],
  '120': ['dtap' as const, 'hib' as const, 'ipv' as const],
  '146': ['dtap' as const, 'hib' as const, 'ipv' as const, 'hepb' as const],
  '216': ['pcv' as const],
};
const quickPick = (name: string, vaccineId: string, cvx: string, location: string): ImmunizationQuickPickData => ({
  id: `qp-${name}`,
  name,
  vaccine: { id: vaccineId, name: vaccineId },
  cvx,
  dose: '0.5',
  units: 'mL',
  route: '78421000',
  location: { name: location, code: location },
});
const quickPicks = [
  quickPick('Pentacel 2/4/6 mo', 'pentacel', '120', 'Left Thigh'),
  quickPick('Pentacel 15–18 mo', 'pentacel', '120', 'Left Deltoid'),
  quickPick('Daptacel', 'daptacel', '20', 'Right Thigh'),
  quickPick('Vaxelis', 'vaxelis', '146', 'Right Thigh'),
  quickPick('Prevnar 20 infant', 'prevnar', '216', 'Right Thigh'),
];
const stocked = stockedVaccines(
  [
    { id: 'pentacel', name: 'Pentacel', cvx: '120' },
    { id: 'daptacel', name: 'Daptacel', cvx: '20' },
    { id: 'vaxelis', name: 'Vaxelis', cvx: '146' },
    { id: 'prevnar', name: 'Prevnar 20', cvx: '216' },
  ],
  quickPicks
);
const dueToday = buildDueToday(forecast, stocked, cvxGroups);
const line = (vaccineId: string, cvx?: string): ImmunizationFormValues => ({
  details: { medication: { id: vaccineId, name: vaccineId } },
  administrationDetails: { cvx },
});

const onAdd = vi.fn();
const onAddAll = vi.fn();
const renderBox = (lines: ImmunizationFormValues[] = [], readOnly = false): ReturnType<typeof render> =>
  render(
    <DueTodayBox
      dueToday={dueToday}
      loading={false}
      error={false}
      lines={lines}
      readOnly={readOnly}
      onAdd={onAdd}
      onAddAll={onAddAll}
    />
  );

describe('DueTodayBox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows one row per group of due diseases, fewest shots first, and the marked vaccine as not suggested', () => {
    renderBox();
    const rows = screen.getAllByTestId(dataTestIds.orderVaccinePage.dueTodayRow);
    expect(rows[0]).toHaveTextContent('Pentacel covers DTaP/Tdap/Td · Hib · Polio');
    expect(rows[1]).toHaveTextContent('Prevnar 20 infant covers PCV');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Not suggested: Rotavirus (declined)')).toBeInTheDocument();
    expect(screen.getByText('Hep B 2 not due until 12/23/2026')).toBeInTheDocument();
  });

  it('names a vaccine with exactly one quick pick by that quick pick, and one with several by the vaccine', () => {
    renderBox();
    const rows = screen.getAllByTestId(dataTestIds.orderVaccinePage.dueTodayRow);
    expect(within(rows[1]).getByText('Prevnar 20 infant')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Prevnar 20')).not.toBeInTheDocument();
    expect(within(rows[0]).getByText('Pentacel')).toBeInTheDocument();
  });

  it('⊕ on a vaccine with one quick pick adds it; a vaccine with several lists them, each with its own ⊕', async () => {
    const user = userEvent.setup();
    renderBox();

    await user.click(screen.getByRole('button', { name: 'Add Prevnar 20 infant' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'prevnar' }));

    expect(screen.queryByRole('button', { name: 'Add Pentacel' })).not.toBeInTheDocument();
    expect(screen.getByText('Give 0.5 mL Intramuscular route in the Left Thigh')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Pentacel 15–18 mo' }));
    expect(onAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'pentacel' }),
      expect.objectContaining({ name: 'Pentacel 15–18 mo' })
    );
  });

  it('"Other ways to cover this" opens the single vaccines and the combination with an extra, and "Add all due" adds the set', async () => {
    const user = userEvent.setup();
    renderBox();

    expect(screen.queryByText(/Daptacel/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Other ways to cover this' }));
    const rows = screen.getAllByTestId(dataTestIds.orderVaccinePage.dueTodayRow);
    const alternatives = rows.slice(1, 3).map((row) => row.textContent);
    expect(alternatives[0]).toContain('Vaxelis');
    expect(alternatives[0]).toContain('also gives Hep B (not due)');
    expect(alternatives[1]).toContain('Daptacel covers DTaP/Tdap/Td');
    await user.click(screen.getByRole('button', { name: 'Hide other ways' }));
    expect(screen.queryByText(/Daptacel/)).not.toBeInTheDocument();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.dueTodayAddAll));
    expect(onAddAll).toHaveBeenCalledTimes(1);
  });

  it('marks a vaccine on the page as added and drops "Add all due" once every lead is on it', () => {
    renderBox([line('pentacel'), line('prevnar')]);
    expect(screen.getAllByTitle('Added')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Add / })).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.dueTodayAddAll)).not.toBeInTheDocument();
  });

  it('offers nothing to add when the visit is read-only', () => {
    renderBox([], true);
    expect(screen.queryByRole('button', { name: /^Add / })).not.toBeInTheDocument();
    expect(screen.getByText(/Pentacel/)).toBeInTheDocument();
  });

  it('grays out an out-of-stock vaccine with an "Out of stock" hover, and ⊕ still adds it', async () => {
    const prevnarOut = stocked.map((vaccine) =>
      vaccine.id === 'prevnar' ? { ...vaccine, outOfStock: true, quickPicks: [] } : vaccine
    );
    render(
      <DueTodayBox
        dueToday={buildDueToday(forecast, prevnarOut, cvxGroups)}
        loading={false}
        error={false}
        lines={[]}
        readOnly={false}
        onAdd={onAdd}
        onAddAll={onAddAll}
      />
    );
    const row = screen.getAllByTestId(dataTestIds.orderVaccinePage.dueTodayRow)[1];
    const name = within(row).getByText('Prevnar 20').parentElement!;
    expect(name).toHaveAttribute('aria-disabled', 'true');
    await userEvent.hover(name);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Out of stock');
    await userEvent.click(within(row).getByRole('button', { name: 'Add Prevnar 20' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'prevnar' }));
  });

  it('says when the forecast is loading or unavailable', () => {
    const { rerender } = render(
      <DueTodayBox
        dueToday={undefined}
        loading
        error={false}
        lines={[]}
        readOnly={false}
        onAdd={onAdd}
        onAddAll={onAddAll}
      />
    );
    expect(screen.getByText('Checking what is due…')).toBeInTheDocument();
    rerender(
      <DueTodayBox
        dueToday={undefined}
        loading={false}
        error
        lines={[]}
        readOnly={false}
        onAdd={onAdd}
        onAddAll={onAddAll}
      />
    );
    expect(screen.getByText('The forecast is not available right now.')).toBeInTheDocument();
  });
});

describe('CoverageStrip', () => {
  it('warns when a disease is given twice', () => {
    const coverage = coverageOf(dueToday.due, [line('pentacel', '120'), line('daptacel', '20')], stocked, cvxGroups);
    render(<CoverageStrip coverage={coverage} />);
    const strip = screen.getByTestId(dataTestIds.orderVaccinePage.coverage);
    expect(within(strip).getByText('DTaP/Tdap/Td ×2 (twice)')).toBeInTheDocument();
    expect(within(strip).getByText('Hib ✓')).toBeInTheDocument();
    expect(within(strip).getByText('PCV needed')).toBeInTheDocument();
  });
});

describe('LineQuickPicks', () => {
  it("lists the vaccine's quick picks and picks one with ⊕", async () => {
    const user = userEvent.setup();
    const onQuickPick = vi.fn();
    render(<LineQuickPicks vaccineName="Pentacel" quickPicks={quickPicks.slice(0, 2)} onQuickPick={onQuickPick} />);
    expect(screen.getByText('Quick picks for Pentacel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Pentacel 2/4/6 mo' }));
    expect(onQuickPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pentacel 2/4/6 mo' }));
  });
});
