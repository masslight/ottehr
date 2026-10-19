import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { Box, Button, IconButton, Paper, TextField, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { emptyNioContactForm } from '../../constants/nonInsuranceOrg';
import { EmailInput } from '../input/EmailInput';
import { PhoneInput } from '../input/PhoneInput';

export function ContactsPanel(): ReactElement {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
          Contacts
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => append(emptyNioContactForm())}>
          Add Contact
        </Button>
      </Box>
      {fields.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No contacts added yet.
        </Typography>
      )}
      {fields.map((field, index) => (
        <Paper key={field.id} variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Contact {index + 1}
            </Typography>
            <IconButton size="small" aria-label={`Remove contact ${index + 1}`} onClick={() => remove(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <Controller
            name={`contacts.${index}.name`}
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field: nameField, fieldState: { error } }) => (
              <TextField
                label="Name *"
                size="small"
                fullWidth
                value={nameField.value}
                onChange={(e) => nameField.onChange(e.target.value)}
                error={!!error}
                helperText={error?.message}
              />
            )}
          />
          <Controller
            name={`contacts.${index}.title`}
            control={control}
            render={({ field: titleField }) => (
              <TextField
                label="Title"
                size="small"
                fullWidth
                value={titleField.value}
                onChange={(e) => titleField.onChange(e.target.value)}
              />
            )}
          />
          <PhoneInput name={`contacts.${index}.phone`} label="Phone" />
          <EmailInput name={`contacts.${index}.email`} label="Email" />
        </Paper>
      ))}
    </Box>
  );
}
