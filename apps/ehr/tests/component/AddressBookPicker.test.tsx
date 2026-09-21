import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { AddressBookPicker } from 'src/features/address-book/AddressBookPicker';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import { describe, expect, it, vi } from 'vitest';

const contacts: AddressBookContact[] = vi.hoisted(() => [
  {
    id: 'c1',
    firstName: 'Jane',
    lastName: 'Doe',
    credential: 'MD',
    organizationName: 'Springfield Cardiology',
    fax: '+12125554321',
    phone: '+12125551234',
    tags: [],
  },
  { id: 'c2', organizationName: 'Acme Imaging', fax: '+12125550000', tags: [] },
]);

vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({ contacts }),
  createAddressBookContact: vi.fn(),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const Harness: FC<{ onSelect: (contact: AddressBookContact) => void }> = ({ onSelect }) => {
  const methods = useForm({ defaultValues: { name: '' } });
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FormProvider {...methods}>
        <AddressBookPicker name="name" label="Recipient's name" onSelect={onSelect} />
        <span data-testid="field-value">{methods.watch('name')}</span>
      </FormProvider>
    </QueryClientProvider>
  );
};

describe('AddressBookPicker', () => {
  it('lists contacts with organization and fax, plus the add-new option last', async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.click(screen.getByLabelText("Recipient's name"));

    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('Jane Doe, MD');
    expect(options[0]).toHaveTextContent('Springfield Cardiology · Fax (212) 555-4321');
    expect(options[1]).toHaveTextContent('Acme Imaging');
    expect(options[options.length - 1]).toHaveTextContent('Add new contact');
  });

  it('selecting a contact fills the field and reports the contact, then offers to edit it', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await user.click(screen.getByLabelText("Recipient's name"));
    await user.click(await screen.findByRole('option', { name: /Jane Doe, MD/ }));

    expect(onSelect).toHaveBeenCalledWith(contacts[0]);
    expect(screen.getByTestId('field-value')).toHaveTextContent('Jane Doe, MD');
    expect(screen.getByRole('button', { name: 'Edit contact' })).toBeInTheDocument();
  });

  it('keeps working as a free-text field', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await user.type(screen.getByLabelText("Recipient's name"), 'Dr Nobody');

    await waitFor(() => expect(screen.getByTestId('field-value')).toHaveTextContent('Dr Nobody'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Edit contact' })).toBeNull();
  });

  it('opens the new-contact dialog seeded from the typed name', async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText("Recipient's name"), 'Jane Roe');
    await user.click(await screen.findByRole('option', { name: /Add new contact/ }));

    expect(await screen.findByText('New contact')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Jane');
    expect(screen.getByLabelText('Last name')).toHaveValue('Roe');
  });
});
