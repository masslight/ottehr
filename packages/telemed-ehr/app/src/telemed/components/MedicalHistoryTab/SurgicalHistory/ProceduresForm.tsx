import React, { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useChartDataArrayValue } from '../../../hooks';
import { Autocomplete, Box, Button, Card, Divider, IconButton, TextField, Typography } from '@mui/material';
import { otherColors } from '../../../../CustomThemeProvider';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

export const ProceduresForm: FC = () => {
  const methods = useForm<{
    name: string;
  }>({
    defaultValues: {
      name: '',
    },
  });
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  const { control, handleSubmit, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: procedures } = useChartDataArrayValue('procedures', reset);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          mb: procedures.length || isChartDataLoading ? 2 : 0,
        }}
      >
        {isChartDataLoading ? (
          <ProviderSideListSkeleton />
        ) : (
          procedures.map((procedure, index, arr) => (
            <Box key={procedure.resourceId!}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography>{procedure.name}</Typography>
                <IconButton
                  disabled={isLoading}
                  onClick={() => onRemove(procedure.resourceId!)}
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
            name="name"
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
                    label="Type of surgery"
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
              Add to the surgeries
            </Button>
          </Box>
        </Card>
      </form>
    </Box>
  );
};
