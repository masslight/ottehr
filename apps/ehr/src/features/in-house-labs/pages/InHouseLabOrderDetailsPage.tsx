import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Button, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useApiClients } from '../../../hooks/useAppClients';
import { CollectSampleView } from '../components/details/CollectSampleView';
import { PerformTestView } from '../components/details/PerformTestView';
import { FinalResultView } from '../components/details/FinalResultView';
import { getSelectors, MarkAsCollectedData, InHouseLabDTO } from 'utils';
import { useAppointmentStore } from 'src/telemed';
import { collectInHouseLabSpecimen, getInHouseLabOrderDetail } from 'src/api/api';

export const InHouseLabTestDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { serviceRequestID } = useParams<{ testId: string; serviceRequestID: string }>();
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);
  const [loading, setLoading] = useState(true);
  const [testDetails, setTestDetails] = useState<InHouseLabDTO | null>(null);
  const { oystehrZambda } = useApiClients();

  useEffect(() => {
    const fetchTestDetails = async (): Promise<void> => {
      if (!encounter.id || !serviceRequestID) {
        return;
      }

      setLoading(true);

      try {
        if (!oystehrZambda) {
          return;
        }

        const testData = await getInHouseLabOrderDetail(oystehrZambda, {
          serviceRequestId: serviceRequestID,
        });
        console.log('check data returned from getInHouseLabOrderDetail', testData);
        setTestDetails(testData);
      } catch (error) {
        console.error('Error fetching test details:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchTestDetails();
  }, [oystehrZambda, encounter.id, serviceRequestID]);

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleSubmit = async (updatedData: any): Promise<void> => {
    setLoading(true);

    try {
      // In a real implementation, this would call the API to update the test details
      console.log('Submitting test details:', {
        ...updatedData,
      });

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Navigate back to the list view
      // navigate(-1);
    } catch (error) {
      console.error('Error submitting test details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectSampleSubmit = async (updatedData: MarkAsCollectedData): Promise<void> => {
    setLoading(true);

    try {
      if (!oystehrZambda || !encounter.id || !serviceRequestID) {
        return;
      }

      await collectInHouseLabSpecimen(oystehrZambda, {
        encounterId: encounter.id,
        serviceRequestId: serviceRequestID,
        data: updatedData,
      });

      navigate(-1);
    } catch (error) {
      console.error('Error submitting test details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
            return <PerformTestView testDetails={testDetails} onBack={handleBack} />;
          case 'FINAL':
            return <FinalResultView testDetails={testDetails} onBack={handleBack} onSubmit={handleSubmit} />;
          default:
            // temp for debugging
            return <p>Status could not be parsed: {testDetails.status}</p>;
        }
      })()}
    </>
  );
};
