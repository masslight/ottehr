import { fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateClaim from '../../src/pages/CreateClaim';

// createBillingClaim must be observable across the vi.mock hoist boundary.
const { createBillingClaimMock } = vi.hoisted(() => ({ createBillingClaimMock: vi.fn() }));

vi.mock('../../src/api/api', () => ({
  createBillingClaim: createBillingClaimMock,
  getPatientCoverages: vi.fn(),
  searchBillingLocations: vi.fn(),
  searchBillingPatients: vi.fn(),
  searchBillingProviders: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

function renderCreateClaim(): ReactElement {
  return render(
    <MemoryRouter>
      <CreateClaim />
    </MemoryRouter>
  ) as unknown as ReactElement;
}

describe('CreateClaim — required-field validation', () => {
  beforeAll(() => {
    // jsdom doesn't implement scrollIntoView, which the scroll-to-error effect calls.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    createBillingClaimMock.mockReset();
  });

  it('keeps Create enabled and surfaces required errors instead of submitting when the form is empty', async () => {
    renderCreateClaim();

    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeEnabled();

    fireEvent.click(createButton);

    // Patient + Date of Service are required RHF fields → shared "This field is required" message.
    const requiredMessages = await screen.findAllByText('This field is required');
    expect(requiredMessages.length).toBeGreaterThanOrEqual(2);

    // AR Stage (outside RHF) turns red with its own "Required" placeholder only after the click.
    expect(screen.getByText('Required')).toBeInTheDocument();

    // Nothing should have been submitted.
    expect(createBillingClaimMock).not.toHaveBeenCalled();
  });
});
