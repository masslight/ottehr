import { fireEvent, render, screen } from '@testing-library/react';
import { BirthHistoryDTO } from 'utils/lib/types/api/birth-history.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import VitalsBirthHistoryCard from '../../src/features/visits/shared/components/vitals/birth-history/VitalsBirthHistoryCard';

// The saved birth history; a save stores the value, re-renders its readers and reports success, as React Query would.
const store = vi.hoisted(() => ({
  saved: undefined as BirthHistoryDTO | undefined,
  listeners: new Set<() => void>(),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/hooks/useBirthHistory', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void): (() => void) => {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  };
  return {
    useBirthHistory: () => ({
      data: { birthHistory: useSyncExternalStore(subscribe, () => store.saved) },
      isLoading: false,
    }),
    useSaveBirthHistory: () => ({
      isPending: false,
      mutate: (value: BirthHistoryDTO, options: { onSuccess: () => void }) => {
        store.saved = { ...value, resourceId: 'obs-1' };
        store.listeners.forEach((listener) => listener());
        options.onSuccess();
      },
    }),
  };
});
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

describe('Birth history card: after Save', () => {
  beforeEach(() => {
    store.saved = undefined;
  });
  // The summary shows in the header always and in the body only while the card is open.
  const saveWeeks = (collapsedByDefault: boolean): number => {
    render(<VitalsBirthHistoryCard collapsedByDefault={collapsedByDefault} />);
    if (collapsedByDefault) fireEvent.click(screen.getByText('Birth history'));
    fireEvent.change(weeksInput(), { target: { value: '38' } });
    fireEvent.click(saveButton());
    return screen.getAllByText('38 wk').length;
  };

  it('under 24 months the card stays open', () => {
    expect(saveWeeks(false)).toBe(2);
  });

  it('from 24 months the card collapses to its summary', () => {
    expect(saveWeeks(true)).toBe(1);
  });
});
