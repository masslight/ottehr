import { Box, InputAdornment, MenuItem, TextField, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { NIO_ORG_TYPE_LABELS, NIO_ORG_TYPES } from '../../constants/nioPrototype';
import { ContactsPanel } from './ContactsPanel';
import { CoversSection } from './CoversSection';
import { NioAddressFields } from './NioAddressFields';

const DOC_PRICING_FIELDS = [
  { name: 'docPricing.perClaim', label: 'Per Claim' },
  { name: 'docPricing.perDocument', label: 'Per Document' },
  { name: 'docPricing.perPage', label: 'Per Page' },
] as const;

// The whole NIO form body — org fields + covers on the left, contacts on the right — shared by
// the create dialog and the detail page's edit mode. Must render inside a FormProvider whose
// values are a NonInsuranceOrgForm.
export function NonInsuranceOrgFormFields(): ReactElement {
  const { control } = useFormContext();
  const orgType = useWatch({ control, name: 'type' });
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
          name="type"
          control={control}
          render={({ field }) => (
            <TextField
              label="Type"
              select
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
            >
              {NIO_ORG_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {NIO_ORG_TYPE_LABELS[type]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <TextField
              label="Notes"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
            />
          )}
        />
        <Typography variant="subtitle1" color="primary.dark" fontWeight={600}>
          Organization Address
        </Typography>
        <NioAddressFields prefix="address" />
        {orgType === 'document-requestor' ? (
          <>
            <Typography variant="subtitle1" color="primary.dark" fontWeight={600}>
              Document Invoice Pricing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Additive — each invoiced claim is priced as per-claim + documents × per-document + pages × per-page.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {DOC_PRICING_FIELDS.map(({ name, label }) => (
                <Controller
                  key={name}
                  name={name}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={label}
                      type="number"
                      size="small"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  )}
                />
              ))}
            </Box>
          </>
        ) : (
          <CoversSection />
        )}
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
