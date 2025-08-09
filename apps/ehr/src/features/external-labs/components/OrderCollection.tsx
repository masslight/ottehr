import { LoadingButton } from '@mui/lab';
import { Box, Button, Stack } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import React, { useMemo, useState } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CustomDialog } from 'src/components/dialogs';
import {
  DynamicAOEInput,
  ExternalLabsStatus,
  LabOrderDetailedPageDTO,
  LabQuestionnaireResponse,
  ORDER_SUBMITTED_MESSAGE,
} from 'utils';
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
  const [manualSubmitError, setManualSubmitError] = useState<string[] | undefined>(undefined);
  const [errorDialogOpen, setErrorDialogOpen] = useState<boolean>(false);
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

  const submitOrder = async ({ data, manualOrder }: { data: DynamicAOEInput; manualOrder: boolean }): Promise<void> => {
    setSubmitLoading(true);

    if (!oystehr) {
      setError(['Oystehr client is undefined']);
      setErrorDialogOpen(true);
      return;
    }

    const sanitizedData = sanitizeFormData(data);

    const { orderPdfUrl, labelPdfUrl } = await submitLabOrder(oystehr, {
      serviceRequestID: labOrder.serviceRequestId,
      accountNumber: labOrder.accountNumber,
      manualOrder,
      data: sanitizedData,
      ...(!labOrder.isPSC && { specimens: specimensData }), // non PSC orders require specimens, validation is handled in the zambda
    });

    if (labelPdfUrl) await openPdf(labelPdfUrl);
    await openPdf(orderPdfUrl);

    setSubmitLoading(false);
    setError(undefined);
    navigate(`/in-person/${appointmentID}/external-lab-orders`);

    console.log(`data at submit: ${JSON.stringify(sanitizedData)}`);
  };

  const handleAutomatedSubmit: SubmitHandler<DynamicAOEInput> = async (data) => {
    try {
      await submitOrder({ data, manualOrder: false });
    } catch (e) {
      const sdkError = e as Oystehr.OystehrSdkError;
      console.log('error creating external lab order1', sdkError.code, sdkError.message);
      const errorMessage = [sdkError.message || 'There was an error submitting the lab order'];
      setError(errorMessage);
      setErrorDialogOpen(true);
      setSubmitLoading(false);
    }
  };

  const handleManualSubmit = async (): Promise<void> => {
    const data = methods.getValues();
    try {
      await submitOrder({ data, manualOrder: true });
    } catch (e) {
      const sdkError = e as Oystehr.OystehrSdkError;
      console.log('error creating external lab order1', sdkError.code, sdkError.message);
      const errorMessages = [sdkError.message || 'There was an error submitting the lab order'];
      if (sdkError.message === ORDER_SUBMITTED_MESSAGE) {
        errorMessages.push('please refresh this page');
      }
      setManualSubmitError(errorMessages);
      setSubmitLoading(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleAutomatedSubmit)}>
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
        <CustomDialog
          open={errorDialogOpen}
          confirmLoading={submitLoading}
          handleConfirm={() => handleManualSubmit()}
          confirmText="Manually submit lab order"
          handleClose={() => {
            setErrorDialogOpen(false);
            setManualSubmitError(undefined);
          }}
          title="Error submitting lab order"
          description={error?.join(',') || 'Error submitting lab order'}
          error={manualSubmitError?.join(', ')}
          closeButtonText="cancel"
        />
      </form>
    </FormProvider>
  );
};
