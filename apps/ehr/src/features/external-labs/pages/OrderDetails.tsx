import { Typography, Stack, CircularProgress } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { StatusChip } from '../components/StatusChip';
import { DateTime } from 'luxon';
import { OrderCollection } from '../components/OrderCollection';
import { OrderHistoryCard } from '../components/OrderHistoryCard';
import { StatusString } from '../components/StatusChip';
import mockAOEData from '../mock-data/mock_aoe_questionnaire.json';
import { useParams } from 'react-router-dom';
import { CSSPageTitle } from '../../../telemed/components/PageTitle';
import { TaskBanner } from '../components/TaskBanner';
import { useApiClients } from '../../../hooks/useAppClients';
import { ActivityDefinition, Practitioner, ServiceRequest, Task } from 'fhir/r4b';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

type JsonPrimitive = boolean | number | string | null;
type JsonArray = JsonValue[];
type JsonObject = {
  [x: string]: JsonValue | undefined;
};
type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export interface AoeQuestionnaireConfig extends JsonObject {
  resourceType: string;
  status: string;
  url: string;
  item: AoeQuestionnaireItemConfig[];
}
export interface AoeAnswerOption extends JsonObject {
  id: string;
  valueString: string;
}

export interface AoeExtension extends JsonObject {
  url: string;
  valueString: string;
}

export interface AoeQuestionnaireItemConfig extends JsonObject {
  linkId: string;
  text: string;
  type: string;
  required: boolean;
  code?: { system: string; code: string }[];
  answerOption?: AoeAnswerOption[];
  extension?: AoeExtension[];
}
export interface MockServiceRequest {
  diagnosis: string;
  patientName: string;
  orderName: string;
  orderingPhysician: string;
  orderDateTime: DateTime | undefined;
  labName: string;
  sampleCollectionDateTime: DateTime;
}

export const OrderDetails: React.FC = () => {
  const { orderId } = useParams();
  const { oystehr } = useApiClients();
  if (!orderId) {
    throw new Error('orderId is undefined');
  }
  // TODO: The ServiceRequest and other necessary resources will have been made on Create Order. Just need to grab those
  const [serviceRequest, setServiceRequest] = useState({} as MockServiceRequest);
  // Note: specimens are no longer MVP, and also we'll be getting specimens from Create Order
  const [specimen, setSpecimen] = useState({});
  const [collectionInstructions, setCollectionInstructions] = useState({} as CollectionInstructions);
  const initialAoe: AoeQuestionnaireItemConfig[] = [];
  const [aoe, setAoe] = useState(initialAoe);
  const [isLoading, setIsLoading] = useState(true);
  const [taskStatus, setTaskStatus] = useState('pending' as StatusString);

  const handleSampleCollectionTaskChange = React.useCallback(() => setTaskStatus('collected'), [setTaskStatus]);

  useEffect(() => {
    console.log(10);
    async function getServiceRequestTemp(): Promise<void> {
      if (!orderId) {
        throw new Error('orderId is undefined');
      }
      const serviceRequestTemp = (
        await oystehr?.fhir.search<ServiceRequest | Practitioner | Task>({
          resourceType: 'ServiceRequest',
          params: [
            {
              name: '_id',
              value: orderId,
            },
            {
              name: '_revinclude',
              value: 'Task:based-on',
            },
            {
              name: '_include',
              value: 'ServiceRequest:requester',
            },
          ],
        })
      )?.unbundle();
      const serviceRequestsTemp: ServiceRequest[] | undefined = serviceRequestTemp?.filter(
        (resourceTemp) => resourceTemp.resourceType === 'ServiceRequest'
      );
      const practitionersTemp: Practitioner[] | undefined = serviceRequestTemp?.filter(
        (resourceTemp) => resourceTemp.resourceType === 'Practitioner'
      );
      const tasksTemp: Task[] | undefined = serviceRequestTemp?.filter(
        (resourceTemp) => resourceTemp.resourceType === 'Task'
      );

      if (serviceRequestsTemp?.length !== 1) {
        throw new Error('service request is not found');
      }

      if (practitionersTemp?.length !== 1) {
        throw new Error('practitioner is not found');
      }

      if (tasksTemp?.length !== 1) {
        throw new Error('task is not found');
      }

      const serviceRequest = serviceRequestsTemp?.[0];
      const practitioner = practitionersTemp?.[0];
      const task = tasksTemp?.[0];

      setServiceRequest({
        diagnosis: serviceRequest?.reasonCode?.map((reasonCode) => reasonCode.text).join('; ') || 'Missing diagnosis',
        patientName: 'Patient Name',
        orderName: (serviceRequest?.contained?.[0] as ActivityDefinition)?.title || 'Missing Order name',
        orderingPhysician: practitioner.name
          ? oystehr?.fhir.formatHumanName(practitioner.name?.[0]) || 'Missing Provider name'
          : 'Missing Provider name',
        orderDateTime: task.authoredOn ? DateTime.fromISO(task.authoredOn) : undefined,
        labName: (serviceRequest?.contained?.[0] as ActivityDefinition).publisher || 'Missing Publisher name',
        sampleCollectionDateTime: DateTime.now(),
      });
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
    setAoe(mockAOEData.item);

    setIsLoading(false);
    // setTaskStatus('collected');
  }, [orderId, oystehr?.fhir]);

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
          <StatusChip status={taskStatus} />
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
              serviceRequest={serviceRequest}
              _onCollectionSubmit={handleSampleCollectionTaskChange}
            />
          )
        )}

        {taskStatus !== 'pending' && <OrderHistoryCard />}
      </Stack>
    </>
  );
};
