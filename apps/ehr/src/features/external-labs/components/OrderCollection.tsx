import { LoadingButton } from '@mui/lab';
import { Box, Button, Stack, Typography, useTheme } from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import React, { useState } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DynamicAOEInput, ExternalLabsStatus, LabOrderDetailedPageDTO, LabQuestionnaireResponse } from 'utils';
import { submitLabOrder } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { AOECard } from './AOECard';
import { OrderHistoryCard } from './OrderHistoryCard';
import { OrderInformationCard } from './OrderInformationCard';
import { SampleCollectionInstructionsCard } from './SampleCollectionInstructionsCard';

interface SampleCollectionProps {
  labOrder: LabOrderDetailedPageDTO;
  showActionButtons?: boolean;
  showOrderInfo?: boolean;
  isAOECollapsed?: boolean;
}

export async function openPdf(url: string): Promise<void> {
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
  const [specimensData, setSpecimensData] = useState<{ [specimenId: string]: { date: string } }>({});
  const shouldShowSampleCollectionInstructions =
    !labOrder.isPSC &&
    (labOrder.orderStatus === ExternalLabsStatus.pending || labOrder.orderStatus === ExternalLabsStatus.sent);
  const showAOECard = aoe.length > 0;

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
        const { orderPdfUrl, labelPdfUrl } = await submitLabOrder(oystehr, {
          serviceRequestID: labOrder.serviceRequestId,
          accountNumber: labOrder.accountNumber,
          data,
          ...(!labOrder.isPSC && { specimens: specimensData }), // non PSC orders require specimens, validation is handled in the zambda
        });

        if (labelPdfUrl) await openPdf(labelPdfUrl);

        await openPdf(orderPdfUrl);
        setSubmitLoading(false);
        setError(undefined);
        navigate(`/in-person/${appointmentID}/external-lab-orders`);
      } catch (e) {
        const oyError = e as OystehrSdkError;
        console.log('error creating external lab order1', oyError.code, oyError.message);
        const errorMessage = [oyError.message || 'There was an error submitting the lab order'];
        setError(errorMessage);
        setSubmitLoading(false);
      }
    }
    updateFhir().catch((e) => {
      const oyError = e as OystehrSdkError;
      console.log('error creating external lab order2', oyError.code, oyError.message);
      const errorMessage = [oyError.message || 'There was an error submitting the lab order'];
      setError(errorMessage);
    });
    console.log(`data at submit: ${JSON.stringify(data)}`);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(sampleCollectionSubmit)}>
        {showAOECard && (
          <AOECard
            questions={aoe}
            isReadOnly={orderStatus !== 'pending'}
            labQuestionnaireResponses={labQuestionnaireResponses as LabQuestionnaireResponse[]}
            isCollapsed={isAOECollapsed}
          />
        )}

        {shouldShowSampleCollectionInstructions &&
          labOrder.samples.map((sample) => (
            <Box sx={{ marginTop: showAOECard ? 2 : 0 }}>
              <SampleCollectionInstructionsCard
                key={sample.specimen.id}
                sample={sample}
                serviceRequestId={labOrder.serviceRequestId}
                timezone={labOrder.encounterTimezone}
                setSpecimenData={(specimenId: string, date: string) =>
                  setSpecimensData((prev) => ({ ...prev, [specimenId]: { date } }))
                }
                printLabelVisible={orderStatus === 'sent'}
                isDateEditable={orderStatus === 'pending'}
              />
            </Box>
          ))}

        {showOrderInfo && <OrderInformationCard orderPdfUrl={labOrder.orderPdfUrl} />}

        <Box sx={{ mt: 2 }}>
          <OrderHistoryCard
            isPSCPerformed={labOrder.isPSC}
            orderHistory={labOrder?.history}
            timezone={labOrder.encounterTimezone}
          />
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
                  Submit & Print Order{!labOrder.isPSC ? ' and Label' : ''}
                </LoadingButton>
              </Stack>
            )}
          </Stack>
        )}
        {error && error.length > 0 && (
          <Box sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            {error.map((msg, idx) => (
              <Box sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                <Typography sx={{ color: theme.palette.error.main }} key={`errorMsg-${idx}`}>
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
