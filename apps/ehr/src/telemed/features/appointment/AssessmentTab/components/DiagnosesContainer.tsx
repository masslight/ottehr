import { otherColors } from '@ehrTheme/colors';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Button, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { APIErrorCode, DIAGNOSIS_MAKE_PRIMARY_BUTTON, DiagnosisDTO, IcdSearchResponse } from 'utils';
import { CompleteConfiguration } from '../../../../../components/CompleteConfiguration';
import { GenericToolTip } from '../../../../../components/GenericToolTip';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { ActionsList, DeleteIconButton } from '../../../../components';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useChartData, useDeleteChartData, useICD10SearchNew, useSaveChartData } from '../../../../state';
import { AssessmentTitle } from './AssessmentTitle';
import { DiagnosesField } from './DiagnosesField';

export const DiagnosesContainer: FC = () => {
  const { chartData, setPartialChartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutateAsync: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const { error: icdSearchError } = useICD10SearchNew({ search: 'E11' });

  const nlmApiKeyMissing = (icdSearchError as any)?.code === APIErrorCode.MISSING_NLM_API_KEY_ERROR;

  const isLoading = isSaveLoading || isDeleteLoading;

  const diagnoses = chartData?.diagnosis || [];
  const primaryDiagnosis = diagnoses.find((item) => item.isPrimary);
  const otherDiagnoses = diagnoses.filter((item) => !item.isPrimary);

  const { css } = useFeatureFlags();

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
          setPartialChartData({
            diagnosis: diagnoses,
          });
        },
      }
    );
    setPartialChartData({ diagnosis: newDiagnoses });
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
        const prevDiagnoses = [...localDiagnoses];

        saveChartData(
          {
            diagnosis: [otherDiagnosis],
          },
          {
            onSuccess: (data) => {
              const updatedDiagnoses = data.chartData.diagnosis;
              setPartialChartData({
                diagnosis: getUpdatedDiagnoses(prevDiagnoses, updatedDiagnoses),
              });
            },
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
    const oldDiagnoses = [...diagnoses];
    const value = diagnoses.find((item) => item.resourceId === resourceId)!;
    const previousAndNewValues = [];
    previousAndNewValues.push({ ...value, isPrimary: true }); // prepared diagnosis
    if (primaryDiagnosis) previousAndNewValues.push({ ...primaryDiagnosis, isPrimary: false }); // previous diagnosis

    saveChartData(
      {
        diagnosis: previousAndNewValues,
      },
      {
        onSuccess: (data) => {
          const updatedDiagnoses = data.chartData.diagnosis;
          setPartialChartData({
            diagnosis: getUpdatedDiagnoses(diagnoses, updatedDiagnoses),
          });
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while changing primary diagnosis. Please try again.', {
            variant: 'error',
          });
          setPartialChartData({
            diagnosis: oldDiagnoses,
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
        <AssessmentTitle>{css ? 'Dx' : 'Diagnoses'}</AssessmentTitle>
        {!isReadOnly && <DiagnosesField onChange={onAdd} disabled={isLoading} disableForPrimary={!primaryDiagnosis} />}
      </Box>

      {isReadOnly && diagnoses.length === 0 && <Typography color="secondary.light">Not provided</Typography>}

      {nlmApiKeyMissing && <CompleteConfiguration handleSetup={handleSetup} />}

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
