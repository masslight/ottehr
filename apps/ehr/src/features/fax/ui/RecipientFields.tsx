import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, Checkbox, FormControlLabel, IconButton } from '@mui/material';
import { FC } from 'react';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';

interface RecipientFieldsProps {
  index: number;
  /** Whether this recipient is the one that will be saved as the patient's PCP (radio across the list). */
  isPcp: boolean;
  onSaveAsPcpChange: (value: boolean) => void;
  onRemove?: () => void;
}

/** One recipient row. Text/phone fields bind to the parent react-hook-form context by name. */
export const RecipientFields: FC<RecipientFieldsProps> = ({ index, isPcp, onSaveAsPcpChange, onRemove }) => (
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

    <TextInput
      name={`recipients.${index}.name`}
      label="Recipient's name"
      dataTestId={`${dataTestIds.faxDialog.recipientName}-${index}`}
    />
    <TextInput
      name={`recipients.${index}.organization`}
      label="Organization"
      dataTestId={`${dataTestIds.faxDialog.organization}-${index}`}
    />
    <PhoneInput
      name={`recipients.${index}.faxNumber`}
      label="Fax number"
      required
      dataTestId={`${dataTestIds.faxDialog.faxNumber}-${index}`}
    />
    <PhoneInput
      name={`recipients.${index}.phoneNumber`}
      label="Phone number (for follow-up)"
      dataTestId={`${dataTestIds.faxDialog.phoneNumber}-${index}`}
    />

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
  </Box>
);
