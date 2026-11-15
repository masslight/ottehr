import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';
import { Flowsheets } from '../../src/features/flowsheets/components/Flowsheets';

const time = '2026-07-13T14:00:00.000Z';
const visit = (start: string, values: FlowsheetVisit['values']): FlowsheetVisit => ({
  start,
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});
// Growth opens first; each visit has a measure the other lacks, so each column has an empty cell.
let visits = [
  visit('2026-07-13T14:00:00.000Z', { weight: { time, value: 5.8, readings: [{ time, value: 5.8 }] } }),
  visit('2026-05-13T14:00:00.000Z', { height: { time, value: 58, readings: [{ time, value: 58 }] } }),
];

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
vi.mock('src/features/report-builder/runtime/components/EChart', () => ({ EChart: () => null }));

describe('Flowsheets grid', () => {
  it('an empty cell shows the house "-", as the Visits card does', () => {
    render(
      <MemoryRouter>
        <Flowsheets patientId="p1" />
      </MemoryRouter>
    );
    const weightRow = screen.getByText('Weight (kg)').closest('tr')!;
    expect(
      within(weightRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['Weight (kg)', '5.80', '-']);
  });

  it('the hover lists two results from one report at the same time, without a key warning', async () => {
    // A rectal chlamydia "Detected" and a urine "Not detected" from one report.
    visits = [
      visit(time, {
        chlamydia: {
          time,
          value: 'Not detected',
          readings: [
            { time, value: 'Detected' },
            { time, value: 'Not detected' },
          ],
        },
      }),
    ];
    const consoleError = vi.spyOn(console, 'error');
    render(
      <MemoryRouter>
        <Flowsheets patientId="p1" />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Lab results' }));
    const row = screen.getByText('Chlamydia').closest('tr')!;
    await userEvent.hover(within(row).getByText('+ 1 more'));
    expect(await screen.findByText(/ Detected$/)).toBeInTheDocument();
    expect(screen.getAllByText(/ Not detected$/)).toHaveLength(1);
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key/);
    consoleError.mockRestore();
  });
});
