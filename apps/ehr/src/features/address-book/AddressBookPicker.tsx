import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Autocomplete,
  Box,
  createFilterOptions,
  IconButton,
  TextField,
  TextFieldProps,
  Typography,
} from '@mui/material';
import { FC, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { AddressBookContact, AddressBookContactInput } from 'utils/lib/types/data/address-book';
import { useSearchAddressBookQuery } from './addressBook.queries';
import { addressBookContactLabel, AddressBookDialog } from './AddressBookDialog';

/** Sentinel row pinned to the end of the list; never part of `options`, only of what filterOptions returns. */
const ADD_NEW = { id: 'add-new-contact', label: 'Add new contact…' };
type PickerOption = AddressBookContact | typeof ADD_NEW;
const isAddNew = (option: PickerOption): option is typeof ADD_NEW => option === ADD_NEW;
const optionLabel = (option: PickerOption): string =>
  isAddNew(option) ? option.label : addressBookContactLabel(option);

const filterContacts = createFilterOptions<AddressBookContact>({
  stringify: (contact) => [addressBookContactLabel(contact), contact.organizationName, contact.fax].join(' '),
});

/** "Jane Doe" typed into the picker seeds the new-contact form as first/last. */
const prefillFromText = (text: string): Partial<AddressBookContactInput> => {
  const [first, ...rest] = text.trim().split(/\s+/);
  return rest.length ? { firstName: first, lastName: rest.join(' ') } : { lastName: first };
};

const secondaryText = (contact: AddressBookContact): string =>
  [
    contact.organizationName !== addressBookContactLabel(contact) && contact.organizationName,
    contact.fax && `Fax ${formatPhoneNumberDisplay(contact.fax)}`,
  ]
    .filter(Boolean)
    .join(' · ');

interface AddressBookPickerProps {
  /** react-hook-form field holding the recipient name; free text keeps working as before. */
  name: string;
  label?: string;
  variant?: TextFieldProps['variant'];
  /** Narrows the search to contacts with this tag, and tags contacts created from this picker with it. */
  tag?: string;
  /** What a pick writes into the field; defaults to the contact's label (the person, else the organization). */
  fieldValue?: (contact: AddressBookContact) => string;
  onSelect: (contact: AddressBookContact) => void;
  dataTestId?: string;
}

type DialogState = Pick<React.ComponentProps<typeof AddressBookDialog>, 'contact' | 'initialValues'>;

export const AddressBookPicker: FC<AddressBookPickerProps> = ({
  name,
  label,
  variant,
  tag,
  fieldValue = addressBookContactLabel,
  onSelect,
  dataTestId,
}) => {
  const { control } = useFormContext();
  const { data } = useSearchAddressBookQuery(tag);
  const contacts = data?.contacts ?? [];
  const [dialog, setDialog] = useState<DialogState>();
  // Which contact the text came from: two contacts can share a label, so the label alone can't say.
  const [pickedId, setPickedId] = useState<string>();

  return (
    <Controller
      name={name}
      control={control}
      defaultValue=""
      render={({ field, fieldState: { error } }) => {
        const text: string = field.value ?? '';
        const picked = contacts.find((contact) => contact.id === pickedId);
        const match = picked && fieldValue(picked) === text ? picked : undefined;
        const pick = (contact: AddressBookContact): void => {
          setPickedId(contact.id);
          field.onChange(fieldValue(contact));
          onSelect(contact);
        };
        return (
          <>
            <Autocomplete<PickerOption, false, false, true>
              freeSolo
              // No clear X: it would empty only this field and leave the fax/phone the pick filled in.
              componentsProps={{ clearIndicator: { sx: { display: 'none' } } }}
              value={null}
              inputValue={text}
              options={contacts}
              filterOptions={(_options, state) => [...filterContacts(contacts, state), ADD_NEW]}
              getOptionLabel={(option) => (typeof option === 'string' ? option : optionLabel(option))}
              onInputChange={(_event, value, reason) => {
                if (reason !== 'reset') field.onChange(value);
              }}
              onChange={(_event, option) => {
                if (!option || typeof option === 'string') return;
                if (isAddNew(option)) {
                  setDialog({ initialValues: { ...prefillFromText(text), tags: tag ? [tag] : undefined } });
                } else pick(option);
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{optionLabel(option)}</Typography>
                    {!isAddNew(option) && (
                      <Typography variant="caption" color="text.secondary">
                        {secondaryText(option)}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  name={name}
                  label={label}
                  variant={variant}
                  size="small"
                  error={!!error}
                  helperText={error?.message}
                  data-testid={dataTestId}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {match && (
                          <IconButton
                            size="small"
                            aria-label="Edit contact"
                            onClick={() => setDialog({ contact: match })}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        )}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            {dialog && (
              <AddressBookDialog
                {...dialog}
                onClose={() => setDialog(undefined)}
                onSaved={(contact) => {
                  pick(contact);
                  setDialog(undefined);
                }}
                onDeleted={() => setDialog(undefined)}
              />
            )}
          </>
        );
      }}
    />
  );
};
