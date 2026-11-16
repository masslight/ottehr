import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The visit the card reads the patient's age from; each test sets it before rendering.
const visit = vi.hoisted(() => ({ birthDate: undefined as string | undefined, start: '2026-06-15T14:00:00.000Z' }));

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
  useGetVitals: () => ({ data: undefined, isLoading: false, refetch: vi.fn().mockResolvedValue({}) }),
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

// The unit input order (cm/inches) comes from the progress note config, a react-query hook; the default order is fine.
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

vi.mock('src/features/visits/shared/components/vitals/components/VitalsHistoryContainer', () => ({
  default: () => <div />,
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import VitalsHeadCircumferenceCard from '../../src/features/visits/shared/components/vitals/head-circumference/VitalsHeadCircumferenceCard';
import { useVitalsManagement } from '../../src/features/visits/shared/components/vitals/hooks/useVitalsManagement';
import { useVitalsDraftStore } from '../../src/state/draft-data.store';

const Harness: FC = () => {
  const vitals = useVitalsManagement({ encounterId: 'enc-hc-test' });
  return <VitalsHeadCircumferenceCard field={vitals.fields.headCircumference} />;
};

const cmInput = (): HTMLElement | null => screen.queryByTestId(dataTestIds.vitalsPage.headCircumferenceInput);
const openCard = async (): Promise<void> => {
  await userEvent.click(screen.getByText(/^Head circumference \(cm\)/));
};

describe('VitalsHeadCircumferenceCard — default collapse by age', () => {
  beforeEach(() => {
    useVitalsDraftStore.setState({ draftsByEncounterId: {} });
    visit.birthDate = undefined;
  });

  it('starts open for a patient under 24 months at the visit', () => {
    visit.birthDate = '2024-07-01'; // 23.5 months before the visit
    render(<Harness />);
    expect(cmInput()).toBeInTheDocument();
  });

  it('starts collapsed for a patient 24 months or older at the visit, and staff can open it', async () => {
    visit.birthDate = '2024-06-15'; // exactly 24 months before the visit
    render(<Harness />);
    expect(cmInput()).not.toBeInTheDocument();

    await openCard();
    expect(cmInput()).toBeInTheDocument();
  });

  it('counts the age at the visit date, not today', () => {
    // Born 23 months before this 2026 visit; many years before today.
    visit.birthDate = '2024-07-15';
    render(<Harness />);
    expect(cmInput()).toBeInTheDocument();
  });

  it('starts open when the patient or birth date is unknown', () => {
    render(<Harness />);
    expect(cmInput()).toBeInTheDocument();
  });
});
