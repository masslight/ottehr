import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS (must precede component imports)
// ============================================================================

// useVitalsManagement is NOT mocked — real hook is used throughout so both
// banner tests and draft-restore tests share the same module setup.

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

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    resources: { appointment: { id: 'appt-1' }, encounter: { id: 'enc-pv-test' } },
    isAppointmentLoading: false,
    appointmentError: null,
  }),
  useChartData: () => ({ isChartDataLoading: false, chartDataError: null }),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('src/features/visits/in-person/context/InPersonNavigationContext', () => ({
  useInPersonNavigationContext: () => ({ interactionMode: 'main' }),
}));

vi.mock('src/features/visits/shared/components/PageTitle', () => ({
  PageTitle: () => <div data-testid="page-title" />,
}));

vi.mock('src/features/visits/shared/components/Loader', () => ({
  Loader: () => <div data-testid="loader" />,
}));

vi.mock('src/features/visits/shared/components/patient-info/VitalsNotesCard', () => ({
  default: () => <div />,
}));

vi.mock('src/features/visits/shared/components/vitals/AbnormalVitalsModal', () => ({
  AbnormalVitalsModal: () => <div />,
}));

vi.mock('src/features/visits/shared/components/vitals/bmi/VitalsBMICard', () => ({
  default: () => <div />,
}));

