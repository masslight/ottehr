import React, { FC } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { AssessmentTitle } from './AssessmentTitle';
import { DiagnosesField } from './DiagnosesField';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useDeleteChartData, useSaveChartData } from '../../../../state';
import { ActionsList, DeleteIconButton } from '../../../../components';
import { IcdSearchResponse } from 'ehr-utils';

export const DiagnosesContainer: FC = () => {
  const { chartData, setPartialChartData, isReadOnly } = getSelectors(useAppointmentStore, [
    'chartData',
    'setPartialChartData',
    'isReadOnly',
  ]);
  const { mutate: saveChartData, isLoading: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isLoading: isDeleteLoading } = useDeleteChartData();

  const isLoading = isSaveLoading || isDeleteLoading;

  const diagnoses = chartData?.diagnosis || [];
  const primaryDiagnosis = diagnoses.find((item) => item.isPrimary);
  const otherDiagnoses = diagnoses.filter((item) => !item.isPrimary);

  const onAdd = (value: IcdSearchResponse['codes'][number]): void => {
    const preparedValue = { ...value, isPrimary: !primaryDiagnosis };

    saveChartData(
      {
        diagnosis: [preparedValue],
      },
      {
        onSuccess: (data) => {
          const diagnosis = (data.diagnosis || [])[0];
          if (diagnosis) {
            setPartialChartData({
              diagnosis: [...diagnoses, diagnosis],
            });
          }
        },
      },
    );
    setPartialChartData({ diagnosis: [...diagnoses, preparedValue] });
  };

  const onDelete = (resourceId: string): void => {
    let localDiagnoses = diagnoses;
    const preparedValue = localDiagnoses.find((item) => item.resourceId === resourceId)!;

    deleteChartData({
      diagnosis: [preparedValue],
    });
    localDiagnoses = localDiagnoses.filter((item) => item.resourceId !== resourceId);

    if (preparedValue.isPrimary && otherDiagnoses.length > 0) {
      const firstAppropriateDiagnosis = otherDiagnoses.find((diagnosis) => !diagnosis.code.startsWith('W'));

      if (firstAppropriateDiagnosis) {
        const otherDiagnosis = { ...firstAppropriateDiagnosis, isPrimary: true };

        saveChartData({
          diagnosis: [otherDiagnosis],
        });

        localDiagnoses = localDiagnoses.map((item) =>
          item.resourceId === otherDiagnosis.resourceId ? otherDiagnosis : item,
        );
      }
    }
    setPartialChartData({ diagnosis: localDiagnoses });
  };

  const onMakePrimary = (resourceId: string): void => {
    const value = diagnoses.find((item) => item.resourceId === resourceId)!;
    const preparedValue = { ...value, isPrimary: true };
    const previousPrimary = { ...primaryDiagnosis!, isPrimary: false };

    saveChartData({
      diagnosis: [preparedValue, previousPrimary],
    });

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
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <AssessmentTitle>Diagnoses</AssessmentTitle>
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
