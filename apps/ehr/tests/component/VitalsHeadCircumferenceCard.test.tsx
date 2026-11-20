import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const visit = vi.hoisted(() => ({
  birthDate: undefined as string | undefined,
  start: '2026-06-15T14:00:00.000Z',
  current: [] as unknown[],
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'appointment-1' }) };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('src/api/api', () => ({ uploadDotVisionDocument: vi.fn() }));

vi.mock('src/features/visits/shared/components/vitals/hooks/useGetVitals', () => ({
  useGetVitals: () => ({
    data: { 'vital-head-circumference': visit.current },
    isLoading: false,
    refetch: vi.fn().mockResolvedValue({}),
  }),
  useGetHistoricalVitals: () => ({ data: undefined }),
}));

vi.mock('src/features/visits/shared/components/vitals/hooks/useSaveVitals', () => ({
  useSaveVitals: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock('src/features/visits/shared/components/vitals/hooks/useBatchSaveVitals', () => ({
  useBatchSaveVitals: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock('src/features/visits/shared/components/vitals/hooks/useDeleteVitals', () => ({
  useDeleteVitals: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock('src/hooks/useProgressNoteConfig', () => ({
  useProgressNoteConfig: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    resources: {
      appointment: { id: 'appt-1', start: visit.start },
      encounter: { id: 'enc-hc-test' },
      patient: visit.birthDate ? { id: 'patient-1', birthDate: visit.birthDate } : undefined,
    },
  }),
}));

import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { dataTestIds } from '../../src/constants/data-test-ids';
import VitalsHeadCircumferenceCard from '../../src/features/visits/shared/components/vitals/head-circumference/VitalsHeadCircumferenceCard';
import { useVitalsManagement } from '../../src/features/visits/shared/components/vitals/hooks/useVitalsManagement';
import { useVitalsDraftStore } from '../../src/state/draft-data.store';

const Harness: FC = () => {
  const vitals = useVitalsManagement({ encounterId: 'enc-hc-test' });
  return <VitalsHeadCircumferenceCard field={vitals.fields.headCircumference} />;
};

const cmInput = (): HTMLElement | null => screen.queryByTestId(dataTestIds.vitalsPage.headCircumferenceInput);

describe('VitalsHeadCircumferenceCard', () => {
  beforeEach(() => {
    useVitalsDraftStore.setState({ draftsByEncounterId: {} });
    visit.birthDate = undefined;
    visit.current = [];
  });

  it('starts open for a patient under 24 months at the visit', () => {
    visit.birthDate = '2024-06-16';
    render(<Harness />);
    expect(cmInput()).toBeInTheDocument();
  });

  it('starts collapsed for a patient 24 months or older at the visit, and staff can open it', async () => {
    visit.birthDate = '2024-06-15';
    render(<Harness />);
    expect(cmInput()).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(/^Head circumference \(cm\)/));
    expect(cmInput()).toBeInTheDocument();
  });

  it('starts open for an older patient when a draft was restored into it', async () => {
    visit.birthDate = '2020-01-01';
    useVitalsDraftStore.getState().setDraft('enc-hc-test', {
      headCircumference: { field: VitalFieldNames.VitalHeadCircumference, value: 50.2 },
    });
    render(<Harness />);

    expect(await screen.findByDisplayValue('50.2')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId(dataTestIds.vitalsPage.headCircumferenceAddButton));
    await waitFor(() => expect(cmInput()?.querySelector('input')).toHaveValue(null));
    expect(cmInput()).toBeInTheDocument();
  });

  it('counts the age at the visit, not today', () => {
    visit.birthDate = '2024-07-15';
    visit.start = '2026-06-15T14:00:00.000Z';
    render(<Harness />);
    expect(cmInput()).toBeInTheDocument();
  });

  it('starts open when the birth date is unknown', () => {
    render(<Harness />);
    expect(cmInput()).toBeInTheDocument();
  });

  it('fills inches from cm and cm from inches', async () => {
    render(<Harness />);
    const inches = screen.getByTestId(dataTestIds.vitalsPage.headCircumferenceInchesInput).querySelector('input')!;
    const cm = cmInput()!.querySelector('input')!;

    await userEvent.type(cm, '43.8');
    expect(inches).toHaveValue(17.24);

    await userEvent.clear(inches);
    await userEvent.type(inches, '17');
    expect(cm).toHaveValue(43.2);
  });

  it('shows the latest reading in the header and both units in the history', () => {
    visit.current = [
      {
        field: 'vital-head-circumference',
        value: 43.8,
        resourceId: 'obs-1',
        authorName: 'Daniel Cohen',
        lastUpdated: '2026-06-15T14:39:00.000Z',
      },
    ];
    render(<Harness />);

    expect(screen.getByText('Head circumference (cm) 43.8')).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vitalsPage.headCircumferenceItem)).toHaveTextContent('43.8 cm ≈ 17.24 in');
  });
});
