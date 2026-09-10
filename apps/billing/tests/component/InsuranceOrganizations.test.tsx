import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InsuranceOrganizationItem } from 'utils/lib/types/data/billing/insurance-org.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InsuranceOrganizationDetail, InsuranceOrganizationsList } from '../../src/pages/InsuranceOrganizations';

const {
  searchBillingPayersMock,
  searchBillingInsuranceOrgsMock,
  createBillingInsuranceOrgMock,
  updateBillingInsuranceOrgMock,
  deleteBillingInsuranceOrgMock,
} = vi.hoisted(() => ({
  searchBillingPayersMock: vi.fn(),
  searchBillingInsuranceOrgsMock: vi.fn(),
  createBillingInsuranceOrgMock: vi.fn(),
  updateBillingInsuranceOrgMock: vi.fn(),
  deleteBillingInsuranceOrgMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  searchBillingPayers: searchBillingPayersMock,
  searchBillingInsuranceOrgs: searchBillingInsuranceOrgsMock,
  createBillingInsuranceOrg: createBillingInsuranceOrgMock,
  updateBillingInsuranceOrg: updateBillingInsuranceOrgMock,
  deleteBillingInsuranceOrg: deleteBillingInsuranceOrgMock,
}));

// A stable client object: the pages' fetch callbacks depend on oystehrZambda's identity, so a
// fresh object per render would refire their effects forever.
vi.mock('../../src/hooks/useAppClients', () => {
  const clients = { oystehrZambda: {} };
  return { useApiClients: () => clients };
});

const acmeCustomOrg: InsuranceOrganizationItem = {
  id: 'org-1',
  orgId: 'OTR-ACME',
  name: 'Acme Insurance',
  active: true,
  insuranceTypes: ['workers-comp', 'auto'],
  submissionMechanism: 'portal',
  acceptedClaimForm: 'cms-1500',
  note: 'Prefers electronic submission',
};

function renderList(): void {
  render(
    <MemoryRouter initialEntries={['/insurance-organizations']}>
      <InsuranceOrganizationsList />
    </MemoryRouter>
  );
}

describe('InsuranceOrganizationsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchBillingPayersMock.mockResolvedValue({ payers: [{ id: 'payer-1', name: 'RCM Payer Co', payerId: 'PAYER1' }] });
    searchBillingInsuranceOrgsMock.mockResolvedValue({
      organizations: [acmeCustomOrg],
      total: 1,
      offset: 0,
      pageSize: 100,
    });
  });

  it('merges custom and RCM rows into one grid, showing only Name and Payer Id', async () => {
    renderList();

    expect(await screen.findByText('Acme Insurance')).toBeInTheDocument();
    expect(screen.getByText('RCM Payer Co')).toBeInTheDocument();
    // A custom org has no RCM payer id — its "OTR-" org id fills the Payer Id column instead.
    expect(screen.getByText('OTR-ACME')).toBeInTheDocument();
    expect(screen.getByText('PAYER1')).toBeInTheDocument();
    expect(screen.queryByText('Insurance Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Submission')).not.toBeInTheDocument();
  });

  it('rejects an org id that does not start with "OTR-"', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Acme Insurance');

    await user.click(screen.getByRole('button', { name: /add organization/i }));
    const dialog = within(screen.getByRole('dialog'));

    await user.type(dialog.getByLabelText('Organization Name *'), 'Beta Insurance');
    await user.type(dialog.getByLabelText('Id *'), 'BETA-1');
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(dialog.getByText('Id must start with "OTR-"')).toBeInTheDocument());
    expect(createBillingInsuranceOrgMock).not.toHaveBeenCalled();
  });

  it('creates a custom org and refreshes the list', async () => {
    const user = userEvent.setup();
    createBillingInsuranceOrgMock.mockResolvedValue({ id: 'org-2' });
    renderList();
    await screen.findByText('Acme Insurance');

    await user.click(screen.getByRole('button', { name: /add organization/i }));
    const dialog = within(screen.getByRole('dialog'));

    await user.type(dialog.getByLabelText('Organization Name *'), 'Beta Insurance');
    await user.type(dialog.getByLabelText('Id *'), 'OTR-BETA');
    await user.click(dialog.getByRole('checkbox', { name: 'Medical' }));

    await user.click(dialog.getByRole('combobox', { name: /submission mechanism/i }));
    await user.click(screen.getByRole('option', { name: 'Email' }));

    await user.click(dialog.getByRole('combobox', { name: /accepted claim form/i }));
    await user.click(screen.getByRole('option', { name: 'CMS-1500' }));

    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createBillingInsuranceOrgMock).toHaveBeenCalledTimes(1));
    expect(createBillingInsuranceOrgMock).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'OTR-BETA',
      name: 'Beta Insurance',
      insuranceTypes: ['medical'],
      submissionMechanism: 'email',
      acceptedClaimForm: 'cms-1500',
    });
    // Initial load + refresh after create.
    await waitFor(() => expect(searchBillingInsuranceOrgsMock).toHaveBeenCalledTimes(2));
  });
});

describe('InsuranceOrganizationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchBillingInsuranceOrgsMock.mockResolvedValue({
      organizations: [acmeCustomOrg],
      total: 1,
      offset: 0,
      pageSize: 50,
    });
  });

  function renderDetail(): void {
    render(
      <MemoryRouter initialEntries={['/insurance-organizations/org-1']}>
        <Routes>
          <Route path="/insurance-organizations/:id" element={<InsuranceOrganizationDetail />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders the read-only summary', async () => {
    renderDetail();

    expect(await screen.findByText('Organization Details')).toBeInTheDocument();
    expect(screen.getByText('OTR-ACME')).toBeInTheDocument();
    expect(screen.getByText('Workers Comp, Auto')).toBeInTheDocument();
    // The collapsed (hidden) edit form's Select also renders the current value as text, so these
    // match twice — once in the read-only row, once in the not-yet-visible Select.
    expect(screen.getAllByText('Portal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CMS-1500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prefers electronic submission').length).toBeGreaterThan(0);
  });

  it('edits and saves with the stored insuranceOrgId, then refetches', async () => {
    const user = userEvent.setup();
    updateBillingInsuranceOrgMock.mockResolvedValue({ id: 'org-1' });
    renderDetail();
    await screen.findByText('Organization Details');

    await user.click(screen.getByRole('button', { name: /edit/i }));
    const nameField = await screen.findByLabelText('Organization Name *');
    await user.clear(nameField);
    await user.type(nameField, 'Acme Insurance Co');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateBillingInsuranceOrgMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateBillingInsuranceOrgMock.mock.calls[0];
    expect(payload.insuranceOrgId).toBe('org-1');
    expect(payload.name).toBe('Acme Insurance Co');
    expect(payload.orgId).toBe('OTR-ACME');
    await waitFor(() => expect(searchBillingInsuranceOrgsMock).toHaveBeenCalledTimes(2));
  });
});
