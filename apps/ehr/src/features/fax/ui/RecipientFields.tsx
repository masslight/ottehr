import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, Checkbox, FormControlLabel, IconButton } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AddressBookPicker } from 'src/features/address-book/AddressBookPicker';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { FaxFormValues } from '../model/types';

interface RecipientFieldsProps {
  index: number;
  /** Whether this recipient is the one that will be saved as the patient's PCP (radio across the list). */
  isPcp: boolean;
  /** Present only for the original single-visit flow, which is the only flow that manages the PCP. */
  onSaveAsPcpChange?: (value: boolean) => void;
  onRemove?: () => void;
}

/** One recipient row. Text/phone fields bind to the parent react-hook-form context by name. */
export const RecipientFields: FC<RecipientFieldsProps> = ({ index, isPcp, onSaveAsPcpChange, onRemove }) => {
  const { setValue } = useFormContext<FaxFormValues>();
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

      <AddressBookPicker
        name={`recipients.${index}.name`}
        label="Recipient's name"
        dataTestId={`${dataTestIds.faxDialog.recipientName}-${index}`}
        onSelect={(contact) => {
          // An org-only contact is already named in the recipient field; don't repeat it here.
          const hasPerson = !!(contact.firstName || contact.lastName);
          setValue(`recipients.${index}.organization`, (hasPerson && contact.organizationName) || '');
          setValue(`recipients.${index}.faxNumber`, formatPhoneNumberDisplay(contact.fax), { shouldValidate: true });
          setValue(`recipients.${index}.phoneNumber`, formatPhoneNumberDisplay(contact.phone));
        }}
      />
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
