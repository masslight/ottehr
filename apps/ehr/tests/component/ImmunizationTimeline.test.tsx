import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { forecastImmunizations } from 'utils/lib/immunization-forecast/engine';
import { buildForecastInput } from 'utils/lib/immunization-forecast/forecast-input';
import { projectLaterDoses } from 'utils/lib/immunization-forecast/projections';
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
const forecastInput = buildForecastInput({ dob: DOB, sex: 'female', asOf: AS_OF }, immunizations, marks);
const forecast = forecastImmunizations(forecastInput);
const fixture: GetImmunizationForecastResponse = {
  dob: DOB,
  immunizations,
  marks,
  cvxGroups: {},
  forecast,
  projections: projectLaterDoses(forecastInput, forecast),
};

describe('ImmunizationTimeline', () => {
  beforeEach(() => {
    saveMutate.mockReset();
    clearMutate.mockReset();
  });

  it('puts "Today" above the age scale and leaves room left of age 0 for a birth dose', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    expect(screen.getByText('Today')).toHaveStyle({ top: '0px' });
    expect(screen.getByText('4m')).toHaveStyle({ top: '18px' });
    const birthDose = within(screen.getByTestId('immunization-lane-hepb')).getByRole('button', {
      name: 'Hep B dose 1',
    });
    expect(birthDose.parentElement).toHaveStyle({ marginLeft: '16px' });
  });

  it('names the next-dose bars "Allowed but early" and "Recommended" in the legend', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    expect(screen.getByText(/Allowed but early/)).toBeInTheDocument();
    expect(screen.getByText(/^\s*Recommended$/)).toBeInTheDocument();
    expect(screen.queryByText(/Earliest to recommended|Recommended to past due/)).not.toBeInTheDocument();
  });

  it('draws later doses in outline, opens on a range wide enough for them, and explains them on click', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    expect(screen.getByRole('button', { name: '0–7 y' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Later doses (if each is given on time)')).toBeInTheDocument();
    const polio = screen.getByTestId('immunization-lane-ipv');
    const later = within(polio).getAllByRole('button', { name: /^Polio dose 3 \(projected\): recommended / });
    expect(later.length).toBeGreaterThan(0);
    for (const bar of later) expect(bar).toHaveStyle({ background: 'transparent' });
    fireEvent.click(later[0]);
    expect(
      screen.getAllByText(/^Polio dose 3 \(projected\): recommended .*, if dose 2 is given on time\.$/).length
    ).toBeGreaterThan(0);
  });

  it('numbers the next dose and each later dose in the same dashed gray circle, above the bars', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    const pcv = screen.getByTestId('immunization-lane-pcv');
    const next = within(pcv).getByRole('button', { name: /^PCV.* dose 2 \(next\)$/ });
    expect(next).toHaveTextContent('2');
    expect(next).toHaveStyle({ border: '2px dashed #8A96A3', backgroundColor: '#fff', zIndex: '3' });
    const later = within(pcv).getByRole('button', { name: /^PCV.* dose 3 \(projected\)$/ });
    expect(later).toHaveTextContent('3');
    expect(later).toHaveStyle({ border: '2px dashed #8A96A3', backgroundColor: '#fff', zIndex: '3' });
    // given-dose dots stay distinct: filled navy, under the numbers
    expect(within(pcv).getByRole('button', { name: /dose 1$/ })).not.toHaveStyle({ backgroundColor: '#fff' });
  });

  it('hovering a dose-number circle or a given-dose dot shows the same details as clicking it', async () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    const pcv = screen.getByTestId('immunization-lane-pcv');
    const details = screen.getByTestId('immunization-timeline-details');
    for (const name of [/^PCV.* dose 2 \(next\)$/, /^PCV.* dose 3 \(projected\)$/, /^PCV.* dose 1$/]) {
      const target = within(pcv).getByRole('button', { name });
      fireEvent.mouseOver(target);
      const tooltip = await screen.findByRole('tooltip');
      fireEvent.click(target);
      expect(tooltip.textContent).toBe(details.textContent);
      fireEvent.mouseLeave(target);
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    }
    // the next dose's hover carries the full window, not a one-line summary
    fireEvent.mouseOver(within(pcv).getByRole('button', { name: /^PCV.* dose 2 \(next\)$/ }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/Earliest: .* · Recommended: .* · Past due:/);
  });

  it('hovering a bar says in one short line what it means for the dose', async () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    const pcv = screen.getByTestId('immunization-lane-pcv');
    const bar = within(pcv).getByRole('button', { name: /^Dose 2: recommended / });
    fireEvent.mouseOver(bar);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^PCV.* dose 2 window: \d\d\/\d\d\/\d{4} – \d\d\/\d\d\/\d{4}$/
    );
    expect(bar.tagName).toBe('BUTTON'); // still opens the details on click
  });

  it('renders one lane per vaccine group with its status icon, doses, undated dose and mark', async () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    for (const group of fixture.forecast.groups) {
      expect(screen.getByTestId(`immunization-lane-${group.group}`)).toBeInTheDocument();
    }
    const dtap = screen.getByTestId('immunization-lane-dtap');
    expect(within(dtap).getByRole('button', { name: 'DTaP/Tdap/Td dose 1' })).toBeInTheDocument();
    fireEvent.mouseOver(within(dtap).getByRole('button', { name: 'Exception for DTaP/Tdap/Td' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Due today: the next dose is in its recommended period. Click to add an exception.'
    );
    // a lane with an exception shows it, with who recorded it
    fireEvent.mouseOver(
      within(screen.getByTestId('immunization-lane-rota')).getByRole('button', { name: 'Exception for Rotavirus' })
    );
    expect(
      await screen.findByText(/^Declined 11\/10\/2026 · recorded by J\. Nurse\. Click to change or clear\.$/)
    ).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Rotavirus exception' }));
    expect(
      screen.getByText(
        /Declined 11\/10\/2026 · recorded by J\. Nurse; Contraindicated 09\/09\/2026 · recorded by Dr\. Patel, cleared 10\/01\/2026 by J\. Nurse/
      )
    ).toBeInTheDocument();
  });

  it('Exception → Declined saves the mark through the hook, with the optional note', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    fireEvent.click(screen.getByRole('button', { name: 'Exception for Hep B' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Immune', 'Contraindicated', 'Declined']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Declined' }));
    expect(screen.getByText('Hep B exception: Declined')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '  Parent declined  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(saveMutate).toHaveBeenCalledWith({
      patientId: 'maya',
      vaccineGroup: 'hepb',
      mark: 'declined',
      note: 'Parent declined',
    });
  });

  it('the exception menu checks the current exception and offers Clear, which clears it through the hook', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    fireEvent.click(screen.getByRole('button', { name: 'Exception for Rotavirus' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Immune', 'Contraindicated', 'Declined', 'Clear']);
    expect(
      within(within(menu).getByRole('menuitem', { name: 'Declined' })).getByTestId('CheckIcon')
    ).toBeInTheDocument();
    expect(within(within(menu).getByRole('menuitem', { name: 'Immune' })).queryByTestId('CheckIcon')).toBeNull();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Clear' }));
    expect(clearMutate).toHaveBeenCalledWith({ markId: 'mark-rota' });
  });

  it('keys all nine icons and freezes the icon + name column while the plot scrolls sideways', () => {
    render(<ImmunizationTimelineContainer patientId="maya" />);
    const key = screen.getByTestId('immunization-status-key');
    expect(key.querySelectorAll('svg')).toHaveLength(9);
    for (const label of [
      'Up to date',
      'Complete',
      'Due today',
      'Past due',
      'Not yet due',
      'Not routine',
      'Declined',
      'Contraindicated',
      'Immune',
    ]) {
      expect(within(key).getByText(new RegExp(`^\\s*${label}$`))).toBeInTheDocument();
    }
    expect(screen.getByTestId('immunization-timeline-scroll')).toHaveStyle({ overflowX: 'auto' });
    const icon = screen.getByRole('button', { name: 'Exception for PCV' });
    expect(icon.parentElement).toHaveStyle({ position: 'sticky', left: '0px', zIndex: '4', width: '170px' });
    expect(icon.nextElementSibling).toHaveTextContent(/^PCV/);
  });

  it('hides Exception and Clear in a read-only context', () => {
    render(<ImmunizationTimelineContainer patientId="maya" readOnly />);
    expect(screen.queryByRole('button', { name: /^Exception for / })).not.toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /^Rotavirus: Declined/ }).length).toBe(1);
    expect(screen.getByTestId('immunization-lane-rota')).toBeInTheDocument();
  });
});
