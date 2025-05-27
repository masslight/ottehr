import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Button, CircularProgress, Collapse, IconButton, Divider } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { useApiClients } from '../../../hooks/useAppClients';
import { OrderDetails } from '../components/details/OrderDetails';
import { NursingOrder, NursingOrdersStatus } from '../nursingOrderTypes';
import { History } from '../components/details/History';
import { BreadCrumbs } from '../components/BreadCrumbs';

export const NursingOrderDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { serviceRequestID } = useParams<{ serviceRequestID: string }>();
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [nursingOrderDetails, setNursingOrderDetails] = useState<NursingOrder | null>(null);
  const { oystehrZambda } = useApiClients();

  // Fetch the test details based on the current view/status
  useEffect(() => {
    const fetchNursingOrderDetails = async (): Promise<void> => {
      setLoading(true);

      try {
        // This would be an API call in a real implementation
        // For now, we'll create mock data based on the test ID

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        let testData: NursingOrder;

        // Determine which test data to show based on the test ID
        // In a real implementation, this would come from the API
        if (serviceRequestID === '123') {
          testData = {
            id: '123',
            note: 'Offer ice pop for comfort and hydration. Indicated for sore throat and/or post-febrile care. Monitor tolerance and document intake.',
            status: NursingOrdersStatus.pending,
            orderDetails: {
              orderedBy: 'Dr. Smith, MD,',
              orderedDate: '2025-05-27T10:17:00.000Z',
            },
          };
        } else if (serviceRequestID === '456') {
          testData = {
            id: '456',
            note: 'Offer ice pop for comfort and hydration. Indicated for sore throat and/or post-febrile care. Monitor tolerance and document intake.',
            status: NursingOrdersStatus.completed,
            orderDetails: {
              orderedBy: 'Dr. Smith, MD,',
              orderedDate: '2025-05-27T10:17:00.000Z',
            },
          };
        } else if (serviceRequestID === '789') {
          testData = {
            id: '789',
            note: 'Offer ice pop for comfort and hydration. Indicated for sore throat and/or post-febrile care. Monitor tolerance and document intake.',
            status: NursingOrdersStatus.cancelled,
            orderDetails: {
              orderedBy: 'Dr. Smith, MD,',
              orderedDate: '2025-05-27T10:17:00.000Z',
            },
          };
        } else {
          // Default test data
          testData = {
            id: serviceRequestID || 'unknown',
            note: 'Offer ice pop for comfort and hydration. Indicated for sore throat and/or post-febrile care. Monitor tolerance and document intake.',
            status: NursingOrdersStatus.pending,
          };
        }

        setNursingOrderDetails(testData);
      } catch (error) {
        console.error('Error fetching test details:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchNursingOrderDetails();
  }, [serviceRequestID, oystehrZambda]);

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleToggleDetails = (): void => {
    setShowHistory(!showHistory);
  };

  const handleSubmit = async (updatedData: any): Promise<void> => {
    setLoading(true);

    try {
      // In a real implementation, this would call the API to update the test details
      console.log('Submitting test details:', {
        testId: serviceRequestID,
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

  if (!nursingOrderDetails) {
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
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '680px' }}>
        <BreadCrumbs />

        <OrderDetails orderDetails={nursingOrderDetails} onSubmit={handleSubmit} />

        <Paper>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, backgroundColor: '#F4F6F8' }}>
            <IconButton onClick={handleToggleDetails} sx={{ mr: 0.75, p: 0 }}>
              <ArrowDropDownCircleOutlinedIcon
                color="primary"
                sx={{
                  rotate: showHistory ? '' : '180deg',
                }}
              ></ArrowDropDownCircleOutlinedIcon>
            </IconButton>
            <Typography variant="subtitle2" color="primary.dark" sx={{ fontSize: '14px' }}>
              Order History
            </Typography>
          </Box>
          <Divider />
          <Collapse in={showHistory}>
            <History orderDetails={nursingOrderDetails} />
          </Collapse>
        </Paper>

        <ButtonRounded
          variant="outlined"
          onClick={handleBack}
          sx={{ borderRadius: '50px', px: 4, alignSelf: 'flex-start' }}
        >
          Back
        </ButtonRounded>
      </Box>
    </Box>
  );
};
