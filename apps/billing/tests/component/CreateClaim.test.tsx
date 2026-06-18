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

    // Patient, Rendering Provider, Service Facility, and Billing Provider are all required RHF
    // fields → shared "This field is required" message (≥4). Date of service is now per service line.
    const requiredMessages = await screen.findAllByText('This field is required');
    expect(requiredMessages.length).toBeGreaterThanOrEqual(4);

    // Diagnoses and Service Lines have their own validation messages.
    expect(screen.getByText('At least one diagnosis is required')).toBeInTheDocument();
    expect(screen.getByText('At least one service line with a CPT code is required')).toBeInTheDocument();

    // AR Stage (outside RHF) turns red with its own "Required" placeholder only after the click.
    expect(screen.getByText('Required')).toBeInTheDocument();

    // Nothing should have been submitted.
    expect(createBillingClaimMock).not.toHaveBeenCalled();
  });

  it('exposes diagnoses added in the shared editor as Dx pointers on a service line', async () => {
    renderCreateClaim();

    // Both shared editors (same components as the claim-detail edit experience) render.
    expect(screen.getByRole('button', { name: '+ Add service line' })).toBeInTheDocument();

    // Add a diagnosis and give it an ICD-10 code via the shared DiagnosesEditor.
    fireEvent.click(screen.getByRole('button', { name: '+ Add diagnosis' }));
    fireEvent.change(screen.getByLabelText('ICD-10'), { target: { value: 'J06.9' } });

    // The default service line's Dx dropdown now offers that diagnosis at sequence 1.
    const dxSelect = screen.getAllByRole('combobox').find((el) => el.textContent === 'Dx');
    expect(dxSelect).toBeDefined();
    fireEvent.mouseDown(dxSelect!);
    expect(await screen.findByRole('option', { name: '1: J06.9' })).toBeInTheDocument();
  });
});
