import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
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

const useAddressBookMutation = <Input, Output>(
  key: string,
  request: (oystehr: NonNullable<ReturnType<typeof useApiClients>['oystehrZambda']>, data: Input) => Promise<Output>
): UseMutationResult<Output, Error, Input> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [key],
    mutationFn: async (data: Input) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return request(oystehrZambda, data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ADDRESS_BOOK_QUERY_KEY] }),
  });
};

export const useCreateAddressBookContactMutation = (): UseMutationResult<
  AddressBookContactOutput,
  Error,
  AddressBookContactInput
> => useAddressBookMutation('create-address-book-contact', createAddressBookContact);

export const useUpdateAddressBookContactMutation = (): UseMutationResult<
  AddressBookContactOutput,
  Error,
  UpdateAddressBookContactInput
> => useAddressBookMutation('update-address-book-contact', updateAddressBookContact);

export const useDeleteAddressBookContactMutation = (): UseMutationResult<void, Error, DeleteAddressBookContactInput> =>
  useAddressBookMutation('delete-address-book-contact', deleteAddressBookContact);
