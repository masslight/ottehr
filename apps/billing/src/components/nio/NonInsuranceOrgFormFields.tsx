import { Box, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { ContactsPanel } from './ContactsPanel';
import { CoversSection } from './CoversSection';
import { NioAddressFields } from './NioAddressFields';

// The whole NIO form body — org fields + covers on the left, contacts on the right — shared by
// the create dialog and the detail page's edit mode. Must render inside a FormProvider whose
// values are a NonInsuranceOrgForm.
export function NonInsuranceOrgFormFields(): ReactElement {
  const { control } = useFormContext();
  return (
    <Box sx={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <Box sx={{ flex: 2, minWidth: 420, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Controller
          name="name"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              label="Organization Name *"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!error}
              helperText={error?.message}
            />
          )}
        />
        <Controller
          name="employer"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />}
              label="Employer"
            />
          )}
        />
        <Typography variant="subtitle1" color="primary.dark" fontWeight={600}>
          Organization Address
        </Typography>
        <NioAddressFields prefix="address" />
        <CoversSection />
      </Box>
      <Box
        sx={{
          flex: 1,
          minWidth: 280,
          borderLeft: { md: 1 },
          borderColor: { md: 'divider' },
          pl: { md: 5 },
        }}
      >
        <ContactsPanel />
      </Box>
    </Box>
  );
}
