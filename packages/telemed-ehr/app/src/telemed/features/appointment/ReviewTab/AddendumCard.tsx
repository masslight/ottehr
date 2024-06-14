import React, { FC } from 'react';
import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { AccordionCard } from '../../../components';
import { useDebounceNotesField } from '../../../hooks';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { Controller, useForm } from 'react-hook-form';

export const AddendumCard: FC = () => {
  const { chartData, isReadOnly } = getSelectors(useAppointmentStore, ['chartData', 'isReadOnly']);

  const addendumNote = chartData?.addendumNote?.text;
  const methods = useForm({
    defaultValues: {
      addendumNote: addendumNote || '',
    },
  });
  const { control } = methods;

  const { onValueChange, isLoading } = useDebounceNotesField('addendumNote');

  return (
    <AccordionCard label="Addendum">
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'start' }}>
        {isReadOnly ? (
          addendumNote ? (
            <Typography>{addendumNote}</Typography>
          ) : (
            <Typography color="secondary.light">Note not provided</Typography>
          )
        ) : (
          <Controller
            name="addendumNote"
            control={control}
            render={({ field: { value, onChange } }) => (
              <TextField
                value={value}
                onChange={(e) => {
                  onChange(e);
                  onValueChange(e.target.value);
                }}
                size="small"
                label="Note"
                fullWidth
                multiline
                InputProps={{
                  endAdornment: isLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CircularProgress size="20px" />
                    </Box>
                  ),
                }}
              />
            )}
          />
        )}
      </Box>
    </AccordionCard>
  );
};
