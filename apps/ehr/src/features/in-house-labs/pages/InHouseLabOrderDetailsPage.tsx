import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collectInHouseLabSpecimen, getInHouseOrders } from 'src/api/api';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { dataTestIds } from 'src/constants/data-test-ids';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { LoadingState } from 'utils/lib/types/data/in-house/in-house.constants';
import {
  EntryMode,
  InHouseOrderDetailPageItemDTO,
  MarkAsCollectedData,
} from 'utils/lib/types/data/in-house/in-house.types';
import { useApiClients } from '../../../hooks/useAppClients';
import { CollectSampleView } from '../components/details/CollectSampleView';
import { InHouseLabResults } from '../components/details/InHouseLabResults';
import { InHouseLabsBreadcrumbs } from '../components/InHouseLabsBreadcrumbs';
import { InHouseLabOrderPrefill } from './InHouseLabOrderCreatePage';

interface InHouseLabTestDetailsPageProps {
  serviceRequestId?: string;
  onBack?: () => void;
  // the repeat/reflex buttons open the create view with prefill data instead of navigating
  onOrderTest?: (prefill: InHouseLabOrderPrefill) => void;
}

export const InHouseLabTestDetailsPage: React.FC<InHouseLabTestDetailsPageProps> = ({
  serviceRequestId: serviceRequestIdProp,
  onBack,
  onOrderTest,
}) => {
  const navigate = useNavigate();
  const isInlineFlow = useIsInlineFlow();
  const urlParams = useParams<{ testId: string; serviceRequestID: string }>();
  const serviceRequestID = serviceRequestIdProp ?? urlParams.serviceRequestID;
  const { encounter } = useAppointmentData();
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

  const handleBack = onBack ?? ((): void => navigate(-1));

  const handleCollectSampleSubmit = async (updatedData: MarkAsCollectedData): Promise<void> => {
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
      throw error;
    }
  };

  if (loadingState === LoadingState.loading) {
    return (
      <Box
        data-testid={dataTestIds.orderInHouseLabPage.loading}
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="300px"
      >
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

  const apartOfRepeatTestSet = (() => {
    return allTestDetails && allTestDetails.some((detail) => detail.labDetails.orderMode === 'repeat');
  })();

  const pageName = `${testDetails.testItemName}${apartOfRepeatTestSet ? ' + Repeat' : ''}`;

  const content = (
    <>
      {(() => {
        switch (testDetails.status) {
          case 'ORDERED':
            return (
              <CollectSampleView
                testDetails={testDetails}
                onBack={handleBack}
                onSubmit={handleCollectSampleSubmit}
                setLoadingState={setLoadingState}
              />
            );
          case 'COLLECTED':
            return (
              <InHouseLabResults
                testDetails={[testDetails]}
                onBack={handleBack}
                setLoadingState={setLoadingState}
                entryMode={EntryMode.Initial}
                onOrderTest={onOrderTest}
              />
            );
          case 'FINAL':
            return (
              <InHouseLabResults
                testDetails={allTestDetails}
                onBack={handleBack}
                setLoadingState={setLoadingState}
                entryMode={EntryMode.Edit}
                onOrderTest={onOrderTest}
              />
            );
          default:
            // temp for debugging
            return <p>Status could not be parsed: {testDetails.status}</p>;
        }
      })()}
    </>
  );

  if (isInlineFlow) return content;

  return (
    <DetailPageContainer>
      <InHouseLabsBreadcrumbs pageName={pageName}>{content}</InHouseLabsBreadcrumbs>
    </DetailPageContainer>
  );
};
