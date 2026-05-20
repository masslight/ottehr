import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AppointmentTable pulls in heavy stores and FHIR helpers; we don't exercise
// the inner table here — just the tab selection persistence.
vi.mock('../../src/components/AppointmentTable', () => ({
  default: () => <div data-testid="appointment-table" />,
}));

vi.mock('../../src/components/Loading', () => ({
  default: () => <div data-testid="loading" />,
}));

import AppointmentTabs, { ApptTab, SELECTED_TAB_STORAGE_KEY } from '../../src/components/AppointmentTabs';
import { dataTestIds } from '../../src/constants/data-test-ids';

const renderTabs = (initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/visits']): void => {
  const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
  render(
    <AppointmentTabs
      location={undefined}
      providers={[]}
      serviceCategories={[]}
      preBookedAppointments={[]}
      completedAppointments={[]}
      cancelledAppointments={[]}
      inOfficeAppointments={[]}
      loading={false}
      updateAppointments={vi.fn()}
      setEditingComment={vi.fn()}
      orders={{} as any}
    />,
    { wrapper }
  );
};

const getTabSelected = (testId: string): string | null => screen.getByTestId(testId).getAttribute('aria-selected');

describe('AppointmentTabs persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to in-office when nothing is stored', () => {
    renderTabs();
    expect(getTabSelected(dataTestIds.dashboard.inOfficeTab)).toBe('true');
  });

  it('persists the selected tab to localStorage on change', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByTestId(dataTestIds.dashboard.prebookedTab));

    expect(getTabSelected(dataTestIds.dashboard.prebookedTab)).toBe('true');
    expect(localStorage.getItem(SELECTED_TAB_STORAGE_KEY)).toBe(JSON.stringify(ApptTab.prebooked));
  });

  it('restores the previously stored tab on mount', () => {
    localStorage.setItem(SELECTED_TAB_STORAGE_KEY, JSON.stringify(ApptTab.completed));
    renderTabs();
    expect(getTabSelected(dataTestIds.dashboard.dischargedTab)).toBe('true');
  });

  it('ignores a malformed stored value and falls back to the default', () => {
    localStorage.setItem(SELECTED_TAB_STORAGE_KEY, '{not-json');
    renderTabs();
    expect(getTabSelected(dataTestIds.dashboard.inOfficeTab)).toBe('true');
  });

  it('ignores a stored value that is not a known tab', () => {
    localStorage.setItem(SELECTED_TAB_STORAGE_KEY, JSON.stringify('not-a-tab'));
    renderTabs();
    expect(getTabSelected(dataTestIds.dashboard.inOfficeTab)).toBe('true');
  });

  it('lets explicit router state.tab take precedence over the stored value', () => {
    localStorage.setItem(SELECTED_TAB_STORAGE_KEY, JSON.stringify(ApptTab.prebooked));
    renderTabs([{ pathname: '/visits', state: { tab: ApptTab.completed } }]);
    expect(getTabSelected(dataTestIds.dashboard.dischargedTab)).toBe('true');
  });
});
