import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Button, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useApiClients } from '../../../hooks/useAppClients';
import { CollectSampleView } from '../components/details/CollectSampleView';
import { PerformTestView } from '../components/details/PerformTestView';
import { FinalResultView } from '../components/details/FinalResultView';
import { getSelectors, MarkAsCollectedData, LoadingState, InHouseOrderDetailPageItemDTO } from 'utils';
import { useAppointmentStore } from 'src/telemed';
import { collectInHouseLabSpecimen, getInHouseOrders } from 'src/api/api';

export const InHouseLabTestDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { serviceRequestID } = useParams<{ testId: string; serviceRequestID: string }>();
  const { encounter } = getSelectors(useAppointmentStore, ['encounter', 'appointment']);
  const [loadingState, setLoadingState] = useState(LoadingState.initial);
  const [testDetails, setTestDetails] = useState<InHouseOrderDetailPageItemDTO | null>(null);
  const [allTestDetails, setAllTestDetails] = useState<InHouseOrderDetailPageItemDTO[] | undefined>(undefined);
  const { oystehrZambda } = useApiClients();

  useEffect(() => {
    const fetchTestDetails = async (): Promise<void> => {
      if (!encounter.id || !serviceRequestID) {
        return;
      }

      setLoadingState(LoadingState.loading);

      try {
        if (!oystehrZambda) {
          return;
        }
        const testData = await getInHouseOrders(oystehrZambda, {
          searchBy: { field: 'serviceRequestId', value: serviceRequestID },
        });
        setAllTestDetails(testData);
        const specificTestDetail = testData.find((data) => data.serviceRequestId === serviceRequestID) || null;
        setTestDetails(specificTestDetail);
      } catch (error) {
        // todo better error handling
        console.error('Error fetching test details:', error);
      } finally {
        setLoadingState(LoadingState.loaded);
      }
    };

    if (loadingState === LoadingState.initial) {
      void fetchTestDetails();
    }
  }, [oystehrZambda, encounter.id, serviceRequestID, loadingState]);

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleCollectSampleSubmit = async (updatedData: MarkAsCollectedData): Promise<void> => {
    setLoadingState(LoadingState.loading);
    let loadingError = false;
    try {
      if (!oystehrZambda || !encounter.id || !serviceRequestID) {
        return;
      }
      await collectInHouseLabSpecimen(oystehrZambda, {
        encounterId: encounter.id,
        serviceRequestId: serviceRequestID,
        data: updatedData,
      });
    } catch (error) {
      console.error('Error submitting test details:', error);
      loadingError = true;
    } finally {
      if (loadingError) {
        setLoadingState(LoadingState.loadedWithError);
      } else {
        setLoadingState(LoadingState.initial);
      }
    }
  };

  if (loadingState === LoadingState.loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (!testDetails) {
    return (
      <Box>
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2, borderRadius: '50px', px: 4 }}>
          Back
        </Button>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Test details not found
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <>
      {(() => {
        switch (testDetails.status) {
          case 'ORDERED':
            return (
              <CollectSampleView testDetails={testDetails} onBack={handleBack} onSubmit={handleCollectSampleSubmit} />
            );
          case 'COLLECTED':
            return <PerformTestView testDetails={testDetails} onBack={handleBack} setLoadingState={setLoadingState} />;
          case 'FINAL':
            return <FinalResultView testDetails={allTestDetails} onBack={handleBack} />;
          default:
            // temp for debugging
            return <p>Status could not be parsed: {testDetails.status}</p>;
        }
      })()}
    </>
  );
};
