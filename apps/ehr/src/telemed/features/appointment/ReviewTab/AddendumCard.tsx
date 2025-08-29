import { Alert, Box, CircularProgress, TextField, useTheme } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AccordionCard } from '../../../components';
import { useDebounceNotesField } from '../../../hooks';
import { useChartData } from '../../../state';

export const AddendumCard: FC = () => {
  const { chartData } = useChartData();
  const addendumNote = chartData?.addendumNote?.text;

  const theme = useTheme();

  const methods = useForm({
    defaultValues: {
      addendumNote: addendumNote || '',
    },
  });

  useEffect(() => {
    if (!methods.getValues('addendumNote') && addendumNote) {
      methods.setValue('addendumNote', addendumNote);
    }
  }, [addendumNote, methods]);

  const { control } = methods;

  const { onValueChange, isLoading } = useDebounceNotesField('addendumNote');

  return (
    <AccordionCard label="Addendum">
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'start' }}>
        <Alert severity="info" sx={{ bgcolor: theme.palette.info.light, color: theme.palette.info.dark }}>
          When adding an addendum to this Progress note, please enter your name and date/time
        </Alert>

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
              label="Notes"
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
      </Box>
    </AccordionCard>
  );
};
