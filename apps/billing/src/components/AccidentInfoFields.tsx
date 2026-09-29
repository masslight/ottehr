import { Box, Checkbox, FormControlLabel, FormGroup, FormHelperText, FormLabel, TextField } from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { CLAIM_ACCIDENT_TYPE, CLAIM_ACCIDENT_TYPE_DISPLAY_VALUES } from 'utils/lib/helpers/rcm/constants';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { AccidentInfoData } from '../constants/accidentInfo';
import { DateInput } from './DateInput';

export function AccidentInfoFields(): ReactElement {
  const { control, setValue, watch } = useFormContext<AccidentInfoData>();
  const accidentType = watch('accidentType');
  useEffect(() => {
    if (!accidentType.includes('auto')) {
      setValue('accidentState', '');
    }
  }, [accidentType, setValue]);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.25, maxWidth: 680 }}>
      <Controller
        name="accidentType"
        control={control}
        render={({ field, fieldState: { error: fieldError } }) => (
          <>
            <FormLabel component="legend">Accident Type</FormLabel>
            <FormGroup row>
              {Object.entries(CLAIM_ACCIDENT_TYPE_DISPLAY_VALUES).map(([type, display]) => (
                <FormControlLabel
                  key={type}
                  label={display}
                  control={
                    <Checkbox
                      size="small"
                      checked={field.value.includes(type as CLAIM_ACCIDENT_TYPE)}
                      onChange={(e) => {
                        field.onChange(
                          e.target.checked ? [...field.value, type] : field.value.filter((value) => value !== type)
                        );
                      }}
                    />
                  }
                />
              ))}
            </FormGroup>
            {fieldError ? <FormHelperText>fieldError.message</FormHelperText> : <></>}
          </>
        )}
      />
      {accidentType.includes('auto') ? (
        <Controller
          name="accidentState"
          control={control}
          rules={{ required: accidentType.includes('auto') ? REQUIRED_FIELD_ERROR_MESSAGE : undefined }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Accident State"
              size="small"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
      ) : (
        <></>
      )}
      <Controller
        name="accidentDate"
        control={control}
        rules={{ required: accidentType.length ? REQUIRED_FIELD_ERROR_MESSAGE : undefined }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <DateInput
            label="Accident Date"
            size="small"
            value={field.value ?? ''}
            onChange={(value) => field.onChange(value)}
            error={!!fieldError}
            helperText={fieldError?.message}
          />
        )}
      />
    </Box>
  );
}