// Vital card stubs expose field.hasData for draft-restore assertions.
vi.mock('src/features/visits/shared/components/vitals/temperature/VitalsTemperaturesCard', () => ({
  default: ({ field }: any) => <div data-testid="temperature-card" data-has-data={String(field.hasData)} />,
}));
vi.mock('src/features/visits/shared/components/vitals/heartbeat/VitalsHeartbeatCard', () => ({
  default: ({ field }: any) => <div data-testid="heartbeat-card" data-has-data={String(field.hasData)} />,
}));
vi.mock('src/features/visits/shared/components/vitals/respiration-rate/VitalsRespirationRateCard', () => ({
  default: ({ field }: any) => <div data-testid="respiration-rate-card" data-has-data={String(field.hasData)} />,
}));
vi.mock('src/features/visits/shared/components/vitals/blood-pressure/VitalsBloodPressureCard', () => ({
  default: ({ field }: any) => <div data-testid="blood-pressure-card" data-has-data={String(field.hasData)} />,
}));
vi.mock('src/features/visits/shared/components/vitals/oxygen-saturation/VitalsOxygenSatCard', () => ({
  default: ({ field }: any) => <div data-testid="oxygen-sat-card" data-has-data={String(field.hasData)} />,
}));
vi.mock('src/features/visits/shared/components/vitals/weights/VitalsWeightsCard', () => ({
  default: ({ field }: any) => <div data-testid="weight-card" data-has-data={String(field.hasData)} />,
}));
vi.mock('src/features/visits/shared/components/vitals/heights/VitalsHeightCard', () => ({
  default: ({ field }: any) => <div data-testid="height-card" data-has-data={String(field.hasData)} />,
}));
vi.mock('src/features/visits/shared/components/vitals/vision/VitalsVisionCard', () => ({
  default: ({ field }: any) => <div data-testid="vision-card" data-has-data={String(field.hasData)} />,
}));
vi.mock('src/features/visits/shared/components/vitals/last-menstrual-period/VitalsLastMenstrualPeriodCard', () => ({
  default: ({ field }: any) => <div data-testid="lmp-card" data-has-data={String(field.hasData)} />,
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { VitalFieldNames, VitalsHeartbeatObservationDTO, VitalsTemperatureObservationDTO } from 'utils';
import { PatientVitals } from '../../src/features/visits/in-person/pages/PatientVitals';
import { useVitalsManagement } from '../../src/features/visits/shared/components/vitals/hooks/useVitalsManagement';
import { useVitalsDraftStore } from '../../src/state/draft-data.store';

// ============================================================================
// FIXTURES
// ============================================================================

const ENCOUNTER_ID = 'enc-pv-test';

const wrapper: FC<{ children: ReactNode }> = ({ children }) => <BrowserRouter>{children}</BrowserRouter>;

const changeEvent = (value: string): React.ChangeEvent<HTMLInputElement> =>
  ({ target: { value } }) as React.ChangeEvent<HTMLInputElement>;

const temperatureDraft: VitalsTemperatureObservationDTO = {
  field: VitalFieldNames.VitalTemperature,
  value: 37.5,
};

// ============================================================================
// TESTS
// ============================================================================

describe('PatientVitals', () => {
  beforeEach(() => {
    useVitalsDraftStore.setState({ draftsByEncounterId: {} });
    vi.clearAllMocks();
  });

  describe('UnsavedDraftWarning banner', () => {
    it('does not show the banner when the draft store is empty', () => {
      render(<PatientVitals />, { wrapper });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the banner when the draft has temperature data', () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, { temperature: temperatureDraft });

      render(<PatientVitals />, { wrapper });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows the in-progress message when the user has not navigated away', () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, { temperature: temperatureDraft });

      render(<PatientVitals />, { wrapper });

      expect(screen.getByRole('alert')).toHaveTextContent('You have vitals in progress');
    });

    it('shows the restored message when the user previously navigated away', () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, {
        temperature: temperatureDraft,
        hasNavigatedAway: true,
      });

      render(<PatientVitals />, { wrapper });

      expect(screen.getByRole('alert')).toHaveTextContent('previously entered data has been restored');
    });

    it('does not show the banner when only hasNavigatedAway is set and no vital keys exist', () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, { hasNavigatedAway: true });

      render(<PatientVitals />, { wrapper });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('draft restore', () => {
    it('banner is visible when the draft store has vital data', async () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, { temperature: temperatureDraft });

      render(<PatientVitals />, { wrapper });

      await act(async () => {});

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('vital card receives hasData: true after hydration from a temperature draft', async () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, {
        temperature: { field: VitalFieldNames.VitalTemperature, value: 38.1 } as VitalsTemperatureObservationDTO,
      });

      render(<PatientVitals />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('temperature-card')).toHaveAttribute('data-has-data', 'true');
      });
    });

    it('vital card receives hasData: true for each vital key seeded in the draft', async () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, {
        temperature: { field: VitalFieldNames.VitalTemperature, value: 37 } as VitalsTemperatureObservationDTO,
        heartbeat: { field: VitalFieldNames.VitalHeartbeat, value: 72 } as VitalsHeartbeatObservationDTO,
      });

      render(<PatientVitals />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('temperature-card')).toHaveAttribute('data-has-data', 'true');
        expect(screen.getByTestId('heartbeat-card')).toHaveAttribute('data-has-data', 'true');
      });
    });

    it('vital cards without a draft key remain hasData: false', async () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, {
        temperature: { field: VitalFieldNames.VitalTemperature, value: 37 } as VitalsTemperatureObservationDTO,
      });

      render(<PatientVitals />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('temperature-card')).toHaveAttribute('data-has-data', 'true');
      });

      expect(screen.getByTestId('heartbeat-card')).toHaveAttribute('data-has-data', 'false');
    });

    it('clicking Clear all removes the banner and resets vital card hasData', async () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, {
        temperature: { field: VitalFieldNames.VitalTemperature, value: 37 } as VitalsTemperatureObservationDTO,
      });
      const user = userEvent.setup();

      render(<PatientVitals />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('temperature-card')).toHaveAttribute('data-has-data', 'true');
      });

      await user.click(screen.getByRole('button', { name: /clear all/i }));

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByTestId('temperature-card')).toHaveAttribute('data-has-data', 'false');
      });
    });
  });

  describe('useVitalsManagement — draft behavior', () => {
    const HOOK_ENCOUNTER_ID = 'enc-draft-test';

    describe('handler writes to draft store', () => {
      it('writes temperature to draft when celsius input changes', () => {
        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        act(() => {
          result.current.fields.temperature.localState.handleCelsiusChange(changeEvent('37.5'));
        });

        const draft = useVitalsDraftStore.getState().getDraft(HOOK_ENCOUNTER_ID);
        expect(draft.temperature).toMatchObject<Partial<VitalsTemperatureObservationDTO>>({
          field: VitalFieldNames.VitalTemperature,
          value: 37.5,
        });
      });

      it('writes heartbeat to draft when value input changes', () => {
        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        act(() => {
          result.current.fields.heartbeat.localState.handleValueChange(changeEvent('72'));
        });

        const draft = useVitalsDraftStore.getState().getDraft(HOOK_ENCOUNTER_ID);
        expect(draft.heartbeat).toMatchObject<Partial<VitalsHeartbeatObservationDTO>>({
          field: VitalFieldNames.VitalHeartbeat,
          value: 72,
        });
      });

      it('clears the draft entry when a field is cleared back to empty', () => {
        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        act(() => {
          result.current.fields.temperature.localState.handleCelsiusChange(changeEvent('37.5'));
        });
        act(() => {
          result.current.fields.temperature.localState.handleCelsiusChange(changeEvent(''));
        });

        expect(useVitalsDraftStore.getState().getDraft(HOOK_ENCOUNTER_ID).temperature).toBeUndefined();
      });

      it('does not affect sibling vital draft keys when one vital changes', () => {
        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        act(() => {
          result.current.fields.heartbeat.localState.handleValueChange(changeEvent('60'));
        });
        act(() => {
          result.current.fields.temperature.localState.handleCelsiusChange(changeEvent('38'));
        });

        const draft = useVitalsDraftStore.getState().getDraft(HOOK_ENCOUNTER_ID);
        expect(draft.heartbeat?.value).toBe(60);
        expect(draft.temperature?.value).toBe(38);
      });
    });

    describe('onClearForm', () => {
      it('clears the temperature draft entry and resets form state', () => {
        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        act(() => {
          result.current.fields.temperature.localState.handleCelsiusChange(changeEvent('38'));
        });
        expect(useVitalsDraftStore.getState().getDraft(HOOK_ENCOUNTER_ID).temperature).toBeDefined();
        expect(result.current.fields.temperature.hasData).toBe(true);

        act(() => {
          result.current.fields.temperature.onClearForm?.();
        });

        expect(useVitalsDraftStore.getState().getDraft(HOOK_ENCOUNTER_ID).temperature).toBeUndefined();
        expect(result.current.fields.temperature.hasData).toBe(false);
      });

      it('does not clear sibling vital draft keys when one vital is cleared', () => {
        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        act(() => {
          result.current.fields.temperature.localState.handleCelsiusChange(changeEvent('37'));
          result.current.fields.heartbeat.localState.handleValueChange(changeEvent('80'));
        });

        act(() => {
          result.current.fields.temperature.onClearForm?.();
        });

        const draft = useVitalsDraftStore.getState().getDraft(HOOK_ENCOUNTER_ID);
        expect(draft.temperature).toBeUndefined();
        expect(draft.heartbeat?.value).toBe(80);
      });
    });

    describe('clearAllDrafts', () => {
      it('resets all vital form states', () => {
        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        act(() => {
          result.current.fields.temperature.localState.handleCelsiusChange(changeEvent('37'));
          result.current.fields.heartbeat.localState.handleValueChange(changeEvent('80'));
        });
        expect(result.current.fields.temperature.hasData).toBe(true);
        expect(result.current.fields.heartbeat.hasData).toBe(true);

        act(() => {
          result.current.clearAllDrafts();
        });

        expect(result.current.fields.temperature.hasData).toBe(false);
        expect(result.current.fields.heartbeat.hasData).toBe(false);
      });

      it('removes the draft store entry entirely', () => {
        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        act(() => {
          result.current.fields.temperature.localState.handleCelsiusChange(changeEvent('37'));
        });
        expect(useVitalsDraftStore.getState().hasDraft(HOOK_ENCOUNTER_ID)).toBe(true);

        act(() => {
          result.current.clearAllDrafts();
        });

        expect(useVitalsDraftStore.getState().hasDraft(HOOK_ENCOUNTER_ID)).toBe(false);
      });
    });

    describe('draft hydration on mount', () => {
      it('restores temperature form state from a pre-existing draft', async () => {
        useVitalsDraftStore.getState().setDraft(HOOK_ENCOUNTER_ID, {
          temperature: { field: VitalFieldNames.VitalTemperature, value: 37.5 } as VitalsTemperatureObservationDTO,
        });

        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        await act(async () => {});

        expect(result.current.fields.temperature.localState.valueCelsius).toBe('37.5');
        expect(result.current.fields.temperature.hasData).toBe(true);
      });

      it('restores heartbeat form state from a pre-existing draft', async () => {
        useVitalsDraftStore.getState().setDraft(HOOK_ENCOUNTER_ID, {
          heartbeat: { field: VitalFieldNames.VitalHeartbeat, value: 68 } as VitalsHeartbeatObservationDTO,
        });

        const { result } = renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        await act(async () => {});

        expect(result.current.fields.heartbeat.localState.value).toBe('68');
        expect(result.current.fields.heartbeat.hasData).toBe(true);
      });

      it('does not write back to the draft store during hydration', async () => {
        useVitalsDraftStore.getState().setDraft(HOOK_ENCOUNTER_ID, {
          temperature: { field: VitalFieldNames.VitalTemperature, value: 36.6 } as VitalsTemperatureObservationDTO,
        });

        renderHook(() => useVitalsManagement({ encounterId: HOOK_ENCOUNTER_ID }));

        await act(async () => {});

        const draft = useVitalsDraftStore.getState().getDraft(HOOK_ENCOUNTER_ID);
        expect(Object.keys(draft).filter((k) => k !== 'temperature')).toHaveLength(0);
      });
    });
  });
});
