import { Box, FormControl, FormControlLabel, Radio, RadioGroup, Skeleton, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect } from 'react';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useSaveChartData } from '../../../../state';
import { AdditionalBooleanQuestionsFieldsNames, convertToBoolean, ObservationBooleanFieldDTO } from 'utils';
import { setNavigationDisable } from '../../../../../features/css-module/context/NavigationContext';
import { dataTestIds } from '../../../../../constants/data-test-ids';

export const AdditionalQuestionEdit = ({
  label,
  field,
  value,
  isChartDataLoading,
}: {
  label: string;
  field: AdditionalBooleanQuestionsFieldsNames;
  value?: boolean;
  isChartDataLoading?: boolean;
}): JSX.Element => {
  const { chartData, updateObservation } = getSelectors(useAppointmentStore, ['chartData', 'updateObservation']);

  const { mutate, isLoading } = useSaveChartData();
  const normalizedValue = value !== undefined ? String(value) : '';

  useEffect(() => {
    setNavigationDisable({ [`additional-question-${label}`]: isLoading });
  }, [isLoading, label]);

  const onChange = (value: string, field: AdditionalBooleanQuestionsFieldsNames): void => {
    const currentObservation = chartData?.observations?.find((observation) => observation.field === field);

    const newValue = convertToBoolean(value);

    if (currentObservation?.value === newValue) return;

    const updatedObservation: ObservationBooleanFieldDTO = currentObservation
      ? { ...currentObservation, value: newValue }
      : { field, value: newValue };

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
      }}
      data-testid={dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(field)}
    >
      <Typography sx={{ flex: '0 1 calc(100% - 98px)' }}>{label}</Typography>
      {isChartDataLoading ? (
        <Skeleton variant="rectangular" width={100} height={25} />
      ) : (
        <FormControl sx={{ flex: '0 0 88px' }}>
          <RadioGroup
            sx={{ flexDirection: 'row', flexWrap: 'nowrap' }}
            name={field}
            value={normalizedValue}
            onChange={(e) => onChange(e.target.value, field)}
          >
            <FormControlLabel value="true" control={<Radio disabled={isLoading} sx={{ p: 0 }} />} label="Yes" />
            <FormControlLabel
              sx={{ mr: 0 }}
              value="false"
              control={<Radio disabled={isLoading} sx={{ p: 0 }} />}
              label="No"
            />
          </RadioGroup>
        </FormControl>
      )}
    </Box>
  );
};

export const AdditionalQuestionView: FC<{
  label: string;
  value: boolean | undefined;
  isLoading: boolean;
  field: AdditionalBooleanQuestionsFieldsNames;
}> = ({ label, value, isLoading, field }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
    }}
    data-testid={dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(field)}
  >
    <Typography>{label}</Typography>
    {isLoading ? (
      <Skeleton>
        <Typography>Yes</Typography>
      </Skeleton>
    ) : (
      <Typography>{value === true ? 'Yes' : value === false ? 'No' : ''}</Typography>
    )}
  </Box>
);
