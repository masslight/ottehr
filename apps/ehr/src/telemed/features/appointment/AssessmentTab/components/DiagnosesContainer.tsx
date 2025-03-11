import React, { FC } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { IcdSearchResponse } from 'utils';
import { AssessmentTitle } from './AssessmentTitle';
import { DiagnosesField } from './DiagnosesField';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useDeleteChartData, useSaveChartData } from '../../../../state';
import { ActionsList, DeleteIconButton } from '../../../../components';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { dataTestIds } from '../../../../../constants/data-test-ids';

export const DiagnosesContainer: FC = () => {
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { mutate: saveChartData, isLoading: isSaveLoading } = useSaveChartData();
  const { mutateAsync: deleteChartData, isLoading: isDeleteLoading } = useDeleteChartData();

  const isLoading = isSaveLoading || isDeleteLoading;

  const diagnoses = chartData?.diagnosis || [];
  const primaryDiagnosis = diagnoses.find((item) => item.isPrimary);
  const otherDiagnoses = diagnoses.filter((item) => !item.isPrimary);

  const { css } = useFeatureFlags();

  const onAdd = (value: IcdSearchResponse['codes'][number]): void => {
    const preparedValue = { ...value, isPrimary: !primaryDiagnosis };

    saveChartData(
      {
        diagnosis: [preparedValue],
      },
      {
        onSuccess: (data) => {
          const diagnosis = (data.chartData.diagnosis || [])[0];
          if (diagnosis) {
            setPartialChartData({
              diagnosis: [...diagnoses, diagnosis],
            });
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while adding diagnosis. Please try again.', { variant: 'error' });
          setPartialChartData({
            diagnosis: diagnoses,
          });
        },
      }
    );
    setPartialChartData({ diagnosis: [...diagnoses, preparedValue] });
  };

  const onDelete = async (resourceId: string): Promise<void> => {
    let localDiagnoses = diagnoses;
    const preparedValue = localDiagnoses.find((item) => item.resourceId === resourceId)!;

    await deleteChartData(
      {
        diagnosis: [preparedValue],
      },
      {
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting diagnosis. Please try again.', { variant: 'error' });
        },
      }
    );
    localDiagnoses = localDiagnoses.filter((item) => item.resourceId !== resourceId);

    if (preparedValue.isPrimary && otherDiagnoses.length > 0) {
      const firstAppropriateDiagnosis = otherDiagnoses.find((diagnosis) => !diagnosis.code.startsWith('W'));

      if (firstAppropriateDiagnosis) {
        const otherDiagnosis = { ...firstAppropriateDiagnosis, isPrimary: true };
        const prevDiagnoses = localDiagnoses;

        saveChartData(
          {
            diagnosis: [otherDiagnosis],
          },
          {
            onError: () => {
              enqueueSnackbar(
                'An error has occurred while setting primary diagnosis. Please try to set primary diagnosis manually.',
                { variant: 'error' }
              );
              setPartialChartData({
                diagnosis: prevDiagnoses,
              });
            },
          }
        );

        localDiagnoses = localDiagnoses.map((item) =>
          item.resourceId === otherDiagnosis.resourceId ? otherDiagnosis : item
        );
      }
    }
    setPartialChartData({ diagnosis: localDiagnoses });
  };

  const onMakePrimary = (resourceId: string): void => {
    const value = diagnoses.find((item) => item.resourceId === resourceId)!;
    const preparedValue = { ...value, isPrimary: true };
    const previousPrimary = { ...primaryDiagnosis!, isPrimary: false };

    saveChartData(
      {
        diagnosis: [preparedValue, previousPrimary],
      },
      {
        onError: () => {
          enqueueSnackbar('An error has occurred while changing primary diagnosis. Please try again.', {
            variant: 'error',
          });
          setPartialChartData({
            diagnosis: diagnoses,
          });
        },
      }
    );

    setPartialChartData({
      diagnosis: diagnoses.map((item) => {
        if (item.isPrimary) {
          return { ...item, isPrimary: false };
        }
        if (item.resourceId === resourceId) {
          return { ...item, isPrimary: true };
        }
        return item;
      }),
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <AssessmentTitle>{css ? 'Dx' : 'Diagnoses'}</AssessmentTitle>
        {!isReadOnly && <DiagnosesField onChange={onAdd} disabled={isLoading} disableForPrimary={!primaryDiagnosis} />}
      </Box>

      {isReadOnly && diagnoses.length === 0 && <Typography color="secondary.light">Not provided</Typography>}

      {primaryDiagnosis && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AssessmentTitle>Primary *</AssessmentTitle>
          <ActionsList
            data={[primaryDiagnosis]}
            getKey={(value, index) => value.resourceId || index}
            renderItem={(value) => (
              <Typography>
                {value.display} {value.code}
              </Typography>
            )}
            renderActions={
              isReadOnly
                ? undefined
                : (value) => (
                    <DeleteIconButton
                      dataTestId={dataTestIds.diagnosisContainer.deleteButton}
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
              <Typography>
                {value.display} {value.code}
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
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Make Primary
                        </Button>
                      )}
                      <DeleteIconButton
                        dataTestId={dataTestIds.diagnosisContainer.deleteButton}
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
