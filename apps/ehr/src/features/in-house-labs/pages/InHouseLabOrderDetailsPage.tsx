import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Button, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useApiClients } from '../../../hooks/useAppClients';
import { CollectSampleView } from '../components/details/CollectSampleView';
import { PerformTestView } from '../components/details/PerformTestView';
import { FinalResultView } from '../components/details/FinalResultView';
import { LabTest } from 'utils';

export const InHouseLabTestDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  // const { testId } = useParams<{ testId: string }>();
  const [loading, setLoading] = useState(true);
  const [testDetails, setTestDetails] = useState<LabTest | null>(null);
  const { oystehrZambda } = useApiClients();

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const testId: string = 'collect-sample';

  // Fetch the test details based on the current view/status
  useEffect(() => {
    const fetchTestDetails = async (): Promise<void> => {
      setLoading(true);

      try {
        // This would be an API call in a real implementation
        // For now, we'll create mock data based on the test ID

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        let testData: LabTest;

        // Determine which test data to show based on the test ID
        // In a real implementation, this would come from the API
        if (testId === 'collect-sample') {
          testData = {
            id: 'collect-sample',
            type: 'QUALITATIVE',
            name: 'Rapid Strep A',
            status: 'ORDERED',
            diagnosis: 'J02.0 Streptococcal pharyngitis',
            notes:
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          };
        } else if (testId === 'perform-test-pending') {
          testData = {
            id: 'perform-test-pending',
            type: 'QUALITATIVE',
            name: 'Rapid Strep A',
            status: 'COLLECTED',
            diagnosis: 'J02.0 Streptococcal pharyngitis',
            specimen: {
              source: 'Blood',
              collectedBy: 'Samanta Brooks',
              collectionDate: '2024-10-21',
              collectionTime: '9:20 AM',
            },
          };
        } else if (testId === 'perform-test-positive') {
          testData = {
            id: 'perform-test-positive',
            type: 'QUALITATIVE',
            name: 'Rapid Strep A',
            status: 'COLLECTED',
            diagnosis: 'J02.0 Streptococcal pharyngitis',
            specimen: {
              source: 'Blood',
              collectedBy: 'Samanta Brooks',
              collectionDate: '2024-10-21',
              collectionTime: '9:20 AM',
            },
          };
        } else if (testId === 'perform-test-negative') {
          testData = {
            id: 'perform-test-negative',
            type: 'QUALITATIVE',
            name: 'Rapid Strep A',
            status: 'COLLECTED',
            diagnosis: 'J02.0 Streptococcal pharyngitis',
            specimen: {
              source: 'Blood',
              collectedBy: 'Samanta Brooks',
              collectionDate: '2024-10-21',
              collectionTime: '9:20 AM',
            },
            notes:
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            orderDetails: {
              orderedBy: 'Larry Smith, MD',
              orderedDate: '2024-10-22T08:00:00',
              collectedBy: 'Samanta Brooks',
              collectedDate: '2024-10-22T08:00:00',
            },
          };
        } else if (testId === 'urinalysis-pending') {
          testData = {
            id: 'urinalysis-pending',
            type: 'MIXED',
            name: 'Urinalysis (UA)',
            status: 'COLLECTED',
            diagnosis: 'J02.0 Streptococcal pharyngitis',
            // parameters: [
            //   { name: 'Glucose', value: null, units: 'mg/dL', referenceRange: 'Not detected' },
            //   { name: 'Bilirubin', value: null, referenceRange: 'Not detected' },
            //   { name: 'Ketone', value: null, units: 'mg/dL', referenceRange: 'Not detected' },
            //   { name: 'Specific gravity', value: null, referenceRange: '1.005 - 1.030' },
            //   { name: 'Blood', value: null, referenceRange: 'Not detected' },
            //   { name: 'pH', value: null, referenceRange: '5.0 - 8.0' },
            //   { name: 'Proteine', value: null, units: 'mg/dL', referenceRange: 'Not detected' },
            //   { name: 'Urobilinogen', value: null, units: 'mg/dL', referenceRange: '0.2 - 1.0' },
            //   { name: 'Nitrite', value: null, referenceRange: 'Not detected' },
            //   { name: 'Leukocytes', value: null, units: 'mg/dL', referenceRange: 'Not detected' },
            // ],
          };
        } else if (testId === 'urinalysis-final') {
          testData = {
            id: 'urinalysis-final',
            type: 'MIXED',
            name: 'Urinalysis (UA)',
            status: 'FINAL',
            diagnosis: 'J02.0 Streptococcal pharyngitis',
            // parameters: [
            //   { name: 'Glucose', value: 'Not detected', units: 'mg/dL', referenceRange: 'Not detected' },
            //   { name: 'Bilirubin', value: '2+ (Moderate)', referenceRange: 'Not detected', isAbnormal: true },
            //   { name: 'Ketone', value: 'Small (15)', units: 'mg/dL', referenceRange: 'Not detected', isAbnormal: true },
            //   { name: 'Specific gravity', value: '1.010', referenceRange: '1.005 - 1.030' },
            //   { name: 'Blood', value: 'Not detected', referenceRange: 'Not detected' },
            //   { name: 'pH', value: '4.5', referenceRange: '5.0 - 8.0', isAbnormal: true },
            //   {
            //     name: 'Proteine',
            //     value: '4+ (≥2000)',
            //     units: 'mg/dL',
            //     referenceRange: 'Not detected',
            //     isAbnormal: true,
            //   },
            //   { name: 'Urobilinogen', value: '0.3', units: 'mg/dL', referenceRange: '0.2 - 1.0' },
            //   { name: 'Nitrite', value: 'Detected', referenceRange: 'Not detected', isAbnormal: true },
            //   { name: 'Leukocytes', value: 'Not detected', units: 'mg/dL', referenceRange: 'Not detected' },
            // ],
          };
        } else if (testId === 'final-result') {
          testData = {
            id: 'final-result',
            type: 'QUALITATIVE',
            name: 'Rapid Strep A',
            status: 'FINAL',
            diagnosis: 'J02.0 Streptococcal pharyngitis',
          };
        } else {
          // Default test data
          testData = {
            id: testId || 'unknown',
            type: 'QUALITATIVE',
            name: 'Rapid Strep A',
            status: 'ORDERED',
            diagnosis: 'J02.0 Streptococcal pharyngitis',
          };
        }

        setTestDetails(testData);
      } catch (error) {
        console.error('Error fetching test details:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchTestDetails();
  }, [testId, oystehrZambda]);

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleSubmit = async (updatedData: any): Promise<void> => {
    setLoading(true);

    try {
      // In a real implementation, this would call the API to update the test details
      console.log('Submitting test details:', {
        testId,
        ...updatedData,
      });

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Navigate back to the list view
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
      {testDetails.status === 'ORDERED' && (
        <CollectSampleView testDetails={testDetails} onBack={handleBack} onSubmit={handleSubmit} />
      )}
      {testDetails.status === 'COLLECTED' && <PerformTestView testDetails={testDetails} onBack={handleBack} />}
      {testDetails.status === 'FINAL' && (
        <FinalResultView testDetails={testDetails} onBack={handleBack} onSubmit={handleSubmit} />
      )}
    </>
  );

  // Default view (should not happen, but just in case)
  return (
    <Box>
      <Button variant="outlined" onClick={handleBack} sx={{ mb: 2, borderRadius: '50px', px: 4 }}>
        Back
      </Button>
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">Unknown test type or status</Typography>
      </Paper>
    </Box>
  );
};
