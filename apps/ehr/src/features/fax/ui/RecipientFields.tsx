import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, Checkbox, FormControlLabel, IconButton } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AddressBookPicker } from 'src/features/address-book/AddressBookPicker';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { AddressBookContact, formatAddressBookPersonName } from 'utils/lib/types/data/address-book';
import { FaxFormValues } from '../model/types';

interface RecipientFieldsProps {
  index: number;
  /** Whether this recipient is the one that will be saved as the patient's PCP (radio across the list). */
  isPcp: boolean;
  /** Present only for the original single-visit flow, which is the only flow that manages the PCP. */
  onSaveAsPcpChange?: (value: boolean) => void;
  onRemove?: () => void;
}

/** The person without the credential (it has its own field), else the organization. */
const recipientName = (contact: AddressBookContact): string =>
  formatAddressBookPersonName({ firstName: contact.firstName, lastName: contact.lastName }) ||
  contact.organizationName ||
  '';

/** One recipient row. Text/phone fields bind to the parent react-hook-form context by name. */
export const RecipientFields: FC<RecipientFieldsProps> = ({ index, isPcp, onSaveAsPcpChange, onRemove }) => {
  const { setValue } = useFormContext<FaxFormValues>();

  const field = (
    key: 'name' | 'credential' | 'organization' | 'faxNumber' | 'phoneNumber'
  ): `recipients.${number}.${typeof key}` => `recipients.${index}.${key}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
      {onRemove && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton
            aria-label="Remove recipient"
            color="error"
            onClick={onRemove}
            data-testid={`${dataTestIds.faxDialog.removeRecipient}-${index}`}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </Box>
      )}

      {/* The credential sits beside the name so the name stays a plain name; the cover sheet joins them. */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flex: '2 1 0', minWidth: 0 }}>
          <AddressBookPicker
            name={field('name')}
            label="Recipient's name"
            dataTestId={`${dataTestIds.faxDialog.recipientName}-${index}`}
            fieldValue={recipientName}
            onSelect={(contact) => {
              // A contact with no person is named by its organization, so the organization field stays empty.
              const hasPerson = !!(contact.firstName || contact.lastName);
              setValue(field('credential'), (hasPerson && contact.credential) || '');
              setValue(field('organization'), (hasPerson && contact.organizationName) || '');
              setValue(field('faxNumber'), formatPhoneNumberDisplay(contact.fax), { shouldValidate: true });
              setValue(field('phoneNumber'), formatPhoneNumberDisplay(contact.phone));
            }}
          />
        </Box>
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
          <TextInput
            name={field('credential')}
            label="Credential"
            placeholder="MD, DO, NP"
            dataTestId={`${dataTestIds.faxDialog.credential}-${index}`}
          />
        </Box>
      </Box>
      <TextInput
        name={`recipients.${index}.organization`}
        label="Organization"
        dataTestId={`${dataTestIds.faxDialog.organization}-${index}`}
      />
      <PhoneInput
        name={`recipients.${index}.faxNumber`}
        label="Recipient Fax"
        required
        dataTestId={`${dataTestIds.faxDialog.faxNumber}-${index}`}
      />
      <PhoneInput
        name={`recipients.${index}.phoneNumber`}
        label="Phone number (for follow-up)"
        dataTestId={`${dataTestIds.faxDialog.phoneNumber}-${index}`}
      />

      {onSaveAsPcpChange && (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={isPcp}
              onChange={(event) => onSaveAsPcpChange(event.target.checked)}
              data-testid={`${dataTestIds.faxDialog.saveAsPcp}-${index}`}
            />
          }
          label="Save as patient's PCP"
        />
      )}
    </Box>
  );
};
