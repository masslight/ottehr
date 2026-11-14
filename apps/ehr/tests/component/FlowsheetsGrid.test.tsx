import { render, screen, within } from '@testing-library/react';
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
const visits = [
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
});
