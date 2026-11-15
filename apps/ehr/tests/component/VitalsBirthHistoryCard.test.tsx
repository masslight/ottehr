import { fireEvent, render, screen } from '@testing-library/react';
import { BirthHistoryDTO } from 'utils/lib/types/api/birth-history.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import VitalsBirthHistoryCard from '../../src/features/visits/shared/components/vitals/birth-history/VitalsBirthHistoryCard';

// The saved birth history; a save stores the value, re-renders its readers and reports success, as React Query would.
const store = vi.hoisted(() => ({
  saved: undefined as BirthHistoryDTO | undefined,
  listeners: new Set<() => void>(),
  locked: false,
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
      mutate: (value: BirthHistoryDTO, options: { onSuccess?: () => void }) => {
        // As save-birth-history does: an empty birth history deletes the saved one.
        store.saved = Object.keys(value).length > 0 ? { ...value, resourceId: 'obs-1' } : undefined;
        store.listeners.forEach((listener) => listener());
        options.onSuccess?.();
      },
    }),
  };
});
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ resources: { patient: { id: 'p1', birthDate: '2026-10-01' } } }),
}));
vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: store.locked }),
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

beforeEach(() => {
  store.locked = false;
});

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

describe('Birth history card: clearing a saved birth history', () => {
  beforeEach(() => {
    store.saved = { resourceId: 'obs-1', gestationalAgeWeeks: 34, gestationalAgeDays: 5 };
  });

  it('Save is enabled with every field emptied, and saving removes it', () => {
    render(<VitalsBirthHistoryCard collapsedByDefault={false} />);
    fireEvent.change(weeksInput(), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('days'), { target: { value: '' } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(store.saved).toBeUndefined();
    // As if none was ever saved: an empty form, and no summary once collapsed.
    expect(weeksInput().value).toBe('');
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(screen.getByText('Birth history'));
    expect(screen.queryByText(/34 wk/)).toBeNull();
  });
});

describe('Birth history card: a saved birth history', () => {
  beforeEach(() => {
    store.saved = { resourceId: 'obs-1', gestationalAgeWeeks: 34, gestationalAgeDays: 5 };
  });

  it('collapsed, the header shows the summary', () => {
    render(<VitalsBirthHistoryCard collapsedByDefault />);
    expect(screen.getByText('34 wk 5 d')).toBeTruthy();
    expect(screen.queryByLabelText('weeks')).toBeNull();
  });

  it('expanded, the body is the form filled with the saved values, with no summary and no Edit', () => {
    render(<VitalsBirthHistoryCard collapsedByDefault={false} />);
    expect(weeksInput().value).toBe('34');
    expect((screen.getByLabelText('days') as HTMLInputElement).value).toBe('5');
    expect(screen.queryByText(/34 wk/)).toBeNull();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });
});

describe('Birth history card: after Save', () => {
  beforeEach(() => {
    store.saved = undefined;
  });
  // The card stays as it was, open with the saved values in the fields and no summary in the header.
  const saveWeeks = (collapsedByDefault: boolean): void => {
    render(<VitalsBirthHistoryCard collapsedByDefault={collapsedByDefault} />);
    if (collapsedByDefault) fireEvent.click(screen.getByText('Birth history'));
    fireEvent.change(weeksInput(), { target: { value: '38' } });
    fireEvent.click(saveButton());
    expect(store.saved?.gestationalAgeWeeks).toBe(38);
    expect(weeksInput().value).toBe('38');
    expect(screen.queryByText('38 wk')).toBeNull();
  };

  it('under 24 months the card stays open', () => {
    saveWeeks(false);
  });

  it('from 24 months the card stays open too, and collapsing it shows the summary', () => {
    saveWeeks(true);
    fireEvent.click(screen.getByText('Birth history'));
    expect(screen.getByText('38 wk')).toBeTruthy();
  });
});

describe('Birth history card: a locked visit', () => {
  beforeEach(() => {
    store.locked = true;
  });

  it('shows the saved values in disabled fields, with no Save', () => {
    store.saved = { resourceId: 'obs-1', gestationalAgeWeeks: 34, gestationalAgeDays: 5 };
    render(<VitalsBirthHistoryCard collapsedByDefault={false} />);
    expect(weeksInput().value).toBe('34');
    expect(weeksInput().disabled).toBe(true);
    expect(screen.queryByTestId(dataTestIds.vitalsPage.birthHistorySaveButton)).toBeNull();
    expect(screen.queryByText(/34 wk/)).toBeNull();
  });

  it('with nothing saved shows "No birth history recorded"', () => {
    store.saved = undefined;
    render(<VitalsBirthHistoryCard collapsedByDefault={false} />);
    expect(screen.getByText('No birth history recorded')).toBeTruthy();
    expect(screen.queryByLabelText('weeks')).toBeNull();
  });
});

describe('Birth history card: the field the server would reject is marked', () => {
  beforeEach(() => {
    store.saved = undefined;
  });
  const marked = (input: HTMLElement): string | null => input.getAttribute('aria-invalid');

  it.each([
    ['birth weight', () => screen.getByLabelText('kg')],
    ['birth length', () => screen.getAllByLabelText('cm')[0]],
    ['birth head circumference', () => screen.getAllByLabelText('cm')[1]],
  ])('a %s of 0 or below', (_name, field) => {
    render(<VitalsBirthHistoryCard collapsedByDefault={false} />);
    fireEvent.change(field(), { target: { value: '0' } });
    expect(marked(field())).toBe('true');
    fireEvent.change(field(), { target: { value: '-2' } });
    expect(marked(field())).toBe('true');
    fireEvent.change(field(), { target: { value: '3' } });
    expect(marked(field())).toBe('false');
  });

  it('days typed with weeks empty marks the days', () => {
    render(<VitalsBirthHistoryCard collapsedByDefault={false} />);
    fireEvent.change(screen.getByLabelText('days'), { target: { value: '3' } });
    expect(marked(screen.getByLabelText('days'))).toBe('true');
    expect(marked(weeksInput())).toBe('false');
  });
});
