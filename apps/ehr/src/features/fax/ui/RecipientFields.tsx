import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, Checkbox, FormControlLabel, IconButton, Radio, RadioGroup } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AddressBookPicker } from 'src/features/address-book/AddressBookPicker';
import { useContactFields } from 'src/features/address-book/useContactFields';
import { isEmailValid } from 'utils/lib/helpers/helpers';
import { FAX_RECIPIENT_CREDENTIAL_NEEDS_NAME_MESSAGE } from 'utils/lib/types/api/fax.types';
import { FaxFormValues, FaxRecipientChannel } from '../model/types';

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
  const { control, getValues } = useFormContext<FaxFormValues>();
  const channel = useWatch({ control, name: `recipients.${index}.channel` });

  const field = (
    key: 'name' | 'credential' | 'organization' | 'channel' | 'faxNumber' | 'email' | 'phoneNumber'
  ): `recipients.${number}.${typeof key}` => `recipients.${index}.${key}`;

  // The credential has its own field, so the name stays a plain name; the cover sheet joins them.
  const { onSelect, toContact } = useContactFields({
    organizationName: field('organization'),
    name: field('name'),
    credential: field('credential'),
    fax: field('faxNumber'),
    email: field('email'),
    phone: field('phoneNumber'),
  });

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
        name={field('organization')}
        label="Organization"
        dataTestId={`${dataTestIds.faxDialog.organization}-${index}`}
        onSelect={onSelect}
        toContact={toContact}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flex: '2 1 0', minWidth: 0 }}>
          <TextInput
            name={field('name')}
            label="Recipient's name"
            dataTestId={`${dataTestIds.faxDialog.recipientName}-${index}`}
          />
        </Box>
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
          <TextInput
            name={field('credential')}
            label="Credential"
            placeholder="MD, DO, NP"
            validate={(value) =>
              !value.trim() || !!getValues(field('name'))?.trim() || FAX_RECIPIENT_CREDENTIAL_NEEDS_NAME_MESSAGE
            }
            dataTestId={`${dataTestIds.faxDialog.credential}-${index}`}
          />
        </Box>
      </Box>

      <Controller
        name={field('channel')}
        control={control}
        render={({ field }) => (
          <RadioGroup
            row
            value={field.value}
            aria-label="Send by"
            data-testid={`${dataTestIds.faxDialog.channel}-${index}`}
            // Both addresses stay in the form while the user switches; only the chosen channel's is sent.
            onChange={(event) => field.onChange(event.target.value as FaxRecipientChannel)}
          >
            <FormControlLabel value="fax" control={<Radio size="small" />} label="Fax" />
            <FormControlLabel value="email" control={<Radio size="small" />} label="Email" />
          </RadioGroup>
        )}
      />

      {channel === 'email' ? (
        <TextInput
          name={field('email')}
          label="Recipient Email"
          required
          validate={(value) => isEmailValid(value.trim()) || 'Enter a valid email address'}
          dataTestId={`${dataTestIds.faxDialog.email}-${index}`}
        />
      ) : (
        <PhoneInput
          name={field('faxNumber')}
          label="Recipient Fax"
          required
          dataTestId={`${dataTestIds.faxDialog.faxNumber}-${index}`}
        />
      )}
      <PhoneInput
        name={field('phoneNumber')}
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
