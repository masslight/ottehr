import { LoadingButton } from '@mui/lab';
import { Box, Button, Stack, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import React, { useMemo, useState } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DynamicAOEInput, ExternalLabsStatus, LabOrderDetailedPageDTO, LabQuestionnaireResponse, openPdf } from 'utils';
import { updateLabOrderResources } from '../../../api/api';
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
  const aoe = useMemo(() => questionnaireData?.questionnaire.item || [], [questionnaireData]);
  const labQuestionnaireResponses = questionnaireData?.questionnaireResponseItems;
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [specimensData, setSpecimensData] = useState<{ [specimenId: string]: { date: string } }>({});
  const shouldShowSampleCollectionInstructions =
    !labOrder.isPSC &&
    (labOrder.orderStatus === ExternalLabsStatus.pending || labOrder.orderStatus === ExternalLabsStatus.sent);
  const showAOECard = aoe.length > 0;

  const sanitizeFormData = (data: DynamicAOEInput): DynamicAOEInput => {
    const sanitizedData = { ...data };

    Object.keys(sanitizedData).forEach((item) => {
      if (!sanitizedData[item]) {
        delete sanitizedData[item];
        return;
      }

      const question = aoe.find((question) => question.linkId === item);

      if (question && question.type === 'boolean') {
        if (sanitizedData[item] === 'true') {
          sanitizedData[item] = true;
        }
        if (sanitizedData[item] === 'false') {
          sanitizedData[item] = false;
        }
      }
      console.log(sanitizedData[item]);
      if (question && (question.type === 'integer' || question.type === 'decimal')) {
        sanitizedData[item] = Number(sanitizedData[item]);
      }
    });

    return sanitizedData;
  };

  const markOrderAsReady: SubmitHandler<DynamicAOEInput> = async (data): Promise<void> => {
    setSubmitLoading(true);
    setError(undefined);

    if (!oystehr) {
      setError(['Oystehr client is undefined']);
      return;
    }

    const sanitizedData = sanitizeFormData(data);
    console.log('specimensData', specimensData);
    try {
      const result = await updateLabOrderResources(oystehr, {
        event: 'saveOrderCollectionData',
        serviceRequestId: labOrder.serviceRequestId,
        data: sanitizedData,
        ...(!labOrder.isPSC && { specimenCollectionDates: specimensData }), // non PSC orders require specimens
      });
      if (result.presignedLabelURL) await openPdf(result.presignedLabelURL);
      navigate(`/in-person/${appointmentID}/external-lab-orders`);
    } catch (e) {
      const sdkError = e as Oystehr.OystehrSdkError;
      console.log('error updating collection data and marking as ready', sdkError.code, sdkError.message);
      const errorMessage = [sdkError.message];
      setError(errorMessage);
    }

    setSubmitLoading(false);
    console.log(`data at mark as ready: ${JSON.stringify(sanitizedData)}`);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(markOrderAsReady)}>
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
            <Box sx={{ marginTop: showAOECard ? 2 : 0 }} key={`sample-card-${sample.specimen.id}`}>
              <SampleCollectionInstructionsCard
                sample={sample}
                timezone={labOrder.encounterTimezone}
                setSpecimenData={(specimenId: string, date: string) =>
                  setSpecimensData((prev) => ({ ...prev, [specimenId]: { date } }))
                }
                isDateEditable={orderStatus === 'pending'}
              />
            </Box>
          ))}

        {showOrderInfo && (
          <OrderInformationCard labelPdfUrl={labOrder.labelPdfUrl} orderPdfUrl={labOrder.orderPdfUrl} />
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body1">
            <span style={{ fontWeight: 500 }}>Requisition Number: </span> {labOrder.orderNumber}
          </Typography>
        </Box>

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
                  Mark as Ready{!labOrder.isPSC ? ' & Print Label' : ''}
                </LoadingButton>
              </Stack>
            )}
          </Stack>
        )}
        {error && (
          <Box>
            <Typography color="error">{error.join(', ')}</Typography>
          </Box>
        )}
      </form>
    </FormProvider>
  );
};
