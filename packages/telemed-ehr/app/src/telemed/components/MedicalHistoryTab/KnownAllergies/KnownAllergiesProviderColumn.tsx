import React, { FC } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { Controller, useForm } from 'react-hook-form';
import { otherColors } from '../../../../CustomThemeProvider';
import { useChartDataArrayValue } from '../../../hooks';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

const mapOptionToLabel = {
  food: 'Food',
  medication: 'Medication',
  other: 'Other',
};

export const KnownAllergiesProviderColumn: FC = () => {
  const methods = useForm<{
    agentOrSubstance: string;
    type: keyof typeof mapOptionToLabel;
  }>({
    defaultValues: {
      agentOrSubstance: '',
      type: 'food',
    },
  });
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  const { control, handleSubmit, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: allergies } = useChartDataArrayValue('allergies', reset);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          mb: allergies.length || isChartDataLoading ? 2 : 0,
        }}
      >
        {isChartDataLoading ? (
          <ProviderSideListSkeleton />
        ) : (
          allergies.map((allergy, index, arr) => (
            <Box key={allergy.resourceId!}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography>
                  {allergy.agentOrSubstance} ({allergy.type})
                </Typography>
                <IconButton
                  disabled={isLoading}
                  onClick={() => onRemove(allergy.resourceId!)}
                  size="small"
                  sx={{ color: otherColors.endCallButton }}
                >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Box>
              {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
            </Box>
          ))
        )}
      </Box>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card
          elevation={0}
          sx={{
            p: 3,
            backgroundColor: otherColors.formCardBg,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Controller
            name="type"
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <FormControl>
                <FormLabel error={!!error}>
                  <Typography variant="subtitle2">Type *</Typography>
                </FormLabel>
                <RadioGroup value={value} onChange={onChange} row>
                  {(Object.keys(mapOptionToLabel) as (keyof typeof mapOptionToLabel)[]).map((option) => (
                    <FormControlLabel
                      disabled={isLoading || isChartDataLoading}
                      key={option}
                      value={option}
                      control={<Radio />}
                      label={mapOptionToLabel[option]}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}
          />
          <Controller
            name="agentOrSubstance"
            control={control}
            rules={{ required: true }}
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <Autocomplete
                value={value || null}
                onChange={(_e, data) => onChange(data || '')}
                fullWidth
                size="small"
                disablePortal
                disabled={isLoading || isChartDataLoading}
                options={['exampleone', 'exampletwo', 'examplethree']}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    helperText={error ? error.message : null}
                    error={!!error}
                    label="Agent/Substance"
                    placeholder="Search"
                  />
                )}
              />
            )}
          />
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Button
              disabled={isLoading || isChartDataLoading}
              type="submit"
              variant="outlined"
              sx={{ textTransform: 'none', fontSize: '14px', fontWeight: 700, borderRadius: 10 }}
            >
              Add to the known allergies
            </Button>
          </Box>
        </Card>
      </form>
    </Box>
  );
};
