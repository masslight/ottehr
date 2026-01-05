import { otherColors } from '@ehrTheme/colors';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { CompleteConfiguration } from 'src/components/CompleteConfiguration';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { dataTestIds } from 'src/constants/data-test-ids';
import { APIErrorCode, DIAGNOSIS_MAKE_PRIMARY_BUTTON, DiagnosisDTO, IcdSearchResponse } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useICD10SearchNew } from '../../stores/appointment/appointment.queries';
import { useChartData, useDeleteChartData, useSaveChartData } from '../../stores/appointment/appointment.store';
import { useAppFlags } from '../../stores/contexts/useAppFlags';
import { DiagnosesField } from './DiagnosesField';

export const DiagnosesContainer: FC = () => {
  const { chartData, setPartialChartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutateAsync: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const { error: icdSearchError, isLoading: isNlmLoading } = useICD10SearchNew({ search: 'E11' });

  const nlmApiKeyMissing = (icdSearchError as any)?.code === APIErrorCode.MISSING_NLM_API_KEY_ERROR;

  const isLoading = isSaveLoading || isDeleteLoading;

  const diagnoses = chartData?.diagnosis || [];
  const primaryDiagnosis = diagnoses.find((item) => item.isPrimary);
  const otherDiagnoses = diagnoses.filter((item) => !item.isPrimary);

  const { isInPerson } = useAppFlags();

  const getUpdatedDiagnoses = (
    oldDiagnoses: DiagnosisDTO[],
    updatedDiagnoses: DiagnosisDTO[] | undefined,
    filterOn: 'resourceId' | 'code' = 'resourceId'
  ): DiagnosisDTO[] =>
    oldDiagnoses.map((prevDiagnosis) => {
      const updatedDiagnosis = updatedDiagnoses?.find((uD) => uD[filterOn] === prevDiagnosis[filterOn]);
      return updatedDiagnosis || prevDiagnosis;
    });

  const onAdd = (value: IcdSearchResponse['codes'][number]): void => {
    const preparedValue = { ...value, isPrimary: !primaryDiagnosis };
    const newDiagnoses = [...diagnoses, preparedValue];
    const previousDiagnoses = [...diagnoses];

    // Optimistic update
    setPartialChartData({ diagnosis: newDiagnoses }, { invalidateQueries: false });
    saveChartData(
      {
        diagnosis: [preparedValue],
      },
      {
        onSuccess: (data) => {
          const addedDiagnoses = data.chartData.diagnosis;
          setPartialChartData({
            diagnosis: getUpdatedDiagnoses(newDiagnoses, addedDiagnoses, 'code'),
          });
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while adding diagnosis. Please try again.', { variant: 'error' });
          // Rollback to previous state
          setPartialChartData({
            diagnosis: previousDiagnoses,
          });
        },
      }
    );
  };

  const onDelete = async (resourceId: string): Promise<void> => {
    const preparedValue = diagnoses.find((item) => item.resourceId === resourceId)!;
    const prevDiagnoses = [...diagnoses];
    let optimisticDiagnoses = diagnoses.filter((item) => item.resourceId !== resourceId);

    if (preparedValue.isPrimary && otherDiagnoses.length > 0) {
      const firstAppropriateDiagnosis = otherDiagnoses.find((diagnosis) => !diagnosis.code.startsWith('W'));

      if (firstAppropriateDiagnosis) {
        // Optimistically promote to primary
        optimisticDiagnoses = optimisticDiagnoses.map((item) =>
          item.resourceId === firstAppropriateDiagnosis.resourceId ? { ...item, isPrimary: true } : item
        );
      }
    }

    // Optimistic update
    setPartialChartData({ diagnosis: optimisticDiagnoses }, { invalidateQueries: false });

    await deleteChartData(
      {
        diagnosis: [preparedValue],
      },
      {
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting diagnosis. Please try again.', { variant: 'error' });
          setPartialChartData({ diagnosis: prevDiagnoses });
        },
      }
    );

    if (preparedValue.isPrimary && otherDiagnoses.length > 0) {
      const firstAppropriateDiagnosis = otherDiagnoses.find((diagnosis) => !diagnosis.code.startsWith('W'));

      if (firstAppropriateDiagnosis) {
        const otherDiagnosis = { ...firstAppropriateDiagnosis, isPrimary: true };

        saveChartData(
          {
            diagnosis: [otherDiagnosis],
          },
          {
            onSuccess: (data) => {
              const updatedDiagnoses = data.chartData.diagnosis;
              setPartialChartData({
                diagnosis: getUpdatedDiagnoses(optimisticDiagnoses, updatedDiagnoses),
              });
            },
            onError: () => {
              enqueueSnackbar(
                'An error has occurred while setting primary diagnosis. Please try to set primary diagnosis manually.',
                { variant: 'error' }
              );
              setPartialChartData({
                diagnosis: optimisticDiagnoses.map((item) =>
                  item.resourceId === otherDiagnosis.resourceId ? { ...item, isPrimary: false } : item
                ),
              });
            },
          }
        );
      }
    }
  };

  const onMakePrimary = (resourceId: string): void => {
    const oldDiagnoses = [...diagnoses];
    const value = diagnoses.find((item) => item.resourceId === resourceId)!;
    const previousAndNewValues = [];
    previousAndNewValues.push({ ...value, isPrimary: true }); // prepared diagnosis
    if (primaryDiagnosis) previousAndNewValues.push({ ...primaryDiagnosis, isPrimary: false }); // previous diagnosis

    // Optimistic update
    const optimisticDiagnoses = diagnoses.map((item) => {
      if (item.isPrimary) {
        return { ...item, isPrimary: false };
      }
      if (item.resourceId === resourceId) {
        return { ...item, isPrimary: true };
      }
      return item;
    });

    // Optimistic update
    setPartialChartData({ diagnosis: optimisticDiagnoses }, { invalidateQueries: false });

    saveChartData(
      {
        diagnosis: previousAndNewValues,
      },
      {
        onSuccess: (data) => {
          const updatedDiagnoses = data.chartData.diagnosis;
          setPartialChartData({
            diagnosis: getUpdatedDiagnoses(optimisticDiagnoses, updatedDiagnoses),
          });
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while changing primary diagnosis. Please try again.', {
            variant: 'error',
          });
          // Rollback to previous state
          setPartialChartData({
            diagnosis: oldDiagnoses,
          });
        },
      }
    );
  };

  const handleSetup = (): void => {
    window.open('https://docs.oystehr.com/ottehr/setup/terminology/', '_blank');
  };
  const addedViaLabOrderInfo = (
    <GenericToolTip title="Added during lab order" placement="right">
      <InfoOutlinedIcon style={{ color: otherColors.disabled, height: '15px', width: '15px' }} />
    </GenericToolTip>
  );

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.diagnosisContainer.allDiagnosesContainer}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <AssessmentTitle>{isInPerson ? 'Dx' : 'Diagnoses'}</AssessmentTitle>
        {!isReadOnly && <DiagnosesField onChange={onAdd} disabled={isLoading} disableForPrimary={!primaryDiagnosis} />}
      </Box>

      {isReadOnly && diagnoses.length === 0 && <Typography color="secondary.light">Not provided</Typography>}
      {isNlmLoading ? <CircularProgress /> : nlmApiKeyMissing && <CompleteConfiguration handleSetup={handleSetup} />}

      {primaryDiagnosis && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AssessmentTitle>Primary *</AssessmentTitle>
          <ActionsList
            data={[primaryDiagnosis]}
            getKey={(value, index) => value.resourceId || index}
            renderItem={(value) => (
              <Typography data-testid={dataTestIds.diagnosisContainer.primaryDiagnosis}>
                {value.display} {value.code} {value.addedViaLabOrder && addedViaLabOrderInfo}
              </Typography>
            )}
            renderActions={
              isReadOnly
                ? undefined
                : (value) => (
                    <DeleteIconButton
                      dataTestId={dataTestIds.diagnosisContainer.primaryDiagnosisDeleteButton}
                      disabled={isLoading || !value.resourceId}
                      onClick={() => onDelete(value.resourceId!)}
                    />
                  )
            }
          />
        </Box>
      )}

      {otherDiagnoses.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AssessmentTitle>Secondary (optional)</AssessmentTitle>
          <ActionsList
            data={otherDiagnoses}
            getKey={(value, index) => value.resourceId || index}
            renderItem={(value) => (
              <Typography data-testid={dataTestIds.diagnosisContainer.secondaryDiagnosis}>
                {value.display} {value.code} {value.addedViaLabOrder && addedViaLabOrderInfo}
              </Typography>
            )}
            renderActions={
              isReadOnly
                ? undefined
                : (value) => (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {!value.code.startsWith('W') && (
                        <Button
                          disabled={isLoading || !value.resourceId}
                          onClick={() => onMakePrimary(value.resourceId!)}
                          size="small"
                          data-testid={dataTestIds.diagnosisContainer.makePrimaryButton}
                          sx={{ textTransform: 'none', fontWeight: 500 }}
                        >
                          {DIAGNOSIS_MAKE_PRIMARY_BUTTON}
                        </Button>
                      )}
                      <DeleteIconButton
                        dataTestId={dataTestIds.diagnosisContainer.secondaryDiagnosisDeleteButton}
                        disabled={isLoading || !value.resourceId}
                        onClick={() => onDelete(value.resourceId!)}
                      />
                    </Box>
                  )
            }
            divider
          />
        </Box>
      )}
    </Box>
  );
};
