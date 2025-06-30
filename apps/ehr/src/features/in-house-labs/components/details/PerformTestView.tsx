import { LoadingButton } from '@mui/lab';
import { Box, Button, Paper, Typography } from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import React, { useState } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { handleInHouseLabResults } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { getFormattedDiagnoses, InHouseOrderDetailPageItemDTO, LoadingState, PageName, ResultEntryInput } from 'utils';
import { InHouseLabsDetailsCard } from './InHouseLabsDetailsCard';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ResultEntryTable } from './ResultsEntryTable';

interface PerformTestViewProps {
  testDetails: InHouseOrderDetailPageItemDTO;
  setLoadingState: (loadingState: LoadingState) => void;
  onBack: () => void;
}

export const PerformTestView: React.FC<PerformTestViewProps> = ({ testDetails, setLoadingState, onBack }) => {
  const methods = useForm<ResultEntryInput>({ mode: 'onChange' });
  const { serviceRequestID } = useParams<{ testId: string; serviceRequestID: string }>();
  const {
    handleSubmit,
    formState: { isValid },
  } = methods;
  const { oystehrZambda: oystehr } = useApiClients();

  const [showDetails, setShowDetails] = useState(false);
  // const [notes, setNotes] = useState(testDetails.notes || '');
  const [submittingResults, setSubmittingResults] = useState<boolean>(false);
  const [error, setError] = useState<string[] | undefined>(undefined);

  const handleResultEntrySubmit: SubmitHandler<ResultEntryInput> = async (data): Promise<void> => {
    setSubmittingResults(true);
    if (!oystehr) {
      console.log('no oystehr client! :o'); // todo add error handling
      return;
    }
    if (!serviceRequestID) return; // todo better error handling
    console.log('data being submitted', data);
    try {
      await handleInHouseLabResults(oystehr, {
        serviceRequestId: serviceRequestID,
        data: data,
      });
      setLoadingState(LoadingState.initial);
    } catch (e) {
      const oyError = e as OystehrSdkError;
      console.log('error entering results', oyError.code, oyError.message);
      const errorMessage = [oyError.message];
      setError(errorMessage);
    }
    setSubmittingResults(false);
  };

  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {getFormattedDiagnoses(testDetails.diagnosesDTO)}
      </Typography>

      <Typography variant="h4" color="primary.dark" sx={{ mb: 3, fontWeight: 'bold' }}>
        Perform Test & Enter Results
      </Typography>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleResultEntrySubmit)}>
          <Paper sx={{ mb: 2 }}>
            <Box sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" color="primary.dark" fontWeight="bold">
                  {testDetails.testItemName}
                </Typography>
                <Box
                  sx={{
                    bgcolor: '#E8DEFF',
                    color: '#5E35B1',
                    fontWeight: 'bold',
                    px: 2,
                    py: 0.5,
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                  }}
                >
                  {testDetails.status}
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
              <InHouseLabsDetailsCard
                testDetails={testDetails}
                page={PageName.performEnterResults}
                showDetails={showDetails}
                setShowDetails={setShowDetails}
              />
            </Box>
          </Paper>
          <Box display="flex" justifyContent="space-between">
            <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
              Back
            </Button>

            <LoadingButton
              variant="contained"
              color="primary"
              loading={submittingResults}
              disabled={!isValid}
              type="submit"
              sx={{ borderRadius: '50px', px: 4 }}
            >
              Submit
            </LoadingButton>
          </Box>
          {error &&
            error.length > 0 &&
            error.map((msg, idx) => (
              <Box sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                <Typography sx={{ color: 'error.dark' }}>
                  {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                </Typography>
              </Box>
            ))}
        </form>
      </FormProvider>
    </Box>
  );
};
