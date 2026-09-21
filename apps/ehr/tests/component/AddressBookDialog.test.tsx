import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { AddressBookDialog } from 'src/features/address-book/AddressBookDialog';
import { ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE, AddressBookContact } from 'utils/lib/types/data/address-book';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const existing: AddressBookContact = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  firstName: 'Jane',
  lastName: 'Doe',
  organizationName: 'Springfield Cardiology',
  fax: '+12125554321',
  tags: ['cardiology'],
};

const api = vi.hoisted(() => ({
  searchAddressBook: vi.fn(),
  createAddressBookContact: vi.fn(),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/features/address-book/addressBook.api', () => api);
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
// Plain <input> so the test doesn't fight react-imask.
vi.mock('ui-components/lib/components/InputMask', () => ({
  InputMask: (props: any) => <input {...props} onChange={(e) => props.onChange(e)} />,
}));

const renderDialog = (ui: ReactElement): void => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>
  );
};

describe('AddressBookDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.searchAddressBook.mockResolvedValue({ contacts: [existing] });
  });

  it('requires an organization name or a last name', async () => {
    const user = userEvent.setup();
    renderDialog(<AddressBookDialog onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText('First name'), 'Jane');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE)).toBeInTheDocument();
    expect(api.createAddressBookContact).not.toHaveBeenCalled();
  });

  it('shows existing tags as chips and accepts new free-text tags', async () => {
    const user = userEvent.setup();
    renderDialog(<AddressBookDialog contact={existing} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText('cardiology')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Tags'), 'referral{Enter}');
    expect(screen.getByText('referral')).toBeInTheDocument();
  });

  it('submits every field in the contact input shape and reports the saved contact', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const saved = { ...existing, id: 'new-id' };
    api.createAddressBookContact.mockResolvedValue({ contact: saved });
    renderDialog(<AddressBookDialog onClose={vi.fn()} onSaved={onSaved} />);

    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('City'), 'Springfield');
    await user.type(screen.getByLabelText('Fax'), '2125554321');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Save')).toBeInTheDocument();
    expect(api.createAddressBookContact).toHaveBeenCalledWith(expect.anything(), {
      firstName: '',
      lastName: 'Doe',
      credential: '',
      organizationName: '',
      address: { line1: '', line2: '', city: 'Springfield', state: '', zip: '' },
      phone: '',
      fax: '2125554321',
      email: 'jane@example.com',
      tags: [],
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it('sends the update with contactId when editing', async () => {
    const user = userEvent.setup();
    api.updateAddressBookContact.mockResolvedValue({ contact: existing });
    renderDialog(<AddressBookDialog contact={existing} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText('Fax')).toHaveValue('(212) 555-4321');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.updateAddressBookContact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ contactId: existing.id, lastName: 'Doe', tags: ['cardiology'] })
    );
  });

  it('deletes only after confirmation', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    api.deleteAddressBookContact.mockResolvedValue(undefined);
    renderDialog(<AddressBookDialog contact={existing} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteAddressBookContact).not.toHaveBeenCalled();
    expect(screen.getByText('Delete this contact?')).toBeInTheDocument();

    await user.click(screen.getByTestId('dialog-proceed-button'));

    expect(api.deleteAddressBookContact).toHaveBeenCalledWith(expect.anything(), { contactId: existing.id });
    expect(onDeleted).toHaveBeenCalled();
  });
});
