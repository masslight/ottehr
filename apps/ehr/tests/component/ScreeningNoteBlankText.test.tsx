import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import AskThePatient from 'src/features/visits/in-person/components/screening/AskThePatient';
import { useScreeningQuestionsHandler } from 'src/features/visits/in-person/components/screening/useScreeningQuestionsHandler';
import {
  HISTORY_OBTAINED_FROM_FIELD,
  HistorySourceKeys,
  PATIENT_VACCINATION_STATUS,
  PatientVaccinationKeys,
} from 'utils/lib/types/data/screening-questions/constants';
import { ObservationDTO } from 'utils/lib/types/data/screening-questions/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveChartData = vi.fn(async () => ({ chartData: { observations: [] } }));
let chartObservations: ObservationDTO[] = [];

vi.mock('src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({
    chartData: { observations: chartObservations },
    updateObservation: vi.fn(),
    chartDataSetState: vi.fn(),
    isChartDataLoading: false,
  }),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({ saveChartData }),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'enc-1' } }),
  useDeleteChartData: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (fn: () => void) => fn(), clear: vi.fn() }),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const existingHistory = {
  field: HISTORY_OBTAINED_FROM_FIELD,
  value: HistorySourceKeys.NotObtainedOther,
  note: 'Patient is nonverbal',
  resourceId: 'obs-history',
} as ObservationDTO;

const existingVaccination = {
  field: PATIENT_VACCINATION_STATUS,
  value: PatientVaccinationKeys.partially,
  resourceId: 'obs-vaccination',
} as ObservationDTO;

const renderHandler = (
  currentFormValues: Record<string, string>,
  current?: ObservationDTO
): {
  handleFieldChange: (fieldId: string, value: string) => void;
  saveObservation: ReturnType<typeof vi.fn>;
  deleteObservation: ReturnType<typeof vi.fn>;
} => {
  const saveObservation = vi.fn(async () => undefined);
  const deleteObservation = vi.fn(async () => undefined);
  const { result } = renderHook(() =>
    useScreeningQuestionsHandler({
      debounce: (fn) => fn(),
      currentFormValues,
      saveObservation,
      deleteObservation,
      getUiData: () => current,
    })
  );
  return { handleFieldChange: result.current.handleFieldChange, saveObservation, deleteObservation };
};

beforeEach(() => {
  vi.clearAllMocks();
  chartObservations = [];
});

describe('useScreeningQuestionsHandler - blank note', () => {
  it.each([' ', '\n', ' \n '])(
    'deletes the history answer instead of saving the reason %j on its own',
    async (reason) => {
      const { handleFieldChange, saveObservation, deleteObservation } = renderHandler(
        { history_source: 'not_due_developmental' },
        existingHistory
      );

      await act(async () => handleFieldChange('history_reason', reason));

      expect(deleteObservation).toHaveBeenCalledWith(existingHistory, 'history_reason');
      expect(saveObservation).not.toHaveBeenCalled();
    }
  );

  it('saves nothing for a whitespace-only reason when no history answer exists yet', async () => {
    const { handleFieldChange, saveObservation, deleteObservation } = renderHandler({
      history_source: 'not_due_developmental',
    });

    await act(async () => handleFieldChange('history_reason', '  '));

    expect(saveObservation).not.toHaveBeenCalled();
    expect(deleteObservation).not.toHaveBeenCalled();
  });

  it.each([' ', '\n'])('saves the vaccination answer without a note for the whitespace-only note %j', async (note) => {
    const { handleFieldChange, saveObservation } = renderHandler({ vaccinations: 'partially' }, existingVaccination);

    await act(async () => handleFieldChange('vaccination_notes', note));

    expect(saveObservation).toHaveBeenCalledWith(
      { ...existingVaccination, value: PatientVaccinationKeys.partially, note: undefined },
      'vaccination_notes'
    );
  });

  it('saves a non-blank vaccination note exactly as typed', async () => {
    const { handleFieldChange, saveObservation } = renderHandler({ vaccinations: 'partially' }, existingVaccination);

    await act(async () => handleFieldChange('vaccination_notes', ' Missing MMR\nbooster '));

    expect(saveObservation).toHaveBeenCalledWith(
      { ...existingVaccination, value: PatientVaccinationKeys.partially, note: ' Missing MMR\nbooster ' },
      'vaccination_notes'
    );
  });
});

describe('AskThePatient - blank vaccination note', () => {
  it('does not resend a whitespace-only note when the vaccination answer changes', async () => {
    chartObservations = [existingVaccination];
    render(<AskThePatient />);

    const notes = await screen.findByRole('textbox', { name: 'Vaccination notes' });
    fireEvent.change(notes, { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('radio', { name: 'No vaccinations' }));

    await waitFor(() => expect(saveChartData).toHaveBeenCalledTimes(2));
    const sentObservations = saveChartData.mock.calls.flatMap(
      (call) => (call as unknown as [{ observations: ObservationDTO[] }])[0].observations
    );
    expect(sentObservations.at(-1)).toMatchObject({
      field: PATIENT_VACCINATION_STATUS,
      value: PatientVaccinationKeys.no,
    });
    sentObservations.forEach((observation) => expect('note' in observation && observation.note).toBeFalsy());
  });
});
