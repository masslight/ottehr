import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const LocationProbe = (): ReactNode => {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
};

const DischargedLink = (): ReactNode => {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/visits?tab=completed')}>open discharged</button>;
};

const renderTabs = (initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/visits']): void => {
  const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
  render(
    <>
      <LocationProbe />
      <DischargedLink />
      <AppointmentTabs
        header={<div data-testid="filters" />}
        showSelectFiltersMessage={false}
        preBookedAppointments={[]}
        completedAppointments={[]}
        cancelledAppointments={[]}
        inOfficeAppointments={[]}
        loading={false}
        updateAppointments={vi.fn()}
        setEditingComment={vi.fn()}
        orders={{} as any}
      />
    </>,
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

  it('writes the resolved tab to `?tab=` when the param is missing on mount', async () => {
    renderTabs();
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/visits?tab=in-office');
    });
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

describe('AppointmentTabs pinned header', () => {
  const placeStickyHeader = (headerTop: number, containerTop: number): void => {
    const stickyHeader = screen.getByTestId(dataTestIds.dashboard.stickyHeader);
    vi.spyOn(stickyHeader, 'getBoundingClientRect').mockReturnValue({ top: headerTop } as DOMRect);
    vi.spyOn(stickyHeader.parentElement!, 'getBoundingClientRect').mockReturnValue({ top: containerTop } as DOMRect);
  };

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pins the filters and the tab list together', () => {
    renderTabs();

    const stickyHeader = screen.getByTestId(dataTestIds.dashboard.stickyHeader);
    expect(within(stickyHeader).getByTestId('filters')).toBeInTheDocument();
    expect(within(stickyHeader).getByRole('tablist')).toBeInTheDocument();
  });

  it('brings the next tab to the start of its list when the list was scrolled under the pinned header', async () => {
    const user = userEvent.setup();
    renderTabs();
    placeStickyHeader(140, -860);

    await user.click(screen.getByTestId(dataTestIds.dashboard.dischargedTab));

    expect(window.scrollBy).toHaveBeenCalledWith({ top: -1000 });
  });

  it('brings the list to its start when the tab changes through the URL', async () => {
    const user = userEvent.setup();
    renderTabs();
    placeStickyHeader(140, -860);

    await user.click(screen.getByRole('button', { name: 'open discharged' }));

    expect(getTabSelected(dataTestIds.dashboard.dischargedTab)).toBe('true');
    expect(window.scrollBy).toHaveBeenCalledWith({ top: -1000 });
  });

  it('keeps the scroll position when the start of the list is still in view', async () => {
    const user = userEvent.setup();
    renderTabs();
    placeStickyHeader(300, 300);

    await user.click(screen.getByTestId(dataTestIds.dashboard.dischargedTab));

    expect(window.scrollBy).not.toHaveBeenCalled();
  });
});
