import { render, screen, waitFor } from '@testing-library/react';
import { DateTime } from 'luxon';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/input/DateInput', () => ({
  DateInput: () => <div data-testid="date-input" />,
}));

vi.mock('../../src/components/input/EmployeeSelectInput', () => ({
  EmployeeSelectInput: () => <div data-testid="employee-select-input" />,
}));

vi.mock('../../src/components/input/LocationSelectInput', () => ({
  LocationSelectInput: () => <div data-testid="location-select-input" />,
}));

vi.mock('../../src/components/input/SelectInput', () => ({
  SelectInput: () => <div data-testid="select-input" />,
}));

import AppointmentsFilters from '../../src/components/AppointmentsFilters';

const LocationProbe = (): ReactNode => {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
};

describe('AppointmentsFilters', () => {
  it('seeds default filters when only the tab query param is present', async () => {
    render(
      <MemoryRouter initialEntries={['/visits?tab=in-office']}>
        <LocationProbe />
        <AppointmentsFilters />
      </MemoryRouter>
    );

    await waitFor(() => {
      const location = screen.getByTestId('location-probe').textContent ?? '';
      expect(location).toContain('/visits?');
      expect(location).toContain('tab=in-office');
      expect(location).toContain('visitType=');
      expect(location).toContain(`date=${DateTime.now().toISODate()}`);
    });
  });

  it('preserves the tracking-board tab query param when syncing filter values', async () => {
    render(
      <MemoryRouter initialEntries={['/visits?tab=completed&visitType=in-person-walk-in&date=2026-05-29']}>
        <LocationProbe />
        <AppointmentsFilters />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent(
        '/visits?tab=completed&visitType=in-person-walk-in&date=2026-05-29'
      );
    });
  });
});
