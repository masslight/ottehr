import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { searchAddressBook } from 'src/features/address-book/addressBook.api';
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
  createAddressBookContact: vi.fn().mockResolvedValue({
    contact: { id: 'c3', firstName: 'Jane', lastName: 'Roe', tags: [] },
  }),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
// Plain <input> so the test doesn't fight react-imask.
vi.mock('ui-components/lib/components/InputMask', () => ({
  InputMask: (props: any) => <input {...props} onChange={(e) => props.onChange(e)} />,
}));

const Harness: FC<{
  onSelect: (contact: AddressBookContact) => void;
  onParentSubmit?: () => void;
  tag?: string;
}> = ({ onSelect, onParentSubmit, tag }) => {
  const methods = useForm({ defaultValues: { name: '' } });
  const picker = (
    <FormProvider {...methods}>
      <AddressBookPicker name="name" label="Recipient's name" tag={tag} onSelect={onSelect} />
      <span data-testid="field-value">{methods.watch('name')}</span>
    </FormProvider>
  );
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {onParentSubmit ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onParentSubmit();
          }}
        >
          {picker}
        </form>
      ) : (
        picker
      )}
    </QueryClientProvider>
  );
};

describe('AddressBookPicker', () => {
  it('lists contacts with organization and fax, plus the add-new option last', async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.click(screen.getByLabelText("Recipient's name"));

    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('Springfield Cardiology');
    expect(options[0]).toHaveTextContent('Jane Doe, MD · Fax (212) 555-4321');
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
    // The picker's field holds the organization; the person goes to the screen's own name fields.
    expect(screen.getByTestId('field-value')).toHaveTextContent(/^Springfield Cardiology$/);
    expect(screen.getByRole('button', { name: 'Edit contact' })).toBeInTheDocument();
  });

  it('edits the contact that was picked, not the first one with the same label', async () => {
    const user = userEvent.setup();
    const twins: AddressBookContact[] = [
      { id: 't1', firstName: 'Jane', lastName: 'Doe', fax: '+12125551111', tags: [] },
      { id: 't2', firstName: 'Jane', lastName: 'Doe', fax: '+12125552222', tags: [] },
    ];
    vi.mocked(searchAddressBook).mockResolvedValueOnce({ contacts: twins });
    render(<Harness onSelect={vi.fn()} />);

    await user.click(screen.getByLabelText("Recipient's name"));
    const options = await screen.findAllByRole('option', { name: /Jane Doe/ });
    await user.click(options[1]);
    await user.click(screen.getByRole('button', { name: 'Edit contact' }));

    expect(await screen.findByText('Edit contact')).toBeInTheDocument();
    expect(screen.getByLabelText('Fax')).toHaveValue('(212) 555-2222');
  });

  it('finds contacts by organization or person, not by credential', async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText("Recipient's name"), 'MD');

    // Only the add-new row is left: "Jane Doe, MD" does not match on its credential.
    expect(await screen.findAllByRole('option')).toHaveLength(1);
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

  it('opens the new-contact dialog seeded with the typed text as the organization', async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText("Recipient's name"), 'Jane Roe');
    await user.click(await screen.findByRole('option', { name: /Add new contact/ }));

    expect(await screen.findByText('New contact')).toBeInTheDocument();
    expect(screen.getByLabelText('Organization')).toHaveValue('Jane Roe');
  });

  it('tags a contact created from a tagged picker with that tag', async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} tag="pcp" />);

    await user.click(screen.getByLabelText("Recipient's name"));
    await user.click(await screen.findByRole('option', { name: /Add new contact/ }));

    expect(await screen.findByText('New contact')).toBeInTheDocument();
    expect(screen.getByText('pcp')).toHaveClass('MuiChip-label');
  });

  it('saving a new contact does not submit a form the picker sits inside (the fax form)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onParentSubmit = vi.fn();
    render(<Harness onSelect={onSelect} onParentSubmit={onParentSubmit} />);

    await user.type(screen.getByLabelText("Recipient's name"), 'Jane Roe');
    await user.click(await screen.findByRole('option', { name: /Add new contact/ }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c3' })));
    expect(onParentSubmit).not.toHaveBeenCalled();
  });
});
