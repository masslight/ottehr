import React, { useState } from 'react';
import { LoadingButton } from '@mui/lab';
import { Button, Stack, Typography } from '@mui/material';
import { AOECard } from './AOECard';
// import { SampleCollectionInstructionsCard } from './SampleCollectionInstructionsCard';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { LabOrderDetailedPageDTO, LabQuestionnaireResponse } from 'utils';
// import useEvolveUser from '../../../hooks/useEvolveUser';
import { submitLabOrder } from '../../../api/api';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { getPresignedFileUrl } from '../../../helpers/files.helper';
import { SampleInformationCard } from './SampleInformationCard';
import { OrderHistoryCard } from './OrderHistoryCard';
import { useApiClients } from '../../../hooks/useAppClients';
// import { StatusString } from './StatusChip';

// interface CollectionInstructions {
//   container: string;
//   volume: string;
//   minimumVolume: string;
//   storageRequirements: string;
//   collectionInstructions: string;
// }

interface SampleCollectionProps {
  labOrder: LabOrderDetailedPageDTO;
  showActionButtons?: boolean;
  showOrderInfo?: boolean;
  isAOECollapsed?: boolean;
}

interface DynamicAOEInput {
  [key: string]: any;
}

export async function openLabOrder(url: string): Promise<void> {
  const requestTemp = await fetch(url);
  const orderForm = await requestTemp.blob();
  const pdfUrl = URL.createObjectURL(orderForm);
  console.log(pdfUrl);
  window.open(pdfUrl);
}

export const OrderCollection: React.FC<SampleCollectionProps> = ({
  labOrder,
  showActionButtons = true,
  showOrderInfo = true,
  isAOECollapsed = false,
}) => {
  const { oystehrZambda: oystehr } = useApiClients();
  // can add a Yup resolver {resolver: yupResolver(definedSchema)} for validation, see PaperworkGroup for example
  const methods = useForm<DynamicAOEInput>();
  const navigate = useNavigate();
  const { id: appointmentID } = useParams();
  const { getAccessTokenSilently } = useAuth0();
  // const currentUser = useEvolveUser();
  const questionnaireData = labOrder.questionnaire[0];
  const orderStatus = labOrder.orderStatus;
  const aoe = questionnaireData.questionnaire.item;
  const labQuestionnaireResponses = questionnaireData.questionnaireResponseItems;
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<boolean>(false);

  const sampleCollectionSubmit: SubmitHandler<DynamicAOEInput> = (data) => {
    setSubmitLoading(true);

    async function updateFhir(): Promise<void> {
      if (!oystehr) {
        throw new Error('oystehr client is undefined');
      }
      setError(false);
      Object.keys(data).forEach((item) => {
        if (!data[item]) {
          delete data[item];
          return;
        }
        const question = aoe!.find((question) => question.linkId === item);

        if (question && question.type === 'boolean') {
          if (data[item] === 'true') {
            data[item] = true;
          }
          if (data[item] === 'false') {
            data[item] = false;
          }
        }
        console.log(data[item]);
        if (question && (question.type === 'integer' || question.type === 'decimal')) {
          data[item] = Number(data[item]);
        }
      });

      try {
        const request: any = await submitLabOrder(oystehr, {
          serviceRequestID: labOrder.serviceRequestId,
          accountNumber: labOrder.accountNumber,
          data: data,
        });
        const token = await getAccessTokenSilently();
        const url = request.url;
        const urlTemp = await getPresignedFileUrl(url, token);
        if (!urlTemp) {
          throw new Error('error with a presigned url');
        }
        await openLabOrder(urlTemp);
        setSubmitLoading(false);
        setError(false);
        navigate(`/in-person/${appointmentID}/external-lab-orders`);
      } catch (error) {
        console.log('error with lab order', error);
        setSubmitLoading(false);
        setError(true);
      }
    }
    updateFhir().catch((error) => console.log(error));
    console.log(`data at submit: ${JSON.stringify(data)}`);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(sampleCollectionSubmit)}>
        <AOECard
          questions={aoe!}
          labQuestionnaireResponses={labQuestionnaireResponses as LabQuestionnaireResponse[]}
          isCollapsed={isAOECollapsed}
        />
        {/* <SampleCollectionInstructionsCard instructions={collectionInstructions} /> */}
        {showOrderInfo && (
          <SampleInformationCard
          // orderAddedDateTime={labOrder?.orderAddedDate}
          // orderingPhysician={labOrder?.orderingPhysician || ''}
          // individualCollectingSample={'The best nurse'}
          // collectionDateTime={DateTime.now().toString()}
          // showInPatientPortal={showInPatientPortal}
          />
        )}
        <OrderHistoryCard orderHistory={labOrder?.history} />
        {showActionButtons && (
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <Link to={`/in-person/${appointmentID}/external-lab-orders`}>
              <Button variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}>
                Back
              </Button>
            </Link>
            {orderStatus === 'pending' && (
              <Stack>
                {error && (
                  <Typography variant="body1" color="error">
                    Error submitting lab order
                  </Typography>
                )}
                <LoadingButton
                  loading={submitLoading}
                  variant="contained"
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  type="submit"
                >
                  Order
                </LoadingButton>
                {/* <FormHelperText error>Please address errors</FormHelperText> */}
              </Stack>
            )}
          </Stack>
        )}
      </form>
    </FormProvider>
  );
};
