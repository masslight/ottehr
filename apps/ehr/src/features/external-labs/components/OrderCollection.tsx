import React, { useState } from 'react';
import { LoadingButton } from '@mui/lab';
import { Stack } from '@mui/material';
import { AOECard } from './AOECard';
import { SampleCollectionInstructionsCard } from './SampleCollectionInstructionsCard';
import { SampleInformationCard } from './SampleInformationCard';
import { DateTime } from 'luxon';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { AoeQuestionnaireItemConfig } from '../pages/OrderDetails';
import { MockServiceRequest } from '../pages/OrderDetails';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

interface SampleCollectionProps {
  aoe: AoeQuestionnaireItemConfig[];
  collectionInstructions: CollectionInstructions;
  specimen: any;
  serviceRequest: MockServiceRequest;
  _onCollectionSubmit: () => void;
}

interface DynamicAOEInput {
  [key: string]: any;
}

export const OrderCollection: React.FC<SampleCollectionProps> = ({
  aoe,
  collectionInstructions,
  specimen: _2,
  serviceRequest,
  _onCollectionSubmit,
}) => {
  // can add a Yup resolver {resolver: yupResolver(definedSchema)} for validation, see PaperworkGroup for example
  const methods = useForm<DynamicAOEInput>();

  // NEW TODO: will probably end up getting rid of a lot of this state since it will be held in the form state
  // need to iterate through the passed aoe and format it into state so we can collect the answer
  // TODO: might want to do this in a useMemo for perf

  const [submitLoading, setSubmitLoading] = useState(false);

  // TODO: need to add a submit handler that works the react-hook-form way
  const sampleCollectionSubmit: SubmitHandler<DynamicAOEInput> = (data) => {
    setSubmitLoading(true);

    console.log(`data at submit: ${data}`);
  };

  return (
    <>
      <FormProvider {...methods}>
        <AOECard questions={aoe} />
        <SampleCollectionInstructionsCard instructions={collectionInstructions} />
        <SampleInformationCard
          orderAddedDateTime={serviceRequest?.orderDateTime || DateTime.now()}
          orderingPhysician={serviceRequest?.orderingPhysician || ''}
          individualCollectingSample={'The best nurse'}
          collectionDateTime={serviceRequest?.sampleCollectionDateTime || DateTime.now()}
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
