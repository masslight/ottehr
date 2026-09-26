import Oystehr from '@oystehr/sdk';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  AddressBookContactInput,
  AddressBookContactOutput,
  DeleteAddressBookContactInput,
  SearchAddressBookInput,
  SearchAddressBookOutput,
  UpdateAddressBookContactInput,
} from 'utils/lib/types/data/address-book';

const SEARCH_ADDRESS_BOOK_ZAMBDA_ID = 'search-address-book';
const CREATE_ADDRESS_BOOK_CONTACT_ZAMBDA_ID = 'create-address-book-contact';
const UPDATE_ADDRESS_BOOK_CONTACT_ZAMBDA_ID = 'update-address-book-contact';
const DELETE_ADDRESS_BOOK_CONTACT_ZAMBDA_ID = 'delete-address-book-contact';

export const searchAddressBook = async (
  oystehr: Oystehr,
  parameters: SearchAddressBookInput
): Promise<SearchAddressBookOutput> => {
  const response = await oystehr.zambda.execute({ id: SEARCH_ADDRESS_BOOK_ZAMBDA_ID, ...parameters });
  return chooseJson(response);
};

export const createAddressBookContact = async (
  oystehr: Oystehr,
  parameters: AddressBookContactInput
): Promise<AddressBookContactOutput> => {
  const response = await oystehr.zambda.execute({ id: CREATE_ADDRESS_BOOK_CONTACT_ZAMBDA_ID, ...parameters });
  return chooseJson(response);
};

export const updateAddressBookContact = async (
  oystehr: Oystehr,
  parameters: UpdateAddressBookContactInput
): Promise<AddressBookContactOutput> => {
  const response = await oystehr.zambda.execute({ id: UPDATE_ADDRESS_BOOK_CONTACT_ZAMBDA_ID, ...parameters });
  return chooseJson(response);
};

export const deleteAddressBookContact = async (
  oystehr: Oystehr,
  parameters: DeleteAddressBookContactInput
): Promise<void> => {
  await oystehr.zambda.execute({ id: DELETE_ADDRESS_BOOK_CONTACT_ZAMBDA_ID, ...parameters });
};
