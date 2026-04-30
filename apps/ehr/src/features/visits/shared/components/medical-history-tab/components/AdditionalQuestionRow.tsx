import { Box, FormControl, FormControlLabel, Radio, RadioGroup, Skeleton, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { setNavigationDisable } from 'src/features/visits/in-person/context/InPersonNavigationContext';
import { convertToBoolean, getScreeningQuestionField, ObservationDTO } from 'utils';
import { useChartData, useSaveChartData } from '../../../stores/appointment/appointment.store';

const FALLBACK_BOOLEAN_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export const AdditionalQuestionEdit = ({
  label,
  field,
  value,
  isChartDataLoading,
}: {
  label: string;
  field: string;
  value?: boolean | string;
  isChartDataLoading?: boolean;
}): JSX.Element => {
  const { chartData, updateObservation } = useChartData();
  const { mutate, isPending: isLoading } = useSaveChartData();

  const configOptions = getScreeningQuestionField(field)?.options;
  const renderedOptions =
    configOptions && configOptions.length > 0
      ? configOptions.map((opt) => ({
          value: opt.fhirValue,
          label: opt.label,
        }))
      : FALLBACK_BOOLEAN_OPTIONS;
  const isBooleanShaped = renderedOptions.every((opt) => convertToBoolean(opt.value) !== undefined);

  const selectedValue =
    typeof value === 'boolean'
      ? renderedOptions.find((opt) => convertToBoolean(opt.value) === value)?.value ?? ''
      : typeof value === 'string'
      ? value
      : '';

  useEffect(() => {
    setNavigationDisable({ [`additional-question-${label}`]: isLoading });
  }, [isLoading, label]);

  const onChange = (newFhirValue: string, fhirField: string): void => {
    const currentObservation = chartData?.observations?.find((observation) => observation.field === fhirField);

    let newValue: string | boolean | undefined;
    if (isBooleanShaped) {
      newValue = convertToBoolean(newFhirValue);
      if (newValue === undefined) return;
    } else {
      newValue = newFhirValue;
    }
    if (currentObservation?.value === newValue) return;

    const updatedObservation = (
      currentObservation
        ? {
            ...currentObservation,
            value: newValue,
          }
        : {
            field: fhirField,
            value: newValue,
          }
    ) as ObservationDTO;

    mutate(
      {
        observations: [updatedObservation],
      },
      {
        onSuccess: (data) => {
          if (!data.chartData.observations) return;

          const updatedObservation = data.chartData.observations[0];

          if (!updatedObservation) return;

          updateObservation(updatedObservation);
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while updating additional questions. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
  };
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 2,
      }}
      data-testid={dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(field)}
    >
      <Typography sx={{ flex: '1 1 auto' }}>{label}</Typography>
      {isChartDataLoading ? (
        <Skeleton variant="rectangular" width={100} height={25} />
      ) : (
        <FormControl sx={{ flex: '0 0 auto' }}>
          <RadioGroup
            sx={{ flexDirection: 'row', flexWrap: 'nowrap' }}
            name={field}
            value={selectedValue}
            onChange={(e) => onChange(e.target.value, field)}
          >
            {renderedOptions.map((opt, idx) => (
              <FormControlLabel
                key={opt.value}
                sx={idx === renderedOptions.length - 1 ? { mr: 0 } : undefined}
                value={opt.value}
                control={<Radio disabled={isLoading} sx={{ p: 0 }} />}
                label={opt.label}
              />
            ))}
          </RadioGroup>
        </FormControl>
      )}
    </Box>
  );
};

export const AdditionalQuestionView: FC<{
  label: string;
  value: string | null;
  isLoading: boolean;
  field: string;
}> = ({ label, value, isLoading, field }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 2,
    }}
    data-testid={dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(field)}
  >
    <Typography>{label}</Typography>
    {isLoading ? (
      <Skeleton>
        <Typography>Yes</Typography>
      </Skeleton>
    ) : (
      <Typography>{value || ''}</Typography>
    )}
  </Box>
);
