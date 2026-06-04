import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The filter inputs pull in API clients, FHIR helpers and stores. We only
// exercise the URL <-> localStorage persistence here, so stub them out.
vi.mock('../../src/components/input/LocationSelectInput', () => ({
  LocationSelectInput: () => <div data-testid="location-input" />,
}));
vi.mock('../../src/components/input/EmployeeSelectInput', () => ({
  EmployeeSelectInput: () => <div data-testid="employee-input" />,
}));
vi.mock('../../src/components/input/SelectInput', () => ({
  SelectInput: () => <div data-testid="select-input" />,
}));
vi.mock('../../src/components/input/DateInput', () => ({
  DateInput: () => <div data-testid="date-input" />,
}));
import AppointmentsFilters, { LOCAL_STORAGE_FILTERS_KEY } from '../../src/components/AppointmentsFilters';

// Surfaces the current query string so assertions can inspect it.
const SearchProbe = (): ReactNode => {
  const [searchParams] = useSearchParams();
  return <div data-testid="search">{searchParams.toString()}</div>;
};

const renderFilters = (initialEntry = '/visits'): void => {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppointmentsFilters />
      <SearchProbe />
    </MemoryRouter>
  );
};

const getSearch = (): string => screen.getByTestId('search').textContent ?? '';

describe('AppointmentsFilters persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds default filters when only the tab query param is present', async () => {
    renderFilters('/visits?tab=in-office');

    await waitFor(() => {
      const params = new URLSearchParams(getSearch());
      expect(params.get('tab')).toBe('in-office');
      expect(params.get('visitType')).toBeTruthy();
      expect(params.get('date')).toBeTruthy();
    });
  });

  it('restores persisted filters into the URL while preserving the tab param', async () => {
    localStorage.setItem(
      LOCAL_STORAGE_FILTERS_KEY,
      JSON.stringify({ location: [{ id: 'L1' }], visitType: ['in-person-walk-in'], date: '2026-01-01' })
    );

    renderFilters('/visits?tab=in-office');

    await waitFor(() => {
      const params = new URLSearchParams(getSearch());
      // the lingering tab survives...
      expect(params.get('tab')).toBe('in-office');
      // ...and the persisted filters are pushed back into the URL.
      expect(params.get('location')).toBe('L1');
      expect(params.get('visitType')).toBe('in-person-walk-in');
      expect(params.get('date')).toBe('2026-01-01');
    });
  });

  it('does not overwrite filters already present in the URL', async () => {
    localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify({ location: [{ id: 'FROM-STORAGE' }] }));

    renderFilters('/visits?location=FROM-URL&tab=in-office');

    // give the effects a chance to run
    await new Promise((r) => setTimeout(r, 50));

    const params = new URLSearchParams(getSearch());
    expect(params.get('location')).toBe('FROM-URL');
    expect(params.get('tab')).toBe('in-office');
  });

  it('recovers from a malformed localStorage value without crashing', async () => {
    localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, '{not-json');

    expect(() => renderFilters('/visits?tab=in-office')).not.toThrow();

    await waitFor(() => {
      // falls back to default filters (date set, tab preserved)...
      const params = new URLSearchParams(getSearch());
      expect(params.get('tab')).toBe('in-office');
      expect(params.get('date')).toBeTruthy();
    });
    // ...and the corrupt value has been replaced with valid JSON.
    expect(() => JSON.parse(localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY) ?? '')).not.toThrow();
  });
});
