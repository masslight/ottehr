import { Typography, Stack, CircularProgress } from '@mui/material';
import React, { useState, useEffect } from 'react';

import { StatusChip } from '../components/StatusChip';
import { DateTime } from 'luxon';
import { SampleCollection } from '../components/SampleCollection';
import { OrderHistoryCard } from '../components/OrderHistoryCard';
import { StatusString } from '../components/StatusChip';
<<<<<<< Updated upstream
import { TaskBanner } from '../components/TaskBanner';
import { CSSPageTitle } from '../../../telemed/components/PageTitle';
// import { useAppointmentStore } from '../../../telemed';
// import { getSelectors } from '../../../shared/store/getSelectors';
// import { DiagnosisDTO } from 'utils';
// import { useApiClients } from '../../../hooks/useAppClients';
// import { FhirClient } from '@zapehr/sdk';
=======
import { useParams } from 'react-router-dom';
import { CSSPageTitle } from '../../../telemed/components/PageTitle';
import { useApiClients } from '../../../hooks/useAppClients';
import { OrderDetails } from 'utils';
import { getLabOrderDetails } from '../../../api/api';
import { QuestionnaireItem } from 'fhir/r4b';
>>>>>>> Stashed changes

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

<<<<<<< Updated upstream
export interface MockServiceRequest {
  diagnosis: string;
  patientName: string;
  orderName: string;
  orderingPhysician: string;
  orderDateTime: DateTime;
  labName: string;
}

