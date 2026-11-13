import { AddressBookDialog } from 'src/features/address-book/AddressBookDialog';
import { defineStory } from '../../harness/story';
import { addressBookMocks, contact } from './_addressBook';

export default defineStory({
  title: 'Edit address book contact',
  source: 'apps/ehr/src/features/address-book/AddressBookDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Address book admin page → click a contact',
  mocks: addressBookMocks,
  render: () => (
    <AddressBookDialog
      contact={contact}
      onClose={() => undefined}
      onSaved={() => undefined}
      onDeleted={() => undefined}
    />
  ),
});
