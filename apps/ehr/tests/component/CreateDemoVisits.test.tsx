import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateDemoVisits from '../../src/components/CreateDemoVisits';

const mocks = vi.hoisted(() => ({
  createSampleAppointments: vi.fn(),
  getAccessTokenSilently: vi.fn(),
  searchLocations: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: mocks.getAccessTokenSilently }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: {
      fhir: { search: mocks.searchLocations },
    },
  }),
}));

vi.mock('utils/lib/helpers', () => ({
  createSampleAppointments: mocks.createSampleAppointments,
}));

describe('CreateDemoVisits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessTokenSilently.mockResolvedValue('token');
    mocks.searchLocations.mockResolvedValue({ unbundle: () => [] });
    mocks.createSampleAppointments.mockResolvedValue(undefined);
  });

  it('creates in-person demo visits at the location selected in the tracking-board filters', async () => {
    const user = userEvent.setup();
    render(<CreateDemoVisits selectedLocationIds={['selected-location']} />);

    await user.type(screen.getByRole('textbox', { name: /Phone Number/ }), '2022020200');
    await user.click(screen.getByRole('button', { name: /Create Demo Visits/i }));

    await waitFor(() => {
      expect(mocks.createSampleAppointments).toHaveBeenCalledWith(
        expect.objectContaining({ selectedLocationId: 'selected-location' })
      );
    });
  });

  it('requires a location in the tracking-board filters', async () => {
    const user = userEvent.setup();
    render(<CreateDemoVisits selectedLocationIds={[]} />);

    await user.click(screen.getByRole('button', { name: /Create Demo Visits/i }));

    expect(await screen.findByText('No location selected in filters, please select a location first')).toBeVisible();
    expect(mocks.createSampleAppointments).not.toHaveBeenCalled();
  });

  it('requires exactly one tracking-board location', async () => {
    const user = userEvent.setup();
    render(<CreateDemoVisits selectedLocationIds={['location-1', 'location-2']} />);

    await user.click(screen.getByRole('button', { name: /Create Demo Visits/i }));

    expect(
      await screen.findByText('Multiple locations selected in filters, please select only one location')
    ).toBeVisible();
    expect(mocks.createSampleAppointments).not.toHaveBeenCalled();
  });
});
