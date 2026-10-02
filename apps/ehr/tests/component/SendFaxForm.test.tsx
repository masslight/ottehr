import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FAX_RECIPIENT_CREDENTIAL_NEEDS_NAME_MESSAGE, FaxDocumentAvailability } from 'utils/lib/types/api/fax.types';
import { describe, expect, it, vi } from 'vitest';
import { SendFaxForm } from '../../src/features/fax/ui/SendFaxForm';

// The organization picker reads the address book; keep it small and offline here.
vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({
    contacts: [
      {
        id: 'c1',
        firstName: 'Jane',
        lastName: 'Doe',
        credential: 'MD',
        organizationName: 'Springfield Cardiology',
        tags: [],
      },
      { id: 'c2', organizationName: 'Acme Imaging', fax: '+12125550000', tags: [] },
      { id: 'c3', firstName: 'John', lastName: 'Roe', fax: '+12125557777', tags: [] },
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

describe('SendFaxForm credential', () => {
  it('does not send a credential without a recipient name', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SendFaxForm isSending={false} onSubmit={onSubmit} onCancel={vi.fn()} />
      </QueryClientProvider>
    );

    await user.type(screen.getByLabelText(/Recipient Fax/), '2125550000');
    await user.type(screen.getByLabelText('Credential'), 'MD');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(FAX_RECIPIENT_CREDENTIAL_NEEDS_NAME_MESSAGE)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('SendFaxForm recipient picker', () => {
  it('puts each part of a contact into its own field', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Organization'));
    await user.click(await screen.findByRole('option', { name: /Jane Doe/ }));

    // The credential goes to its own field, so the name stays a plain name.
    expect(screen.getByLabelText('Organization')).toHaveValue('Springfield Cardiology');
    expect(screen.getByLabelText("Recipient's name")).toHaveValue('Jane Doe');
    expect(screen.getByLabelText('Credential')).toHaveValue('MD');
  });

  it('keeps an organization-only contact in the organization field, leaving the name empty', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Organization'));
    await user.click(await screen.findByRole('option', { name: /Acme Imaging/ }));

    expect(screen.getByLabelText('Organization')).toHaveValue('Acme Imaging');
    expect(screen.getByLabelText("Recipient's name")).toHaveValue('');
    expect(screen.getByLabelText(/Recipient Fax/)).toHaveValue('(212) 555-0000');
  });

  it('finds a person-only contact by name, and still offers to edit it with the organization empty', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Organization'), 'roe');
    await user.click(await screen.findByRole('option', { name: /John Roe/ }));

    expect(screen.getByLabelText('Organization')).toHaveValue('');
    expect(screen.getByLabelText("Recipient's name")).toHaveValue('John Roe');
    expect(screen.getByRole('button', { name: 'Edit contact' })).toBeInTheDocument();
  });
});
