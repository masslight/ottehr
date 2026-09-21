import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaxDocumentAvailability } from 'utils/lib/types/api/fax.types';
import { describe, expect, it, vi } from 'vitest';
import { SendFaxForm } from '../../src/features/fax/ui/SendFaxForm';

// The recipient-name picker reads the address book; keep it small and offline here.
vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({
    contacts: [
      { id: 'c1', firstName: 'Jane', lastName: 'Doe', organizationName: 'Springfield Cardiology', tags: [] },
      { id: 'c2', organizationName: 'Acme Imaging', fax: '+12125550000', tags: [] },
    ],
  }),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

const documents: FaxDocumentAvailability[] = [
  { kind: 'progress-note', available: true },
  { kind: 'discharge-summary', available: false },
  { kind: 'lab-results', available: false },
  { kind: 'radiology-results', available: false },
  { kind: 'patient-education', available: false },
];

const renderForm = (
  preview?: { documents: FaxDocumentAvailability[]; hasSavedPcp: boolean },
  senderFaxNumber?: string
): void => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SendFaxForm
        preview={preview}
        senderFaxNumber={senderFaxNumber}
        isSending={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    </QueryClientProvider>
  );
};

describe('SendFaxForm PCP control', () => {
  it('omits PCP management from patient-level fax dialogs', () => {
    renderForm();

    expect(screen.queryByRole('checkbox', { name: "Save as patient's PCP" })).toBeNull();
  });

  it('preserves PCP management for the original single-visit dialog', () => {
    renderForm({ documents, hasSavedPcp: false });

    expect(screen.getByRole('checkbox', { name: "Save as patient's PCP" })).toBeChecked();
  });
});

describe('SendFaxForm sender', () => {
  it('names the number the fax is sent from, formatted for reading', () => {
    renderForm(undefined, '+12125550000');

    expect(screen.getByText('Sender fax number: (212) 555-0000')).toBeVisible();
  });

  it('leaves the sender out when the sending number cannot be resolved', () => {
    renderForm({ documents, hasSavedPcp: false });

    expect(screen.queryByText(/Sender fax number/)).toBeNull();
  });

  it("labels the recipient's own number so the two cannot be confused", () => {
    renderForm(undefined, '+12125550000');

    expect(screen.getByLabelText(/Recipient Fax/)).toBeVisible();
  });
});

describe('SendFaxForm recipient picker', () => {
  it('fills the organization from a person contact', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText("Recipient's name"));
    await user.click(await screen.findByRole('option', { name: /Jane Doe/ }));

    expect(screen.getByLabelText("Recipient's name")).toHaveValue('Jane Doe');
    expect(screen.getByLabelText('Organization')).toHaveValue('Springfield Cardiology');
  });

  it('does not repeat an org-only contact as the organization', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText("Recipient's name"));
    await user.click(await screen.findByRole('option', { name: /Acme Imaging/ }));

    expect(screen.getByLabelText("Recipient's name")).toHaveValue('Acme Imaging');
    expect(screen.getByLabelText('Organization')).toHaveValue('');
    expect(screen.getByLabelText(/Recipient Fax/)).toHaveValue('(212) 555-0000');
  });
});
