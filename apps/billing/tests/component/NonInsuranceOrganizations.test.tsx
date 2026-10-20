import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NonInsuranceOrganizationItem } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NonInsuranceOrganizationDetail,
  NonInsuranceOrganizationsList,
} from '../../src/pages/NonInsuranceOrganizations';

const {
  searchBillingNonInsuranceOrgsMock,
  createBillingNonInsuranceOrgMock,
  updateBillingNonInsuranceOrgMock,
  deleteBillingNonInsuranceOrgMock,
  searchBillingPayersMock,
} = vi.hoisted(() => ({
  searchBillingNonInsuranceOrgsMock: vi.fn(),
  createBillingNonInsuranceOrgMock: vi.fn(),
  updateBillingNonInsuranceOrgMock: vi.fn(),
  deleteBillingNonInsuranceOrgMock: vi.fn(),
  searchBillingPayersMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  searchBillingNonInsuranceOrgs: searchBillingNonInsuranceOrgsMock,
  createBillingNonInsuranceOrg: createBillingNonInsuranceOrgMock,
  updateBillingNonInsuranceOrg: updateBillingNonInsuranceOrgMock,
  deleteBillingNonInsuranceOrg: deleteBillingNonInsuranceOrgMock,
  searchBillingPayers: searchBillingPayersMock,
}));

// A stable client object: the pages' fetch callbacks depend on oystehrZambda's identity, so a
// fresh object per render would refire their effects forever.
vi.mock('../../src/hooks/useAppClients', () => {
  const clients = { oystehrZambda: {} };
  return { useApiClients: () => clients };
});

const fedEx: NonInsuranceOrganizationItem = {
  id: 'nio-1',
  name: 'FedEx',
  employer: true,
  active: true,
  address: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' },
  contacts: [{ name: 'Jane Smith', title: 'Billing Manager' }],
  covers: [
    {
      category: 'workers-comp',
      billingMode: 'insurance',
      payer: { id: 'payer-1', name: 'Acme Insurance', payerId: 'PAYER123' },
    },
    { category: 'other', name: 'Medical Clearance', submission: { preferredMechanism: 'portal' } },
  ],
};

function renderList(): void {
  render(
    <MemoryRouter initialEntries={['/non-insurance-organizations']}>
      <NonInsuranceOrganizationsList />
    </MemoryRouter>
  );
}

describe('NonInsuranceOrganizationsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchBillingNonInsuranceOrgsMock.mockResolvedValue({
      organizations: [fedEx],
      total: 1,
      offset: 0,
      pageSize: 25,
    });
    searchBillingPayersMock.mockResolvedValue({ payers: [] });
  });

  it('lists organizations with employer, covers, and address columns', async () => {
    renderList();

    // Generous timeout: the first grid render in a fresh jsdom is slow enough to flake at 1s.
    expect(await screen.findByText('FedEx', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    // The address column sits far enough right that jsdom's viewport virtualizes it away, so the
    // formatted address is asserted on the detail view instead.
    expect(screen.getByText('Workers Comp, Other')).toBeInTheDocument();
  });

  it('expands a covers card when its checkbox is checked and swaps WC billing modes', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('FedEx');

    await user.click(screen.getByRole('button', { name: /add organization/i }));
    const dialog = within(screen.getByRole('dialog'));

    // No detail card until the category is checked.
    expect(dialog.queryByText('Billing')).not.toBeInTheDocument();
    await user.click(dialog.getByRole('checkbox', { name: 'Workers Comp' }));

    // Bill Directly is the default: convenience checkbox + submission block, no payer picker.
    expect(dialog.getByText('Billing')).toBeInTheDocument();
    expect(dialog.getByRole('radio', { name: 'Bill Directly' })).toBeChecked();
    expect(dialog.getByRole('checkbox', { name: 'Same as organization address' })).toBeInTheDocument();
    expect(dialog.getAllByText('Preferred Submission Mechanism').length).toBeGreaterThan(0);
    expect(dialog.queryByLabelText(/workers comp insurance payer/i)).not.toBeInTheDocument();

    // Bill Insurance swaps in the payer picker and drops the submission block.
    await user.click(dialog.getByRole('radio', { name: 'Bill Insurance' }));
    expect(dialog.getByLabelText(/workers comp insurance payer/i)).toBeInTheDocument();
    expect(dialog.queryByText('Preferred Submission Mechanism')).not.toBeInTheDocument();
    expect(dialog.queryByRole('checkbox', { name: 'Same as organization address' })).not.toBeInTheDocument();
  });

  it('adds and removes contacts in the dialog', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('FedEx');

    await user.click(screen.getByRole('button', { name: /add organization/i }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText('No contacts added yet.')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: /add contact/i }));
    await user.click(dialog.getByRole('button', { name: /add contact/i }));
    expect(dialog.getByText('Contact 1')).toBeInTheDocument();
    expect(dialog.getByText('Contact 2')).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Remove contact 2' }));
    expect(dialog.queryByText('Contact 2')).not.toBeInTheDocument();
  });

  it('saves the mapped input and refreshes the list', async () => {
    const user = userEvent.setup();
    createBillingNonInsuranceOrgMock.mockResolvedValue({ id: 'nio-new' });
    renderList();
    await screen.findByText('FedEx');

    await user.click(screen.getByRole('button', { name: /add organization/i }));
    const dialog = within(screen.getByRole('dialog'));

    await user.type(dialog.getByLabelText('Organization Name *'), 'UPS');
    await user.click(dialog.getByRole('checkbox', { name: 'Employer' }));

    await user.click(dialog.getByRole('checkbox', { name: 'Other' }));
    await user.type(dialog.getByLabelText('Name'), 'Medical Clearance');
    await user.click(dialog.getByRole('radio', { name: 'Portal' }));

    await user.click(dialog.getByRole('button', { name: /add contact/i }));
    await user.type(dialog.getByLabelText('Name *'), 'Jane Smith');
    await user.type(dialog.getByLabelText('Title'), 'Billing Manager');

    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createBillingNonInsuranceOrgMock).toHaveBeenCalledTimes(1));
    expect(createBillingNonInsuranceOrgMock).toHaveBeenCalledWith(expect.anything(), {
      name: 'UPS',
      employer: true,
      contacts: [{ name: 'Jane Smith', title: 'Billing Manager' }],
      covers: [{ category: 'other', name: 'Medical Clearance', submission: { preferredMechanism: 'portal' } }],
    });
    // Initial load + refresh after create.
    await waitFor(() => expect(searchBillingNonInsuranceOrgsMock).toHaveBeenCalledTimes(2));
  });

  it('does not save without the required organization name', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('FedEx');

    await user.click(screen.getByRole('button', { name: /add organization/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('Organization Name *')).toBeInvalid());
    expect(createBillingNonInsuranceOrgMock).not.toHaveBeenCalled();
  });
});

