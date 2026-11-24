import { UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { useInvalidatingZambdaMutation } from 'src/hooks/useInvalidatingZambdaMutation';
import {
  AddressBookContactInput,
  AddressBookContactOutput,
  DeleteAddressBookContactInput,
  SearchAddressBookOutput,
  UpdateAddressBookContactInput,
} from 'utils/lib/types/data/address-book';
import {
  createAddressBookContact,
  deleteAddressBookContact,
  searchAddressBook,
  updateAddressBookContact,
} from './addressBook.api';

const ADDRESS_BOOK_QUERY_KEY = 'address-book';

export const useSearchAddressBookQuery = (tag?: string): UseQueryResult<SearchAddressBookOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: [ADDRESS_BOOK_QUERY_KEY, tag],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return searchAddressBook(oystehrZambda, { tag });
    },
    enabled: !!oystehrZambda,
  });
};

export const useCreateAddressBookContactMutation = (): UseMutationResult<
  AddressBookContactOutput,
  Error,
  AddressBookContactInput
> => useInvalidatingZambdaMutation('create-address-book-contact', createAddressBookContact, ADDRESS_BOOK_QUERY_KEY);

export const useUpdateAddressBookContactMutation = (): UseMutationResult<
  AddressBookContactOutput,
  Error,
  UpdateAddressBookContactInput
> => useInvalidatingZambdaMutation('update-address-book-contact', updateAddressBookContact, ADDRESS_BOOK_QUERY_KEY);

export const useDeleteAddressBookContactMutation = (): UseMutationResult<void, Error, DeleteAddressBookContactInput> =>
  useInvalidatingZambdaMutation('delete-address-book-contact', deleteAddressBookContact, ADDRESS_BOOK_QUERY_KEY);
