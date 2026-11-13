import { AddressBookDialog } from 'src/features/address-book/AddressBookDialog';
import { defineStory } from '../../harness/story';
import { addressBookMocks, contact } from './_addressBook';

export default defineStory({
  title: 'Delete address book contact',
  source: 'apps/ehr/src/features/address-book/AddressBookDialog.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'Address book admin page → edit contact → "Delete"',
  mocks: addressBookMocks,
  render: () => (
    <AddressBookDialog
      contact={contact}
      onClose={() => undefined}
      onSaved={() => undefined}
      onDeleted={() => undefined}
    />
  ),
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await screen.findByText('Delete this contact?');
  },
  notes: 'Opens stacked on top of the edit-contact dialog, as in the product.',
});
