import { fireEvent, render, screen, within } from '@testing-library/react';
import { forecastImmunizations } from 'utils/lib/immunization-forecast/engine';
import { buildForecastInput } from 'utils/lib/immunization-forecast/forecast-input';
import {
  GetImmunizationForecastResponse,
  ImmunizationMark,
  PatientImmunizationRecord,
} from 'utils/lib/types/data/immunization/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saveMutate, clearMutate } = vi.hoisted(() => ({ saveMutate: vi.fn(), clearMutate: vi.fn() }));

vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useGetImmunizationForecast: () => ({ data: fixture, isLoading: false, error: null }),
}));
vi.mock('../../src/features/immunization/hooks/useImmunizationForecast', () => ({
  useSaveImmunizationMark: () => ({ mutate: saveMutate, isPending: false, error: null }),
  useClearImmunizationMark: () => ({ mutate: clearMutate, isPending: false, error: null }),
}));

import { ImmunizationTimelineContainer } from '../../src/features/immunization/timeline/ImmunizationTimelineContainer';

// Maya, DOB 2026-07-08, seen on 2026-11-10: a birth Hep B dose outside, Pentacel + PCV20 + RotaTeq at 2 months,
// an undated outside MMR, and rotavirus declined by the parent.
const DOB = '2026-07-08';
const AS_OF = '2026-11-10';
const dose = (overrides: Partial<PatientImmunizationRecord>): PatientImmunizationRecord => ({
  id: 'd',
  vaccineName: 'Vaccine',
  outside: false,
  dateUnknown: false,
  ...overrides,
});
const immunizations: PatientImmunizationRecord[] = [
  dose({
    id: 'hepb-birth',
    vaccineName: 'Engerix-B',
    cvx: '08',
    outside: true,
    dateGiven: DOB,
    place: 'Mercy Hospital',
    source: 'other-provider',
    sourceCode: '02',
  }),
  dose({
    id: 'pentacel-1',
    vaccineName: 'Pentacel',
    cvx: '120',
    dateGiven: '2026-09-09T14:30:00.000Z',
    lot: 'U7421AA',
    administeredBy: { name: 'J. Nurse' },
  }),
  dose({ id: 'pcv-1', vaccineName: 'Prevnar 20', cvx: '216', dateGiven: '2026-09-09T14:30:00.000Z' }),
  dose({ id: 'rota-1', vaccineName: 'RotaTeq', cvx: '116', dateGiven: '2026-09-09T14:30:00.000Z' }),
  dose({
    id: 'mmr-undated',
    vaccineName: 'MMR',
    cvx: '03',
    outside: true,
    dateUnknown: true,
    source: 'recall',
    sourceCode: '04',
  }),
];
const marks: ImmunizationMark[] = [
  {
    id: 'mark-rota',
    vaccineGroup: { code: 'rota', display: 'Rotavirus' },
    mark: 'declined',
    markedAt: '2026-11-10T15:00:00.000Z',
    markedBy: { id: 'nurse-1', name: 'J. Nurse' },
    note: 'Parent declined',
  },
  {
    id: 'mark-rota-old',
    vaccineGroup: { code: 'rota', display: 'Rotavirus' },
    mark: 'contraindicated',
    markedAt: '2026-09-09T15:00:00.000Z',
    markedBy: { id: 'doc-1', name: 'Dr. Patel' },
    cleared: { at: '2026-10-01T15:00:00.000Z', by: { id: 'nurse-1', name: 'J. Nurse' } },
  },
];
const fixture: GetImmunizationForecastResponse = {
  dob: DOB,
  immunizations,
  marks,
  cvxGroups: {},
  forecast: forecastImmunizations(buildForecastInput({ dob: DOB, sex: 'female', asOf: AS_OF }, immunizations, marks)),
};

describe('ImmunizationTimeline', () => {
  beforeEach(() => {
    saveMutate.mockReset();
    clearMutate.mockReset();
  });

  it('renders one lane per vaccine group with its status, doses, undated dose and mark', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    for (const group of fixture.forecast.groups) {
      expect(screen.getByTestId(`immunization-lane-${group.group}`)).toBeInTheDocument();
    }
    const dtap = screen.getByTestId('immunization-lane-dtap');
    expect(within(dtap).getByRole('button', { name: 'DTaP/Tdap/Td dose 1' })).toBeInTheDocument();
    expect(within(dtap).getByText('Due today')).toBeInTheDocument();
    const rota = screen.getByTestId('immunization-lane-rota');
    expect(within(rota).getByText('Declined')).toBeInTheDocument();
    expect(within(rota).getByText(/· recorded by J\. Nurse/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('immunization-lane-mmr')).getByText('Outside · Date unknown · not counted')
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Age range' })).toBeInTheDocument();
    expect(screen.getByLabelText('Show windows for given doses')).toBeChecked();
  });

  it('shows dose details with the due window, timing and the other lanes the shot counted in', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    fireEvent.click(screen.getByRole('button', { name: 'DTaP/Tdap/Td dose 1' }));
    expect(screen.getByText(/Pentacel, CVX 120/)).toBeInTheDocument();
    expect(screen.getByText(/Due window: .*Given on time\./)).toBeInTheDocument();
    expect(screen.getByText(/Same shot also counts as: .*Polio 1/)).toBeInTheDocument();
    expect(screen.getByText(/Given here, lot U7421AA, by J\. Nurse/)).toBeInTheDocument();
  });

  it('shows the mark history, cleared marks included, when the lane is selected', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rotavirus mark' }));
    expect(
      screen.getByText(
        /Declined 11\/10\/2026 · recorded by J\. Nurse; Contraindicated 09\/09\/2026 · recorded by Dr\. Patel, cleared 10\/01\/2026 by J\. Nurse/
      )
    ).toBeInTheDocument();
  });

  it('Mark → Declined saves the mark through the hook, with the optional note', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Hep B' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Immune', 'Contraindicated', 'Declined']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Declined' }));
    expect(screen.getByText('Mark Hep B as Declined')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '  Parent declined  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(saveMutate).toHaveBeenCalledWith({
      patientId: 'maya',
      vaccineGroup: 'hepb',
      mark: 'declined',
      note: 'Parent declined',
    });
  });

  it('Clear clears the active mark through the hook', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    fireEvent.click(within(screen.getByTestId('immunization-lane-rota')).getByRole('button', { name: 'Clear' }));
    expect(clearMutate).toHaveBeenCalledWith({ markId: 'mark-rota' });
  });

  it('hides Mark and Clear in a read-only context', () => {
    render(<ImmunizationTimelineContainer patientId="maya" readOnly />);
    expect(screen.queryByRole('button', { name: /^Mark / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByTestId('immunization-lane-rota')).toBeInTheDocument();
  });
});
