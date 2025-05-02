import React, { useState } from 'react';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Stack, Typography } from '@mui/material';
import { AOECard } from './AOECard';
// import { SampleCollectionInstructionsCard } from './SampleCollectionInstructionsCard';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { DynamicAOEInput, LabOrderDetailedPageDTO, LabQuestionnaireResponse } from 'utils';
// import useEvolveUser from '../../../hooks/useEvolveUser';
import { submitLabOrder } from '../../../api/api';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

export async function openLabOrder(url: string): Promise<void> {
  window.open(url, '_blank');
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
  // const currentUser = useEvolveUser();
  const questionnaireData = labOrder?.questionnaire[0];
  const orderStatus = labOrder.orderStatus;
  const aoe = questionnaireData?.questionnaire.item || [];
  const labQuestionnaireResponses = questionnaireData?.questionnaireResponseItems;
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
        const { pdfUrl } = await submitLabOrder(oystehr, {
          serviceRequestID: labOrder.serviceRequestId,
          accountNumber: labOrder.accountNumber,
          data: data,
        });

        await openLabOrder(pdfUrl);
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
          questions={aoe}
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

        <Box sx={{ mt: 2 }}>
          <OrderHistoryCard orderHistory={labOrder?.history} timezone={labOrder.encounterTimezone} />
        </Box>

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
