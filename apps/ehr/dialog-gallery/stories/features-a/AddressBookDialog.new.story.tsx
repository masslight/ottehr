import { AddressBookDialog } from 'src/features/address-book/AddressBookDialog';
import { defineStory } from '../../harness/story';
import { addressBookMocks } from './_addressBook';

export default defineStory({
  title: 'New address book contact',
  source: 'apps/ehr/src/features/address-book/AddressBookDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Address book admin page / address book picker → "New contact"',
  mocks: addressBookMocks,
  render: () => <AddressBookDialog onClose={() => undefined} onSaved={() => undefined} />,
  notes: 'Empty create form, as first opened.',
});
