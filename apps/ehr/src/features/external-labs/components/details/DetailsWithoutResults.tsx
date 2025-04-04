import { Typography, Stack, CircularProgress, Grid } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { StatusChip } from '../StatusChip';
import { OrderCollection } from '../OrderCollection';
import { OrderHistoryCard } from '../OrderHistoryCard';
import { StatusString } from '../StatusChip';
import { useParams } from 'react-router-dom';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { useApiClients } from '../../../../hooks/useAppClients';
import { LabOrderDTO, OrderDetails } from 'utils';
import { getLabOrderDetails } from '../../../../api/api';
import { QuestionnaireItem } from 'fhir/r4b';
import { LabOrderLoading } from '../labs-orders/LabOrderLoading';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

export const DetailsWithoutResults: React.FC<{ labOrder?: LabOrderDTO }> = ({ labOrder }) => {
  const { serviceRequestID } = useParams();
  const { oystehrZambda } = useApiClients();

  if (!serviceRequestID) {
    throw new Error('serviceRequestID is undefined');
  }
  // TODO: The ServiceRequest and other necessary resources will have been made on Create Order. Just need to grab those
  const [serviceRequest, setServiceRequest] = useState<OrderDetails | undefined>(undefined);

  // Note: specimens are no longer MVP, and also we'll be getting specimens from Create Order
  const [specimen, setSpecimen] = useState({});
  const [collectionInstructions, setCollectionInstructions] = useState({} as CollectionInstructions);
  const initialAoe: QuestionnaireItem[] = [];
  const [aoe, setAoe] = useState(initialAoe);
  const [isLoading, setIsLoading] = useState(true);
  const [taskStatus, setTaskStatus] = useState('pending' as StatusString);

  const handleSampleCollectionTaskChange = React.useCallback(() => setTaskStatus('collected'), [setTaskStatus]);

  useEffect(() => {
    console.log(10);
    async function getServiceRequestTemp(): Promise<void> {
      if (!serviceRequestID) {
        throw new Error('serviceRequestID is undefined');
      }
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      const orderDetails = await getLabOrderDetails(oystehrZambda, { serviceRequestID });

      setServiceRequest(orderDetails);
      if (orderDetails.labQuestions.item) {
        setAoe(orderDetails.labQuestions.item);
      }
    }
    getServiceRequestTemp().catch((error) => console.log(error));

    setSpecimen({});
    // will probably be querying oystehr to get information about the OI (Assuming the link to the OI is a code on the SR)
    // specifically will need the AOE, collection instructions from the orderable item
    setCollectionInstructions({
      container:
        'Red-top tube, gel-barrier tube, OR green-top (lithium heparin) tube. Do NOT use oxalate, EDTA, or citrate plasma.',
      volume: '1 mL',
      minimumVolume: '0.7 mL (NOT: This volume does NOT allow for repeat testing.)',
      storageRequirements: 'Room temperature',
      collectionInstructions:
        'If a red-top tube or plasma tube is used, transfer separated serum or plasma to a plastic transport tube.',
    });

    setIsLoading(false);
    // setTaskStatus('collected');
  }, [oystehrZambda, serviceRequestID]);

  if (!serviceRequest) {
    return <LabOrderLoading />;
  }

  return (
    <>
      <Stack spacing={2} sx={{ p: 3 }}>
        <CSSPageTitle>{serviceRequest.orderName}</CSSPageTitle>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="body1">{serviceRequest.diagnosis}</Typography>
          <Grid container justifyContent="end" spacing={2}>
            <Grid item>
              <StatusChip status={taskStatus} />
            </Grid>
            <Grid item>
              <Typography variant="body1">{serviceRequest.orderTypeDetail}</Typography>
            </Grid>
          </Grid>
        </Stack>
        {/* {taskStatus === 'pending' && (
          <TaskBanner
            orderName={serviceRequest?.orderName || ''}
            orderingPhysician={serviceRequest?.orderingPhysician || ''}
            orderedOnDate={serviceRequest.orderDateTime}
            labName={serviceRequest?.labName || ''}
            taskStatus={taskStatus}
          />
        )} */}
        {isLoading ? (
          <CircularProgress />
        ) : (
          taskStatus === 'pending' && (
            <OrderCollection
              aoe={aoe}
              collectionInstructions={collectionInstructions}
              specimen={specimen}
              serviceRequestID={serviceRequestID}
              serviceRequest={serviceRequest}
              _onCollectionSubmit={handleSampleCollectionTaskChange}
              oystehr={oystehrZambda}
            />
          )
        )}

        {taskStatus !== 'pending' && <OrderHistoryCard orderHistory={labOrder?.history} />}
      </Stack>
    </>
  );
};