export const OrderDetails: React.FC = () => {
  // const { fhirClient } = useApiClients();

  // ATHENA TODO: unclear how the service request will be passed here, and whether or not
  // the orderable item info will be included on it or if it will need to be queried via oystehr api based on a lab + code.
  const [serviceRequest, setServiceRequest] = useState({} as MockServiceRequest);
  // this will be the specimen we write out to
  const [specimen, setSpecimen] = useState({});
  const [collectionInstructions, setCollectionInstructions] = useState({} as CollectionInstructions);
  const initialAoe: any[] = [];
=======
type JsonPrimitive = boolean | number | string | null;
type JsonArray = JsonValue[];
type JsonObject = {
  [x: string]: JsonValue | undefined;
};
type JsonValue = JsonArray | JsonObject | JsonPrimitive;


export const OrderDetailsPage: React.FC = () => {
  const { orderId } = useParams();
  const { oystehrZambda } = useApiClients();

  if (!orderId) {
    throw new Error('orderId is undefined');
  }
  // TODO: The ServiceRequest and other necessary resources will have been made on Create Order. Just need to grab those
  const [serviceRequest, setServiceRequest] = useState({} as OrderDetails);

  // Note: specimens are no longer MVP, and also we'll be getting specimens from Create Order
  const [specimen, setSpecimen] = useState({});
  const [collectionInstructions, setCollectionInstructions] = useState({} as CollectionInstructions);
  const initialAoe: QuestionnaireItem[] = [];
>>>>>>> Stashed changes
  const [aoe, setAoe] = useState(initialAoe);
  const [isLoading, setIsLoading] = useState(true);
  const [taskStatus, setTaskStatus] = useState('pending' as StatusString);

  const diagnosis = 'AB12 - Diagnosis';
  // const taskId = 'abcd12345';

  const handleSampleCollectionTaskChange = React.useCallback(() => setTaskStatus('collected'), [setTaskStatus]);

  useEffect(() => {
<<<<<<< Updated upstream
    setServiceRequest({
      diagnosis: diagnosis,
      patientName: 'Patient Name',
      orderName: 'Throat Culture',
      orderingPhysician: 'Dr. Good Dr',
      orderDateTime: DateTime.now(),
      labName: 'Quest',
    });
=======
    console.log(10);
    async function getServiceRequestTemp(): Promise<void> {
      if (!orderId) {
        throw new Error('orderId is undefined');
      }
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      const orderDetails = await getLabOrderDetails(oystehrZambda, { serviceRequestID: orderId });

      setServiceRequest(orderDetails);
      if (orderDetails.labQuestions.item) {
        setAoe(orderDetails.labQuestions.item);
      }
    }
    getServiceRequestTemp().catch((error) => console.log(error));

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    setAoe([
      {
        questionCode: 'fsmr6TlrOyzeiT8nDITdWw',
        originalQuestionCode: 'FSTING',
        question: 'FASTING',
        answers: ['Y', 'N'],
        verboseAnswers: ['Yes', 'No'],
        questionType: 'List',
        answerRequired: false,
      },
      {
        questionCode: '2eGvXUd0Y0eau69fOkRbOg',
        originalQuestionCode: 'COLVOL',
        question: 'URINE VOLUME (MILLILITERS)',
        questionType: 'Free Text',
        answerRequired: false,
      },
      {
        questionCode: 'X6Lyv33OWonjBAQEnggqFA',
        originalQuestionCode: 'CYTOPI',
        question: 'OTHER PATIENT INFORMATION',
        answers: [
          'PREGNANT',
          'POST-PART',
          'LACTATING',
          'MENOPAUSAL',
          'OC',
          'ESTRO-RX',
          'PMP-BLEEDING',
          'IUD',
          'ALL-OTHER-PAT',
        ],
        verboseAnswers: [
          'PREGNANT',
          'POST-PART',
          'LACTATING',
          'MENOPAUSAL',
          'ORAL CONTRACEPTIVES',
          'ESTRO-RX',
          'PMP-BLEEDING',
          'IUD',
          'ALL-OTHER-PAT',
        ],
        questionType: 'Multi-Select List',
        answerRequired: false,
      },
      {
        questionCode: 'iLS4T4HJXIlvECCvX-R8Tw',
        originalQuestionCode: 'GESADT',
        question: 'GESTATIONAL AGE DATE OF CALCULATION',
        answers: ['YYYYMMDD'],
        questionType: 'Formatted Input',
        answerRequired: false,
      },
    ]);
=======
>>>>>>> Stashed changes

    setIsLoading(false);
    // setTaskStatus('collected');
  }, []);

  // useEffect(() => {
  //   async function getLocationsResults(fhirClient: FhirClient): Promise<void> {
  //     if (!fhirClient) {
  //       return;
  //     }

  //     setLoading(true);

  //     try {
  //       let locationsResults = await fhirClient.searchResources<Location>({
  //         resourceType: 'Location',
  //         searchParams: [{ name: '_count', value: '1000' }],
  //       });
  //       locationsResults = locationsResults.filter((loc) => !isLocationVirtual(loc));
  //       setLocations(locationsResults);
  //     } catch (e) {
  //       console.error('error loading locations', e);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }

  //   if (fhirClient && locations.length === 0) {
  //     void getLocationsResults(fhirClient);
  //   }
  // }, [fhirClient, loading, locations.length]);

  return (
    <>
      <Stack spacing={2} sx={{ p: 3 }}>
        <CSSPageTitle>{`Send Out Labs: ${serviceRequest.orderName}`}</CSSPageTitle>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="body1">{diagnosis}</Typography>
          <StatusChip status={taskStatus} />
        </Stack>
        {taskStatus === 'pending' && (
          <TaskBanner
            orderName={serviceRequest?.orderName || ''}
            orderingPhysician={serviceRequest?.orderingPhysician || ''}
            orderedOnDate={DateTime.now()}
            labName={serviceRequest?.labName || ''}
            taskStatus={taskStatus}
          />
        )}
        {isLoading ? (
          <CircularProgress />
        ) : (
          taskStatus === 'pending' && (
            <SampleCollection
              aoe={aoe}
              collectionInstructions={collectionInstructions}
              specimen={specimen}
              serviceRequest={serviceRequest}
              onCollectionSubmit={handleSampleCollectionTaskChange}
            />
          )
        )}

        {taskStatus !== 'pending' && <OrderHistoryCard />}
      </Stack>
    </>
  );
};
