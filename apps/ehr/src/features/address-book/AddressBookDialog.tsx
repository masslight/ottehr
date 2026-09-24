import { zodResolver } from '@hookform/resolvers/zod';
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
import { Controller, FormProvider, Resolver, useForm } from 'react-hook-form';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { AllStates } from 'utils/lib/types/common';
import {
  ADDRESS_BOOK_KNOWN_TAGS,
  AddressBookContact,
  AddressBookContactInput,
  AddressBookContactInputSchema,
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
  address: { line1: string; line2: string; city: string; state: string | null; zip: string };
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
  address: {
    line1: contact?.address?.line1 ?? '',
    line2: contact?.address?.line2 ?? '',
    city: contact?.address?.city ?? '',
    state: contact?.address?.state ?? null,
    zip: contact?.address?.zip ?? '',
  },
  phone: formatPhoneNumberDisplay(contact?.phone),
  fax: formatPhoneNumberDisplay(contact?.fax),
  email: contact?.email ?? '',
  tags: contact?.tags ?? [],
});

/** Mirrors the schema's tag normalization so the chips show what will be stored. */
const normalizeTags = (tags: string[]): string[] =>
  Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));

// The zambdas validate with the same schema, so the form reports exactly what the server would reject.
const contactResolver = zodResolver(AddressBookContactInputSchema);
const resolver: Resolver<FormValues, unknown, AddressBookContactInput> = (values, context, options) =>
  contactResolver(
    { ...values, address: { ...values.address, state: values.address.state ?? '' } },
    context,
    options as any
  ) as ReturnType<Resolver<FormValues, unknown, AddressBookContactInput>>;

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
  const methods = useForm<FormValues, unknown, AddressBookContactInput>({
    defaultValues: toFormValues(contact ?? initialValues),
    resolver,
  });

  const { control, getValues, setValue, handleSubmit } = methods;
  const { data } = useSearchAddressBookQuery();

  const tagSuggestions = Array.from(
    new Set([...ADDRESS_BOOK_KNOWN_TAGS, ...(data?.contacts ?? []).flatMap((entry) => entry.tags ?? [])])
  );

  const createMutation = useCreateAddressBookContactMutation();
  const updateMutation = useUpdateAddressBookContactMutation();
  const deleteMutation = useDeleteAddressBookContactMutation();
  const [pendingTag, setPendingTag] = useState('');

  const submit = async (input: AddressBookContactInput): Promise<void> => {
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
            // A tag typed without Enter is still meant to be saved; make it a chip so it is validated too.
            if (pendingTag.trim()) {
              setValue('tags', normalizeTags([...getValues('tags'), pendingTag]));
              setPendingTag('');
            }
            void handleSubmit(submit)(event);
          }}
          data-testid={dataTestIds.addressBook.contactDialog}
        >
          <DialogTitle>{contact ? 'Edit contact' : 'New contact'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextInput name="organizationName" label="Organization" />
              <TextInput name="firstName" label="First name" />
              <TextInput name="lastName" label="Last name" />
              <TextInput name="credential" label="Credential" />
              <TextInput name="address.line1" label="Address line 1" />
              <TextInput name="address.line2" label="Address line 2" />
              <TextInput name="address.city" label="City" />
              <SelectInput name="address.state" label="State" options={STATE_OPTIONS} />
              <TextInput name="address.zip" label="ZIP" />
              <PhoneInput name="phone" label="Phone" />
              <PhoneInput name="fax" label="Fax" />
              <TextInput name="email" label="Email" />
              <Controller
                name="tags"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <Autocomplete
                    multiple
                    freeSolo
                    options={tagSuggestions}
                    value={field.value}
                    onChange={(_event, value) => field.onChange(normalizeTags(value))}
                    inputValue={pendingTag}
                    onInputChange={(_event, value) => setPendingTag(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tags"
                        size="small"
                        placeholder="Type a tag and press Enter"
                        error={!!error}
                        // A bad tag is reported per array item; show the first one under the box.
                        helperText={error?.message ?? (Array.isArray(error) ? error.find(Boolean)?.message : undefined)}
                      />
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
                actionButtons={{ proceed: { text: 'Delete', color: 'error', loading: deleteMutation.isPending } }}
              >
                {(showDialog) => (
                  <Button
                    color="error"
                    onClick={showDialog}
                    sx={{ mr: 'auto' }}
                    data-testid={dataTestIds.addressBook.deleteContactButton}
                  >
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
              data-testid={dataTestIds.addressBook.saveContactButton}
            >
              Save
            </LoadingButton>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
};
