import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { describe, expect, it, vi } from 'vitest';
import { Flowsheets } from '../../src/features/flowsheets/components/Flowsheets';
import { VisitFlowsheets } from '../../src/features/flowsheets/pages/VisitFlowsheets';

const time = '2026-07-13T14:00:00.000Z';
const visits: FlowsheetVisit[] = [
  {
    start: time,
    isFollowUp: false,
    reason: '',
    primaryDiagnosis: '',
    attending: '',
    values: { weight: { time, value: 5.8, readings: [{ time, value: 5.8 }] } },
  },
];
// The practice setting (Admin › Progress Note › "Vitals display units in visit header").
let practiceSetting: VitalsHeaderUnitSystem = 'imperial';

vi.mock('src/api/api', () => ({}));
vi.mock('src/hooks/useGetFlowsheet', () => ({
  useGetFlowsheet: () => ({ data: { visits }, isLoading: false, error: null }),
}));
vi.mock('src/hooks/useServiceCategoryAbbreviation', () => ({
  useServiceCategoryAbbreviationResolver: () => () => undefined,
}));
vi.mock('src/features/visits/shared/components/vitals/hooks/useVitalsHeaderUnitSystem', () => ({
  useVitalsHeaderUnitSystem: () => practiceSetting,
}));
vi.mock('src/features/report-builder/runtime/components/EChart', () => ({ EChart: () => null }));
// The house title needs the app theme; its actions are what is under test.
vi.mock('src/features/visits/shared/components/PageTitle', () => ({
  PageTitle: ({ label, actions }: { label: string; actions?: React.ReactNode }) => (
    <div>
      {label}
      {actions}
    </div>
  ),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    resources: { appointment: { id: 'a1', start: time }, patient: { id: 'p1', birthDate: '2026-01-13' } },
    isAppointmentLoading: false,
    appointmentError: null,
  }),
}));

const pressed = (name: string): string | null => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('Flowsheets Metric/Imperial switch', () => {
  it('on the patient record: opens on the practice setting and switches the rows, titles and charts', async () => {
    practiceSetting = 'imperial';
    render(
      <MemoryRouter>
        <Flowsheets patientId="p1" title="Flowsheets" />
      </MemoryRouter>
    );
    expect([pressed('Metric'), pressed('Imperial')]).toEqual(['false', 'true']);
    // The Vitals tab (patient over 20 years is not set, so Growth opens; Vitals has a weight chart).
    await userEvent.click(screen.getByRole('tab', { name: 'Vitals' }));
    expect(screen.getAllByText('Weight (lbs)').length).toBeGreaterThan(0);
    expect(screen.getByText('12.79')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Metric' }));
    expect(screen.queryByText('Weight (lbs)')).not.toBeInTheDocument();
    // The grid row and the trend chart's card both read kg.
    expect(screen.getAllByText('Weight (kg)')).toHaveLength(2);
    expect(screen.getByText('5.80')).toBeInTheDocument();
  });

  it('is not remembered: the flowsheet opens on the practice setting again', async () => {
    practiceSetting = 'metric';
    const { unmount } = render(
      <MemoryRouter>
        <Flowsheets patientId="p1" title="Flowsheets" />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Imperial' }));
    expect(pressed('Imperial')).toBe('true');
    unmount();
    render(
      <MemoryRouter>
        <Flowsheets patientId="p1" title="Flowsheets" />
      </MemoryRouter>
    );
    expect([pressed('Metric'), pressed('Imperial')]).toEqual(['true', 'false']);
  });

  it('on the visit Flowsheets screen: sits beside "Up to this visit / All visits" and switches the grid', async () => {
    practiceSetting = 'metric';
    render(
      <MemoryRouter>
        <VisitFlowsheets />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Up to this visit' })).toBeInTheDocument();
    expect([pressed('Metric'), pressed('Imperial')]).toEqual(['true', 'false']);
    expect(screen.getByText('Weight (kg)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Imperial' }));
    expect(screen.getByText('Weight (lbs)')).toBeInTheDocument();
    expect(screen.getByText('12.79')).toBeInTheDocument();
  });
});
