import React, { useState } from 'react';
import { LoadingButton } from '@mui/lab';
import { Stack } from '@mui/material';
import { AOECard } from './AOECard';
// import { SampleCollectionInstructionsCard } from './SampleCollectionInstructionsCard';
import { SampleInformationCard } from './SampleInformationCard';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import Oystehr from '@oystehr/sdk';
import { OrderDetails } from 'utils';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { submitLabOrder } from '../../../api/api';
import { QuestionnaireItem } from 'fhir/r4b';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

interface SampleCollectionProps {
  aoe: QuestionnaireItem[];
  collectionInstructions: CollectionInstructions;
  specimen: any;
  serviceRequestID: string;
  serviceRequest: OrderDetails;
  _onCollectionSubmit: () => void;
  oystehr: Oystehr | undefined;
}

interface DynamicAOEInput {
  [key: string]: any;
}

export const OrderCollection: React.FC<SampleCollectionProps> = ({
  aoe,
  // collectionInstructions,
  specimen: _2,
  serviceRequestID,
  serviceRequest,
  _onCollectionSubmit,
  oystehr,
}) => {
  // can add a Yup resolver {resolver: yupResolver(definedSchema)} for validation, see PaperworkGroup for example
  const methods = useForm<DynamicAOEInput>();
  const currentUser = useEvolveUser();

  // NEW TODO: will probably end up getting rid of a lot of this state since it will be held in the form state
  // need to iterate through the passed aoe and format it into state so we can collect the answer
  // TODO: might want to do this in a useMemo for perf

  const [submitLoading, setSubmitLoading] = useState(false);

  // TODO: need to add a submit handler that works the react-hook-form way
  const sampleCollectionSubmit: SubmitHandler<DynamicAOEInput> = (data) => {
    setSubmitLoading(true);

    async function updateFhir(): Promise<void> {
      if (!oystehr) {
        throw new Error('oystehr client is undefined');
      }
      Object.keys(data).forEach((item) => {
        const question = aoe.find((question) => question.linkId === item);

        if (question && question.type === 'boolean') {
          if (data[item] === 'true') {
            data[item] = true;
          }
          if (data[item] === 'false') {
            data[item] = false;
          }
        }
        if (question && (question.type === 'integer' || question.type === 'decimal')) {
          data[item] = Number(data[item]);
        }
      });

      await submitLabOrder(oystehr, {
        serviceRequestID: serviceRequestID,
        data: data,
      });
      setSubmitLoading(false);
    }
    updateFhir().catch((error) => console.log(error));

    setSubmitLoading(false);
    console.log(`data at submit: ${JSON.stringify(data)}`);
  };

  return (
    <>
      <FormProvider {...methods}>
        <AOECard questions={aoe} />
        {/* <SampleCollectionInstructionsCard instructions={collectionInstructions} /> */}
        <SampleInformationCard
          orderAddedDateTime={serviceRequest.orderDateTime}
          orderingPhysician={serviceRequest.orderingPhysician || ''}
          individualCollectingSample={'The best nurse'}
          collectionDateTime={serviceRequest.sampleCollectionDateTime}
          // showInPatientPortal={showInPatientPortal}
          showInPatientPortal={true}
        />
        {/* <OrderHistoryCard /> */}
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <LoadingButton variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}>
            Back
          </LoadingButton>
          <Stack>
            <LoadingButton
              loading={submitLoading}
              variant="contained"
              sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
              onClick={methods.handleSubmit(sampleCollectionSubmit)}
            >
              Order
            </LoadingButton>
            {/* <FormHelperText error>Please address errors</FormHelperText> */}
          </Stack>
        </Stack>
      </FormProvider>
    </>
  );
};
