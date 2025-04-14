import React, { useState } from 'react';
import { LoadingButton } from '@mui/lab';
import { Button, Stack, Typography } from '@mui/material';
import { AOECard } from './AOECard';
// import { SampleCollectionInstructionsCard } from './SampleCollectionInstructionsCard';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import Oystehr from '@oystehr/sdk';
import { LabOrderDTO, LabQuestionnaireResponse, OrderDetails } from 'utils';
// import useEvolveUser from '../../../hooks/useEvolveUser';
import { submitLabOrder } from '../../../api/api';
import { QuestionnaireItem } from 'fhir/r4b';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { getPresignedFileUrl } from '../../../helpers/files.helper';
import { SampleInformationCard } from './SampleInformationCard';
import { OrderHistoryCard } from './OrderHistoryCard';
import { StatusString } from './StatusChip';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

interface SampleCollectionProps {
  aoe: QuestionnaireItem[];
  status: StatusString;
  labQuestionnaireResponses?: LabQuestionnaireResponse[];
  collectionInstructions: CollectionInstructions;
  specimen: any;
  serviceRequestID: string;
  serviceRequest: OrderDetails;
  accountNumber: string;
  _onCollectionSubmit: () => void;
  labOrder?: LabOrderDTO | undefined;
  oystehr: Oystehr | undefined;
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
  aoe,
  status,
  // collectionInstructions,
  labQuestionnaireResponses,
  specimen: _2,
  serviceRequestID,
  accountNumber,
  // serviceRequest,
  _onCollectionSubmit,
  labOrder,
  oystehr,
  showActionButtons = true,
  showOrderInfo = true,
  isAOECollapsed = false,
}) => {
  // can add a Yup resolver {resolver: yupResolver(definedSchema)} for validation, see PaperworkGroup for example
  const methods = useForm<DynamicAOEInput>();
  const navigate = useNavigate();
  const { id: appointmentID } = useParams();
  const { getAccessTokenSilently } = useAuth0();
  // const currentUser = useEvolveUser();

  // TODO: might want to do this in a useMemo for perf

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
        const question = aoe.find((question) => question.linkId === item);

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
          serviceRequestID: serviceRequestID,
          accountNumber: accountNumber,
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
        <AOECard questions={aoe} labQuestionnaireResponses={labQuestionnaireResponses} isCollapsed={isAOECollapsed} />
        {/* <SampleCollectionInstructionsCard instructions={collectionInstructions} /> */}
        {showOrderInfo && (
          <SampleInformationCard
          // orderAddedDateTime={serviceRequest.orderDateTime}
          // orderingPhysician={serviceRequest.orderingPhysician || ''}
          // individualCollectingSample={'The best nurse'}
          // collectionDateTime={serviceRequest.sampleCollectionDateTime}
          // showInPatientPortal={showInPatientPortal}
          />
        )}
        {status !== 'pending' && <OrderHistoryCard orderHistory={labOrder?.history} />}
        {showActionButtons && (
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <Link to={`/in-person/${appointmentID}/external-lab-orders`}>
              <Button variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}>
                Back
              </Button>
            </Link>
            {status === 'pending' && (
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
                  // onClick={methods.handleSubmit(sampleCollectionSubmit)}
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
