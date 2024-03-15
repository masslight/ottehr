import React, { FC } from 'react';
import { Autocomplete, Box, Button, Card, Divider, IconButton, TextField, Typography } from '@mui/material';
import { otherColors } from '../../../../CustomThemeProvider';
import { Controller, useForm } from 'react-hook-form';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { useChartDataArrayValue } from '../../../hooks';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

export const MedicalConditionsProviderColumn: FC = () => {
  const methods = useForm<{
    description: string;
  }>({
    defaultValues: {
      description: '',
    },
  });
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  const { control, handleSubmit, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: conditions } = useChartDataArrayValue('conditions', reset);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          mb: conditions.length || isChartDataLoading ? 2 : 0,
        }}
      >
        {isChartDataLoading ? (
          <ProviderSideListSkeleton />
        ) : (
          conditions.map((condition, index, arr) => (
            <Box key={condition.resourceId!}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography>{condition.description}</Typography>
                <IconButton
                  disabled={isLoading}
                  onClick={() => onRemove(condition.resourceId!)}
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
            name="description"
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
                    label="Medical condition"
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
              Add to the medical conditions
            </Button>
          </Box>
        </Card>
      </form>
    </Box>
  );
};
