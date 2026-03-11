import { otherColors } from '@ehrTheme/colors';
import { WarningAmberOutlined } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Box, Divider, Paper, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { handleInHouseLabResults } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useApiClients } from 'src/hooks/useAppClients';
import { formatDateForLabs, InHouseOrderDetailPageItemDTO, LoadingState, PageName, ResultEntryInput } from 'utils';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { InHouseLabsDetailsCard } from './InHouseLabsDetailsCard';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ResultEntryTable } from './ResultsEntryTable';

interface InHouseLabResultCardProps {
  testDetails: InHouseOrderDetailPageItemDTO;
  setLoadingState: (loadingState: LoadingState) => void;
  entryMode: 'initial' | 'edit';
}

export const InHouseLabResultCard: React.FC<InHouseLabResultCardProps> = ({
  testDetails,
  setLoadingState,
  entryMode,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [submittingResults, setSubmittingResults] = useState<boolean>(false);
  const [error, setError] = useState<string[] | undefined>(undefined);

  const { oystehrZambda: oystehr } = useApiClients();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const defaultValues = useMemo(() => {
    const radioResultMap = testDetails.labDetails.components.radioComponents.reduce((acc: any, item) => {
      if (item.result?.entry) acc[item.observationDefinitionId] = item.result.entry;
      return acc;
    }, {});
    const tableResultMap = testDetails.labDetails.components.groupedComponents.reduce((acc: any, item) => {
      if (item.result?.entry) acc[item.observationDefinitionId] = item.result.entry;
      return acc;
    }, {});

    return { ...radioResultMap, ...tableResultMap };
  }, [testDetails]);

  const methods = useForm<ResultEntryInput>({
    mode: 'onChange',
    defaultValues,
  });

  const {
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleResultEntrySubmit: SubmitHandler<ResultEntryInput> = async (data): Promise<void> => {
    setSubmittingResults(true);

    if (!oystehr) {
      console.log('oystehr client is undefined :o');
      enqueueSnackbar('Error getting information needed to save, please try re-loading the page', { variant: 'error' });
      return;
    }

    try {
      await handleInHouseLabResults(oystehr, {
        serviceRequestId: testDetails.serviceRequestId,
        data: data,
      });
      // reset(data);
      setLoadingState(LoadingState.initial);
    } catch (e) {
      const sdkError = e as Oystehr.OystehrSdkError;
      console.log('error entering results', sdkError.code, sdkError.message);
      if (sdkError.code === 500) {
        setError(['Internal Service Error']);
      } else {
        setError([sdkError.message]);
      }
    }
    setSubmittingResults(false);
  };

  const shouldShowButton = entryMode === 'initial' || (entryMode === 'edit' && isDirty);

  const isButtonDisabled = !isValid || isReadOnly || (entryMode === 'edit' && !isDirty);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleResultEntrySubmit)}>
        <Paper sx={{ mb: 2 }}>
          <Box sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" color="primary.dark" fontWeight="bold">
                {testDetails.testItemName}
              </Typography>
              <Box data-testid={dataTestIds.finalResultPage.dateAndStatus} display="flex" alignItems="center" gap="8px">
                <Typography variant="body2">
                  {formatDateForLabs(testDetails.orderAddedDate, testDetails.timezone)}
                </Typography>
                <InHouseLabsStatusChip
                  testId={dataTestIds.performTestPage.status}
                  status={testDetails.status}
                  additionalStyling={{ height: '24px' }}
                />
              </Box>
            </Box>

            {testDetails.labDetails.components.radioComponents.map((component, idx) => {
              return (
                <ResultEntryRadioButton
                  key={`radio-btn-${idx}-${component.componentName}`}
                  testItemComponent={component}
                />
              );
            })}

            {testDetails.labDetails.components.groupedComponents.length > 0 && (
              <ResultEntryTable testItemComponents={testDetails.labDetails.components.groupedComponents} />
            )}

            {testDetails.labDetails.reflexAlert && (
              <Box
                key={`reflex-alert`}
                sx={{
                  p: '6px 16px',
                  borderRadius: '4px',
                  display: 'flex',
                  background: otherColors.warningBackground,
                  mt: '16px',
                  alignItems: 'center',
                }}
                gap={'4px'}
              >
                <WarningAmberOutlined sx={{ height: '22px', width: '22px', my: '7px', mr: '12px' }} color="warning" />
                <Typography variant="h6" color={otherColors.warningText}>
                  {testDetails.labDetails.reflexAlert.alert}
                </Typography>
              </Box>
            )}

            <InHouseLabsDetailsCard
              testDetails={testDetails}
              page={PageName.performEnterResults}
              showDetails={showDetails}
              setShowDetails={setShowDetails}
            />
          </Box>
          <Divider />
          {shouldShowButton && (
            <Box display="flex" justifyContent="flex-end" sx={{ p: '16px 24px' }}>
              <Box textAlign="end">
                <LoadingButton
                  data-testid={dataTestIds.performTestPage.submitButton}
                  variant="contained"
                  color="primary"
                  loading={submittingResults}
                  disabled={isButtonDisabled}
                  type="submit"
                  sx={{ borderRadius: '50px', px: 4, textTransform: 'none' }}
                >
                  {entryMode === 'initial' ? 'Submit' : 'Save changes'}
                </LoadingButton>
                {error &&
                  error.length > 0 &&
                  error.map((msg, idx) => (
                    <Box sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                      <Typography sx={{ color: 'error.dark' }}>
                        {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </Box>
          )}
        </Paper>
      </form>
    </FormProvider>
  );
};