describe('NonInsuranceOrganizationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchBillingNonInsuranceOrgsMock.mockResolvedValue({
      organizations: [fedEx],
      total: 1,
      offset: 0,
      pageSize: 50,
    });
    searchBillingPayersMock.mockResolvedValue({ payers: [] });
  });

  function renderDetail(): void {
    render(
      <MemoryRouter initialEntries={['/non-insurance-organizations/nio-1']}>
        <Routes>
          <Route path="/non-insurance-organizations/:id" element={<NonInsuranceOrganizationDetail />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders the read-only summary including covers rows', async () => {
    renderDetail();

    expect(await screen.findByText('Organization Details')).toBeInTheDocument();
    expect(screen.getByText('1 Main St, Springfield, CA 90210')).toBeInTheDocument();
    expect(screen.getByText('Covers · Workers Comp')).toBeInTheDocument();
    expect(screen.getByText('Bill Insurance · Acme Insurance')).toBeInTheDocument();
    expect(screen.getByText('Covers · Other')).toBeInTheDocument();
    expect(screen.getByText('Medical Clearance · prefers Portal')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith — Billing Manager')).toBeInTheDocument();
  });

  it('edits and saves with the stored nioId, then refetches', async () => {
    const user = userEvent.setup();
    updateBillingNonInsuranceOrgMock.mockResolvedValue({ id: 'nio-1' });
    renderDetail();
    await screen.findByText('Organization Details');

    await user.click(screen.getByRole('button', { name: /edit/i }));
    const nameField = await screen.findByLabelText('Organization Name *');
    await user.clear(nameField);
    await user.type(nameField, 'FedEx Ground');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateBillingNonInsuranceOrgMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateBillingNonInsuranceOrgMock.mock.calls[0];
    expect(payload.nioId).toBe('nio-1');
    expect(payload.name).toBe('FedEx Ground');
    expect(payload.employer).toBe(true);
    // The stored covers round-trip through the form: WC keeps its payer id.
    expect(payload.covers).toEqual([
      { category: 'workers-comp', billingMode: 'insurance', payerId: 'payer-1' },
      { category: 'other', name: 'Medical Clearance', submission: { preferredMechanism: 'portal' } },
    ]);
    // Initial fetch + refetch after save.
    await waitFor(() => expect(searchBillingNonInsuranceOrgsMock).toHaveBeenCalledTimes(2));
  });
});
