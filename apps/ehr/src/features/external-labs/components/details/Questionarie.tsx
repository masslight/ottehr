import { QuestionnaireItem } from 'fhir/r4b';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { LabOrderDetailedPageDTO, OrderDetails } from 'utils';
import { getLabOrderDetails } from '../../../../api/api';
import { useApiClients } from '../../../../hooks/useAppClients';
import { OrderCollection } from '../OrderCollection';
import { StatusString } from '../StatusChip';
import { CircularProgress } from '@mui/material';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

// todo fix typo in name
export const Questionarie: React.FC<{
  labOrder: LabOrderDetailedPageDTO;
  showActionButtons?: boolean;
  showOrderInfo?: boolean;
  isAOECollapsed?: boolean;
  accountNumber: string;
}> = ({ showActionButtons = true, showOrderInfo = true, isAOECollapsed = false, accountNumber, labOrder }) => {
  const { serviceRequestID } = useParams();
  const { oystehrZambda } = useApiClients();
  const [serviceRequest, setServiceRequest] = useState<OrderDetails | undefined>(undefined);
  const [specimen, setSpecimen] = useState({});
  const [collectionInstructions, setCollectionInstructions] = useState({} as CollectionInstructions);
  const initialAoe: QuestionnaireItem[] = [];
  const [aoe, setAoe] = useState(initialAoe);
  const [isLoading, setIsLoading] = useState(true);
  const [_taskStatus, setTaskStatus] = useState('pending' as StatusString);

  const handleSampleCollectionTaskChange = useCallback(() => setTaskStatus('collected'), [setTaskStatus]);

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
  }, [oystehrZambda, serviceRequestID]);

  if (isLoading) {
    return <CircularProgress />;
  }

  if (!serviceRequestID || !serviceRequest) {
    return null;
  }

  return (
    <OrderCollection
      aoe={aoe}
      status={_taskStatus}
      collectionInstructions={collectionInstructions}
      specimen={specimen}
      serviceRequestID={serviceRequestID}
      serviceRequest={serviceRequest}
      accountNumber={accountNumber}
      _onCollectionSubmit={handleSampleCollectionTaskChange}
      oystehr={oystehrZambda}
      showActionButtons={showActionButtons}
      showOrderInfo={showOrderInfo}
      isAOECollapsed={isAOECollapsed}
      labOrder={labOrder}
    />
  );
};
