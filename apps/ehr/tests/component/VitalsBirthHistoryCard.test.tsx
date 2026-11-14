import { fireEvent, render, screen } from '@testing-library/react';
import { BirthHistoryDTO } from 'utils/lib/types/api/birth-history.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import VitalsBirthHistoryCard from '../../src/features/visits/shared/components/vitals/birth-history/VitalsBirthHistoryCard';

// The saved birth history; a save stores the value and reports success, as the React Query hook would.
const store = vi.hoisted(() => ({ saved: undefined as BirthHistoryDTO | undefined }));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/hooks/useBirthHistory', () => ({
  useBirthHistory: () => ({ data: { birthHistory: store.saved }, isLoading: false }),
  useSaveBirthHistory: () => ({
    isPending: false,
    mutate: (value: BirthHistoryDTO, options: { onSuccess: () => void }) => {
      store.saved = { ...value, resourceId: 'obs-1' };
      options.onSuccess();
    },
  }),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ resources: { patient: { id: 'p1', birthDate: '2026-10-01' } } }),
}));
vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));
vi.mock('src/features/visits/shared/components/vitals/hooks/useVitalsUnitInputOrder', () => ({
  useVitalsUnitInputOrder: () => 'metric-imperial',
}));

const saveButton = (): HTMLButtonElement => screen.getByTestId(dataTestIds.vitalsPage.birthHistorySaveButton);
const hoverText = async (button: HTMLElement): Promise<string | null> => {
  fireEvent.mouseOver(button.parentElement!);
  return (await screen.findByRole('tooltip')).textContent;
};
const weeksInput = (): HTMLInputElement => screen.getByLabelText('weeks');

describe('Birth history card: Save', () => {
  beforeEach(() => {
    store.saved = undefined;
  });

  it('disabled with nothing entered, with the reason on hover', async () => {
    render(<VitalsBirthHistoryCard collapsedByDefault={false} />);
    expect(saveButton().disabled).toBe(true);
    expect(await hoverText(saveButton())).toBe('Enter at least one field');
  });

  it('disabled for a gestational age the server rejects, with the reason on hover', async () => {
    render(<VitalsBirthHistoryCard collapsedByDefault={false} />);
    fireEvent.change(weeksInput(), { target: { value: '50' } });
    expect(saveButton().disabled).toBe(true);
    expect(await hoverText(saveButton())).toBe('Enter gestational age weeks as a whole number from 20 to 45');
  });
});
