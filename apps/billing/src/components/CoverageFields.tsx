import {
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Box } from '@mui/system';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { VALUE_SETS } from 'utils/lib/ottehr-config/value-sets';
import { BillingInsuranceType } from 'utils/lib/types/data/billing/billing.schemas';
import { BILLING_INSURANCE_TYPE_OPTIONS } from 'utils/lib/types/data/billing/billing.types';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { CoverageForm } from '../constants/coverage';
import { AddressFields } from './AddressFields';
import { DemographicFields } from './DemographicFields';
import { PayerSelect } from './PayerSelect';

interface CoverageFormFieldsProps {
  // Insurance types already held by other active coverages (disabled in the Insurance Type dropdown).
  unavailableTypes?: BillingInsuranceType[];
  hideInsuranceType?: boolean;
}

export function CoverageFields({
  unavailableTypes = [],
  hideInsuranceType = false,
}: CoverageFormFieldsProps): ReactElement {
  const { control, watch } = useFormContext<CoverageForm>();

  const selectedRelationship = watch('relationship');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25 }}>
        <Controller
          name="payerId"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <PayerSelect
              multiple={false}
              value={field.value}
              onChange={field.onChange}
              label="Payer *"
              required
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
        <Controller
          name="memberId"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Member / Subscriber ID *"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
        {hideInsuranceType ? (
          <></>
        ) : (
          <Controller
            name="insuranceType"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <FormControl size="small" fullWidth>
                <InputLabel id="insurance-type-select-label" error={!!fieldError}>
                  Insurance Type *
                </InputLabel>
                <Select
                  aria-describedby={fieldError ? 'insurance-type-helper-text' : undefined}
                  label="Insurance Type *"
                  labelId="insurance-type-select-label"
                  size="small"
                  fullWidth
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  error={!!fieldError}
                >
                  {BILLING_INSURANCE_TYPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value} disabled={unavailableTypes.includes(o.value)}>
                      {o.label}
                      {unavailableTypes.includes(o.value) ? ' (already on file)' : ''}
                    </MenuItem>
                  ))}
                </Select>
                {fieldError ? (
                  <FormHelperText id={`insurance-type-helper-text`} error={true}>
                    {fieldError?.message}
                  </FormHelperText>
                ) : (
                  <></>
                )}
              </FormControl>
            )}
          />
        )}
        <Controller
          name="planType"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <FormControl size="small" fullWidth>
              <InputLabel id="plan-type-select-label" error={!!fieldError}>
                Plan Type *
              </InputLabel>
              <Select
                aria-describedby={fieldError ? 'plan-type-helper-text' : undefined}
                label="Plan Type *"
                labelId="plan-type-select-label"
                size="small"
                fullWidth
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={!!fieldError}
                renderValue={
                  field.value
                    ? undefined
                    : () => (
                        <Box component="span" sx={{ color: 'text.disabled' }}>
                          Select...
                        </Box>
                      )
                }
              >
                {VALUE_SETS.insuranceTypeOptions.map((option) => (
                  <MenuItem key={option.candidCode} value={option.candidCode}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              {fieldError ? (
                <FormHelperText id={`kind-helper-text`} error={true}>
                  {fieldError?.message}
                </FormHelperText>
              ) : (
                <></>
              )}
            </FormControl>
          )}
        />
      </Box>

      <Controller
        name="relationship"
        control={control}
        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <FormControl size="small" fullWidth>
            <InputLabel id="relationship-select-label" error={!!fieldError}>
              Patient's relationship to insured *
            </InputLabel>
            <Select
              aria-describedby={fieldError ? 'relationship-helper-text' : undefined}
              label="Patient's relationship to insured *"
              labelId="relationship-select-label"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
            >
              {VALUE_SETS.relationshipToInsuredOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
            {fieldError ? (
              <FormHelperText id={`kind-helper-text`} error={true}>
                {fieldError?.message}
              </FormHelperText>
            ) : (
              <></>
            )}
          </FormControl>
        )}
      />

      {selectedRelationship !== 'Self' && (
        <>
          <Divider textAlign="left">
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Policy holder
            </Typography>
          </Divider>
          <DemographicFields />

          <AddressFields />
        </>
      )}
    </Box>
  );
}
