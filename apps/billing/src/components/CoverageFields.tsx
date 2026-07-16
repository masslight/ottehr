import {
  Autocomplete,
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
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  BILLING_INSURANCE_TYPE_OPTIONS,
  BillingInsuranceType,
  BillingPayerOption,
  REQUIRED_FIELD_ERROR_MESSAGE,
  VALUE_SETS,
} from 'utils';
import { searchBillingPayers } from '../api/api';
import { CoverageForm } from '../constants/coverage';
import { useApiClients } from '../hooks/useAppClients';
import { AddressFields } from './AddressFields';
import { DemographicFields } from './DemographicFields';

interface CoverageFormFieldsProps {
  // Insurance types already held by other active coverages (disabled in the Insurance Type dropdown).
  unavailableTypes?: BillingInsuranceType[];
}

export function CoverageFields({ unavailableTypes = [] }: CoverageFormFieldsProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { control, watch } = useFormContext<CoverageForm>();
  const [payerOptions, setPayerOptions] = useState<BillingPayerOption[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const selectedRelationship = watch('relationship');
  const selectedPayer = watch('payerId');

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const searchPayers = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        const queries = [searchBillingPayers(oystehrZambda, query ? { name: query } : {})];
        if (selectedPayer && !payerOptions.some((p) => p.id === selectedPayer)) {
          queries.push(searchBillingPayers(oystehrZambda, { payerId: selectedPayer }));
        }
        const [searchRes, getRes] = await Promise.all(queries);
        setPayerOptions([...(getRes?.payers ?? []), ...(searchRes?.payers ?? [])]);
      }, 300);
    },
    // payerOptions loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oystehrZambda, selectedPayer]
  );

  useEffect(() => {
    void searchPayers();
  }, [searchPayers]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25 }}>
        <Controller
          name="payerId"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <Autocomplete
              size="small"
              options={payerOptions}
              value={payerOptions.find((o) => o.id === field.value) ?? null}
              onChange={(_, v) => field.onChange(v?.id ?? '')}
              onInputChange={(_, val, reason) => {
                if (reason === 'input') searchPayers(val || undefined);
              }}
              onOpen={() => searchPayers()}
              getOptionLabel={(o) => o.name}
              renderOption={(props, o) => (
                <Box component="li" {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {o.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Payer ID: {o.payerId}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Payer *"
                  error={!!fieldError}
                  helperText={fieldError?.message}
                />
              )}
              isOptionEqualToValue={(o, v) => o.id === v.id}
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
