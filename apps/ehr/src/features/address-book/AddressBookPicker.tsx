import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Autocomplete, Box, createFilterOptions, IconButton, TextField, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { AddressBookContact, AddressBookContactInput } from 'utils/lib/types/data/address-book';
import { useSearchAddressBookQuery } from './addressBook.queries';
import { addressBookContactLabel, AddressBookDialog } from './AddressBookDialog';

/** Sentinel option pinned to the end of the list. */
const ADD_NEW: AddressBookContact = { id: 'add-new-contact', organizationName: 'Add new contact…' };

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
  label: string;
  tag?: string;
  onSelect: (contact: AddressBookContact) => void;
  dataTestId?: string;
}

type DialogState = Pick<React.ComponentProps<typeof AddressBookDialog>, 'contact' | 'initialValues'>;

export const AddressBookPicker: FC<AddressBookPickerProps> = ({ name, label, tag, onSelect, dataTestId }) => {
  const { control } = useFormContext();
  const { data } = useSearchAddressBookQuery(tag);
  const contacts = data?.contacts ?? [];
  const [dialog, setDialog] = useState<DialogState>();

  return (
    <Controller
      name={name}
      control={control}
      defaultValue=""
      render={({ field }) => {
        const text: string = field.value ?? '';
        const match = contacts.find((contact) => addressBookContactLabel(contact) === text);
        const pick = (contact: AddressBookContact): void => {
          field.onChange(addressBookContactLabel(contact));
          onSelect(contact);
        };
        return (
          <>
            <Autocomplete<AddressBookContact, false, false, true>
              freeSolo
              // No clear X: it would empty only this field and leave the fax/phone the pick filled in.
              componentsProps={{ clearIndicator: { sx: { display: 'none' } } }}
              value={null}
              inputValue={text}
              options={[...contacts, ADD_NEW]}
              filterOptions={(options, state) => [
                ...filterContacts(
                  options.filter((option) => option !== ADD_NEW),
                  state
                ),
                ADD_NEW,
              ]}
              getOptionLabel={(option) => (typeof option === 'string' ? option : addressBookContactLabel(option))}
              onInputChange={(_event, value, reason) => {
                if (reason !== 'reset') field.onChange(value);
              }}
              onChange={(_event, option) => {
                if (!option || typeof option === 'string') return;
                if (option === ADD_NEW) setDialog({ initialValues: prefillFromText(text) });
                else pick(option);
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{addressBookContactLabel(option)}</Typography>
                    {option !== ADD_NEW && (
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
                  label={label}
                  size="small"
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
