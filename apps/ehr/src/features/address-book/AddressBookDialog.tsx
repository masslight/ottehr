import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { captureException } from '@sentry/react';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { formatPhoneNumberDisplay, isEmailValid } from 'utils/lib/helpers/helpers';
import { AllStates } from 'utils/lib/types/common';
import {
  ADDRESS_BOOK_CREDENTIAL_NEEDS_LAST_NAME_MESSAGE,
  ADDRESS_BOOK_LINE2_NEEDS_LINE1_MESSAGE,
  ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE,
  AddressBookContact,
  AddressBookContactInput,
  formatAddressBookPersonName,
} from 'utils/lib/types/data/address-book';
import {
  useCreateAddressBookContactMutation,
  useDeleteAddressBookContactMutation,
  useSearchAddressBookQuery,
  useUpdateAddressBookContactMutation,
} from './addressBook.queries';

/** What a contact is called in pickers and forms: the person when there is one, else the organization. */
export const addressBookContactLabel = (contact: AddressBookContactInput): string =>
  formatAddressBookPersonName(contact) || contact.organizationName || '';

const STATE_OPTIONS = AllStates.map((state) => state.value);

interface FormValues {
  firstName: string;
  lastName: string;
  credential: string;
  organizationName: string;
  line1: string;
  line2: string;
  city: string;
  state: string | null;
  zip: string;
  phone: string;
  fax: string;
  email: string;
  tags: string[];
}

const toFormValues = (contact?: Partial<AddressBookContactInput>): FormValues => ({
  firstName: contact?.firstName ?? '',
  lastName: contact?.lastName ?? '',
  credential: contact?.credential ?? '',
  organizationName: contact?.organizationName ?? '',
  line1: contact?.address?.line1 ?? '',
  line2: contact?.address?.line2 ?? '',
  city: contact?.address?.city ?? '',
  state: contact?.address?.state ?? null,
  zip: contact?.address?.zip ?? '',
  phone: formatPhoneNumberDisplay(contact?.phone),
  fax: formatPhoneNumberDisplay(contact?.fax),
  email: contact?.email ?? '',
  tags: contact?.tags ?? [],
});

const normalizeTags = (tags: string[]): string[] => Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

/** `pendingTag` is what sits typed in the tags box without Enter; Save must not lose it. */
const toInput = (
  { line1, line2, city, state, zip, tags, ...rest }: FormValues,
  pendingTag: string
): AddressBookContactInput => ({
  ...rest,
  address: { line1, line2, city, state: state ?? '', zip },
  tags: normalizeTags([...tags, pendingTag]),
});

interface AddressBookDialogProps {
  /** Editing an existing contact; omit to create one. */
  contact?: AddressBookContact;
  /** Seeds the create form (e.g. the name typed into a picker). */
  initialValues?: Partial<AddressBookContactInput>;
  onClose: () => void;
  onSaved: (contact: AddressBookContact) => void;
  onDeleted?: () => void;
}

export const AddressBookDialog: FC<AddressBookDialogProps> = ({
  contact,
  initialValues,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const methods = useForm<FormValues>({ defaultValues: toFormValues(contact ?? initialValues) });
  const { control, getValues, handleSubmit } = methods;
  const { data } = useSearchAddressBookQuery();
  const tagSuggestions = Array.from(new Set((data?.contacts ?? []).flatMap((entry) => entry.tags ?? [])));
  const createMutation = useCreateAddressBookContactMutation();
  const updateMutation = useUpdateAddressBookContactMutation();
  const deleteMutation = useDeleteAddressBookContactMutation();
  const [pendingTag, setPendingTag] = useState('');

  const submit = async (values: FormValues): Promise<void> => {
    const input = toInput(values, pendingTag);
    try {
      const { contact: saved } = contact
        ? await updateMutation.mutateAsync({ contactId: contact.id, ...input })
        : await createMutation.mutateAsync(input);
      onSaved(saved);
    } catch (error) {
      captureException(error);
      enqueueSnackbar('Failed to save the contact. Please try again.', { variant: 'error' });
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <FormProvider {...methods}>
        {/* The dialog can sit inside another form (the fax form); the submit must not bubble up to it. */}
        <form
          onSubmit={(event) => {
            event.stopPropagation();
            void handleSubmit(submit)(event);
          }}
        >
          <DialogTitle>{contact ? 'Edit contact' : 'New contact'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextInput name="firstName" label="First name" />
              <TextInput
                name="lastName"
                label="Last name"
                validate={(value) =>
                  !!value.trim() || !!getValues('organizationName').trim() || ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE
                }
              />
              <TextInput
                name="credential"
                label="Credential"
                validate={(value) =>
                  !value.trim() || !!getValues('lastName').trim() || ADDRESS_BOOK_CREDENTIAL_NEEDS_LAST_NAME_MESSAGE
                }
              />
              <TextInput name="organizationName" label="Organization" />
              <TextInput name="line1" label="Address line 1" />
              <TextInput
                name="line2"
                label="Address line 2"
                validate={(value) =>
                  !value.trim() || !!getValues('line1').trim() || ADDRESS_BOOK_LINE2_NEEDS_LINE1_MESSAGE
                }
              />
              <TextInput name="city" label="City" />
              <SelectInput name="state" label="State" options={STATE_OPTIONS} />
              <TextInput name="zip" label="ZIP" />
              <PhoneInput name="phone" label="Phone" />
              <PhoneInput name="fax" label="Fax" />
              <TextInput
                name="email"
                label="Email"
                validate={(value) => !value || isEmailValid(value) || 'Invalid email'}
              />
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    multiple
                    freeSolo
                    options={tagSuggestions}
                    value={field.value}
                    onChange={(_event, value) => field.onChange(normalizeTags(value))}
                    inputValue={pendingTag}
                    onInputChange={(_event, value) => setPendingTag(value)}
                    renderInput={(params) => (
                      <TextField {...params} label="Tags" size="small" placeholder="Type a tag and press Enter" />
                    )}
                  />
                )}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            {contact && onDeleted && (
              <ConfirmationDialog
                title="Delete this contact?"
                description={`${addressBookContactLabel(contact)} will be removed from the address book.`}
                response={async () => {
                  await deleteMutation.mutateAsync({ contactId: contact.id });
                  onDeleted();
                }}
                actionButtons={{ proceed: { text: 'Delete', color: 'error' } }}
              >
                {(showDialog) => (
                  <Button color="error" onClick={showDialog} sx={{ mr: 'auto' }}>
                    Delete
                  </Button>
                )}
              </ConfirmationDialog>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <LoadingButton
              type="submit"
              variant="contained"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              Save
            </LoadingButton>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
};
