import { InfoOutlined } from '@mui/icons-material';
import { Box, Button, CircularProgress, TextField, Tooltip, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

const mechanismOfInjurySuggestion = (
  <Tooltip
    // open={true}
    // placement="bottom-start"
    componentsProps={{
      tooltip: {
        sx: {
          backgroundColor: 'white',
          color: 'black',
          padding: 1,
          boxShadow: `
            0px 1px 8px 0px rgba(0, 0, 0, 0.12),
            0px 3px 4px 0px rgba(0, 0, 0, 0.14),
            0px 3px 3px -2px rgba(0, 0, 0, 0.20)`,
        },
      },
    }}
    title={
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          All types of injury:
        </Typography>
        <ul>
          <Typography variant="body1">
            <li>When did the injury occur?</li>
          </Typography>
          <Typography variant="body1">
            <li>How did the injury happen?</li>
          </Typography>
          <Typography variant="body1">
            <li>What body part(s) were injured?</li>
          </Typography>
          <Typography variant="body1">
            <li>What symptoms were noticed immediately after the injury?</li>
          </Typography>
        </ul>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          Work related injury:
        </Typography>
        <ul>
          <Typography variant="body1">
            <li>Where did the injury occur?</li>
          </Typography>
          <Typography variant="body1">
            <li>What was the patient doing at the time of injury?</li>
          </Typography>
        </ul>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          Auto accident injury:
        </Typography>
        <ul>
          <Typography variant="body1">
            <li>Was the patient the driver, passenger, pedestrian, or cyclist?</li>
          </Typography>
          <Typography variant="body1">
            <li>What type of collision occurred?</li>
          </Typography>
          <Typography variant="body1">
            <li>Approximate speed of vehicle(s)?</li>
          </Typography>
          <Typography variant="body1">
            <li>Was the patient wearing a seatbelt?</li>
          </Typography>
          <Typography variant="body1">
            <li>Did airbags deploy?</li>
          </Typography>
          <Typography variant="body1">
            <li>Did the patient lose consciousness at any time?</li>
          </Typography>
        </ul>
      </Box>
    }
  >
    <Button startIcon={<InfoOutlined />} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
      What to include in the MOI?
    </Button>
  </Tooltip>
);

export const MechanismOfInjuryField: FC = () => {
  const { data: chartDataFields } = useChartFields({
    requestedFields: {
      mechanismOfInjury: {
        _tag: 'mechanism-of-injury',
      },
    },
  });

  const methods = useForm({
    defaultValues: {
      mechanismOfInjury: chartDataFields?.mechanismOfInjury?.text || '',
    },
  });

  useEffect(() => {
    if (chartDataFields?.mechanismOfInjury?.text !== undefined) {
      methods.setValue('mechanismOfInjury', chartDataFields.mechanismOfInjury.text);
    }
  }, [chartDataFields?.mechanismOfInjury?.text, methods]);

  const { control } = methods;

  const { onValueChange, isLoading, isChartDataLoading } = useDebounceNotesField('mechanismOfInjury');

  return (
    <>
      <Controller
        name="mechanismOfInjury"
        control={control}
        render={({ field: { value, onChange } }) => (
          <TextField
            value={value}
            onChange={(e) => {
              onChange(e);
              onValueChange(e.target.value, {
                refetchChartDataOnSave: true,
              });
            }}
            disabled={isChartDataLoading}
            label="Mechanism of Injury"
            fullWidth
            multiline
            data-testid={dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes}
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
      {mechanismOfInjurySuggestion}
    </>
  );
};

export const MechanismOfInjuryFieldReadOnly: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      mechanismOfInjury: { _tag: 'mechanism-of-injury' },
    },
  });

  const mechanismOfInjury = chartFields?.mechanismOfInjury?.text;

  if (!mechanismOfInjury) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="subtitle2" color="primary.dark">
        Mechanism of Injury
      </Typography>
      <Typography variant="body2">{mechanismOfInjury}</Typography>
      {mechanismOfInjurySuggestion}
    </Box>
  );
};
