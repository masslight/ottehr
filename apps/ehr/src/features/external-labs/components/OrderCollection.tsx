import React, { useState } from 'react';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Stack, Typography, useTheme } from '@mui/material';
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
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
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
  const theme = useTheme();
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
  const [error, setError] = useState<string[] | undefined>(undefined);

  const sampleCollectionSubmit: SubmitHandler<DynamicAOEInput> = (data) => {
    setSubmitLoading(true);

    async function updateFhir(): Promise<void> {
      if (!oystehr) {
        setError(['Oystehr client is undefined']);
        return;
      }
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
        setError(undefined);
        navigate(`/in-person/${appointmentID}/external-lab-orders`);
      } catch (e) {
        const oyError = e as OystehrSdkError;
        console.log('error creating lab order1', oyError.code, oyError.message);
        const errorMessage = [oyError.message || 'There was an error submitting the lab order'];
        setError(errorMessage);
        setSubmitLoading(false);
      }
    }
    updateFhir().catch((e) => {
      const oyError = e as OystehrSdkError;
      console.log('error creating lab order2', oyError.code, oyError.message);
      const errorMessage = [oyError.message || 'There was an error submitting the lab order'];
      setError(errorMessage);
    });
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
          <OrderHistoryCard orderHistory={labOrder?.history} />
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
                <LoadingButton
                  loading={submitLoading}
                  variant="contained"
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  type="submit"
                >
                  Order
                </LoadingButton>
              </Stack>
            )}
          </Stack>
        )}
        {error && error.length > 0 && (
          <Box sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            {error.map((msg, idx) => (
              <Box sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                <Typography sx={{ color: theme.palette.error.main }} key={`errormsg-${idx}`}>
                  {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </form>
    </FormProvider>
  );
};
