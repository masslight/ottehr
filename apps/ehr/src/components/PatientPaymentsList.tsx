import {
  Alert,
  Box,
  Button,
  capitalize,
  CircularProgress,
  Container,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Appointment, DocumentReference, Encounter, Organization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, Fragment, ReactElement, useEffect, useState } from 'react';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetEncounter } from 'src/hooks/useEncounter';
import { useGetPatientAccount } from 'src/hooks/useGetPatient';
import { useGetPatientPaymentsList } from 'src/hooks/useGetPatientPaymentsList';
import {
  APIError,
  APIErrorCode,
  CashOrCardPayment,
  FHIR_EXTENSION,
  getCoding,
  getPaymentVariantFromEncounter,
  isApiError,
  OrderedCoveragesWithSubscribers,
  PatientPaymentBenefit,
  PatientPaymentDTO,
  PaymentVariant,
  PostPatientPaymentInput,
  RECEIPT_CODE,
  SendReceiptByEmailZambdaInput,
  SERVICE_CATEGORY_SYSTEM,
  updateEncounterPaymentVariantExtension,
} from 'utils';
import { sendReceiptByEmail } from '../api/api';
import PaymentDialog from './dialogs/PaymentDialog';
import SendReceiptByEmailDialog, { SendReceiptFormData } from './dialogs/SendReceiptByEmailDialog';
import { RefreshableStatusChip } from './RefreshableStatusWidget';

export interface PaymentListProps {
  patient: Patient | undefined;
  appointment: Appointment | undefined;
  encounterId: string;
  loading?: boolean;
  responsibleParty?: {
    fullName?: string;
    email?: string;
  };
  insuranceCoverages?: {
    coverages: OrderedCoveragesWithSubscribers;
    insuranceOrgs: Organization[];
  };
}

const idForPaymentDTO = (payment: PatientPaymentDTO): string => {
  if (payment.paymentMethod === 'card') {
    return payment.fhirPaymentNotificationId;
  } else {
    return payment.fhirPaymentNotificationId ?? 'unknown-payment-id'; //todo: should get something from candid
  }
};

export default function PatientPaymentList({
  loading,
  patient,
  appointment,
  encounterId,
  responsibleParty,
  insuranceCoverages,
}: PaymentListProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();
  const theme = useTheme();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [sendReceiptByEmailDialogOpen, setSendReceiptByEmailDialogOpen] = useState(false);
  const [receiptDocRefId, setReceiptDocRefId] = useState<string | undefined>();
  const {
    data: encounter,
    refetch: refetchEncounter,
    isRefetching: isEncounterRefetching,
  } = useGetEncounter({ encounterId });

  const {
    data: paymentData,
    refetch: refetchPaymentList,
    isRefetching,
    error: paymentListError,
  } = useGetPatientPaymentsList({
    patientId: patient?.id ?? '',
    encounterId,
    disabled: !encounterId || !patient?.id,
  });
  const { data: insuranceData } = useGetPatientAccount({
    apiClient,
    patientId: patient?.id ?? null,
  });

  function getPaymentAmountFromPatientBenefit({
    coverage,
    code,
    coverageCode,
    levelCode,
    periodCode,
  }: {
    coverage: PatientPaymentBenefit[];
    code: string;
    coverageCode: string;
    levelCode: string;
    periodCode: string;
  }): number | undefined {
    return coverage?.find(
      (item) =>
        item.code === code &&
        item.coverageCode === coverageCode &&
        item.levelCode === levelCode &&
        item.periodCode === periodCode
    )?.amountInUSD;
  }

  const payments = paymentData?.payments ?? []; // Replace with actual payments when available

  const stripeCustomerDeletedError =
    paymentListError && isApiError(paymentListError)
      ? (paymentListError as APIError).code === APIErrorCode.STRIPE_CUSTOMER_ID_DOES_NOT_EXIST
      : false;

  useEffect(() => {
    if (oystehr && encounterId) {
      void oystehr.fhir
        .search<DocumentReference>({
          resourceType: 'DocumentReference',
          params: [
            {
              name: 'type',
              value: RECEIPT_CODE,
            },
            {
              name: 'encounter',
              value: 'Encounter/' + encounterId,
            },
          ],
        })
        .then((response) => {
          const docRef = response.unbundle()[0];
          if (docRef) {
            setReceiptDocRefId(docRef.id);
          }
        });
    }
  }, [encounterId, oystehr, paymentData]);

  const sendReceipt = async (formData: SendReceiptFormData): Promise<void> => {
    if (!oystehr) return;
    try {
      if (!receiptDocRefId) throw new Error("unable to send email, don't have receipt docRefId");
      const sendReceiptParams: SendReceiptByEmailZambdaInput = {
        recipientFullName: formData.recipientName,
        email: formData.recipientEmail,
        receiptDocRefId: receiptDocRefId,
      };
      await sendReceiptByEmail(oystehr, sendReceiptParams);
      setSendReceiptByEmailDialogOpen(false);
      enqueueSnackbar('Receipt sent successfully', { variant: 'success' });
    } catch {
      enqueueSnackbar('Something went wrong! Unable to send receipt.', { variant: 'error' });
    }
  };

  const getLabelForPayment = (payment: PatientPaymentDTO): string | ReactElement => {
    if (payment.paymentMethod === 'card') {
      if (payment.cardLast4) {
        return `XXXX - XXXX - XXXX - ${payment.cardLast4}`;
      } else {
        return (
          <RefreshableStatusChip
            status={'processing...'}
            styleMap={{
              ['processing...']: {
                textSX: {
                  fontSize: '16px',
                  fontWeight: 'normal',
                  color: theme.palette.primary.dark,
                },
                bgColor: 'transparent',
                textColor: theme.palette.primary.dark,
              },
            }}
            lastRefreshISO={''}
            handleRefresh={refetchPaymentList}
            isRefreshing={isRefetching}
            flexDirection="row"
          />
        );
      }
    } else {
      return capitalize(payment.paymentMethod);
    }
  };

  const createNewPayment = useMutation({
    mutationFn: async (input: PostPatientPaymentInput) => {
      if (oystehrZambda && input) {
        return oystehrZambda.zambda
          .execute({
            id: 'patient-payments-post',
            ...input,
          })
          .then(async () => {
            await refetchPaymentList();
            setPaymentDialogOpen(false);
          });
      }
    },
    retry: 0,
  });

  const updateEncounter = useMutation({
    mutationFn: async (input: Encounter) => {
      if (oystehr && encounter && input && input.id) {
        await oystehr.fhir
          .patch<Encounter>({
            id: input.id,
            resourceType: 'Encounter',
            operations: [
              {
                op: encounter.extension !== undefined ? 'replace' : 'add',
                path: '/extension',
                value: input.extension,
              },
            ],
          })
          .then(async () => {
            await refetchEncounter();
          })
          .catch(async () => {
            enqueueSnackbar("Something went wrong! Visit payment option can't be changed.", { variant: 'error' });
            await refetchEncounter();
          });
      }
    },
    onError: async (e) => {
      console.log('error updating encounter', e);
    },
    retry: 0,
  });

  const paymentVariant = (() => {
    if (encounter) {
      return getPaymentVariantFromEncounter(encounter);
    }
    return undefined;
  })();

  const errorMessage = (() => {
    const networkError = createNewPayment.error;
    if (networkError) {
      if (isApiError(networkError)) {
        return (networkError as APIError).message;
      }
      return 'Something went wrong. Payment was not completed.';
    }
    return null;
  })();

  const insurance = insuranceCoverages?.coverages?.primary?.identifier?.find(
    (temp) => temp.type?.coding?.find((temp) => temp.code === 'MB')
  )?.assigner;
  const insuranceOrganization = insuranceCoverages?.insuranceOrgs?.find(
    (organization) => organization.id === insurance?.reference?.replace('Organization/', '')
  );
  const insuranceName = insuranceOrganization?.name;
  const insuranceNotes = insuranceOrganization?.extension?.find(
    (extensionTemp) => extensionTemp.url === FHIR_EXTENSION.InsurancePlan.notes.url
  )?.valueString;

  const copayAmount = getPaymentAmountFromPatientBenefit({
    coverage: insuranceData?.coverageChecks?.[0]?.copay || [],
    code: 'UC',
    coverageCode: 'B',
    levelCode: 'IND',
    periodCode: '27',
  });

  const remainingDeductibleAmount = getPaymentAmountFromPatientBenefit({
    coverage: insuranceData?.coverageChecks?.[0]?.deductible || [],
    code: '30',
    coverageCode: 'C',
    levelCode: 'IND',
    periodCode: '29',
  });

  const serviceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
  const isUrgentCare = serviceCategory === 'urgent-care';
  const isOccupationalMedicine = serviceCategory === 'occupational-medicine';
  const isWorkmansComp = serviceCategory === 'workers-comp';

  return (
    <Paper
      sx={{
        marginTop: 2,
        padding: 3,
      }}
    >
      <Typography variant="h4" color="primary.dark">
        Payer/Responsible for Claim
      </Typography>
      <RadioGroup
        row
        name="options"
        value={paymentVariant ?? null}
        onChange={async (e) => {
          if (encounter) {
            await updateEncounter.mutateAsync(
              updateEncounterPaymentVariantExtension(encounter, e.target.value as PaymentVariant)
            );
          }
        }}
        sx={{ mt: 2 }}
      >
        {isUrgentCare || isWorkmansComp ? (
          <FormControlLabel
            disabled={updateEncounter.isPending || isEncounterRefetching}
            value={PaymentVariant.insurance}
            control={<Radio />}
            label="Insurance"
          />
        ) : null}
        {isUrgentCare || isOccupationalMedicine ? (
          <FormControlLabel
            disabled={updateEncounter.isPending || isEncounterRefetching}
            value={PaymentVariant.selfPay}
            control={<Radio />}
            label="Self"
          />
        ) : null}
        {isOccupationalMedicine || isWorkmansComp ? (
          <FormControlLabel
            disabled={updateEncounter.isPending || isEncounterRefetching}
            value={PaymentVariant.employer}
            control={<Radio />}
            label="Employer"
          />
        ) : null}
      </RadioGroup>
      <Container
        style={{
          backgroundColor: theme.palette.background.default,
          borderRadius: 4,
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
          Payment Considerations
        </Typography>
        {insuranceData ? (
          <>
            <Table style={{ tableLayout: 'fixed' }}>
              <TableBody>
                <TableRow>
                  <TableCell style={{ fontSize: '16px' }}>Insurance Carrier</TableCell>
                  <TableCell style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'right' }}>
                    {insuranceName ? insuranceName : 'Unknown'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ fontSize: '16px' }}>Copay</TableCell>
                  <TableCell style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'right' }}>
                    {copayAmount ? `$${copayAmount}` : 'Unknown'}
                  </TableCell>
                </TableRow>
                <TableRow sx={{ '&:last-child td': { borderBottom: 'none' } }}>
                  <TableCell style={{ fontSize: '16px' }}>Remaining Deductible</TableCell>
                  <TableCell style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'right' }}>
                    {remainingDeductibleAmount ? `$${remainingDeductibleAmount}` : 'Unknown'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {insuranceNotes && (
              <Container
                style={{
                  backgroundColor: '#2169F514',
                  borderRadius: 4,
                  marginTop: 5,
                  paddingTop: 10,
                  paddingBottom: 10,
                }}
              >
                <Typography variant="body1" sx={{ color: theme.palette.primary.dark, fontWeight: 'bold' }}>
                  Notes
                </Typography>
                <Typography variant="body1" style={{ whiteSpace: 'pre' }}>
                  {insuranceNotes}
                </Typography>
              </Container>
            )}
          </>
        ) : (
          <CircularProgress />
        )}
      </Container>
      {stripeCustomerDeletedError && <StripeErrorAlert />}
      {!stripeCustomerDeletedError && (
        <>
          <Typography variant="h5" color="primary.dark" sx={{ mt: 2 }}>
            Patient Payments
          </Typography>
          <Table size="small" style={{ tableLayout: 'fixed' }}>
            <TableBody>
              {payments.length === 0 && !loading && (
                <TableRow>
                  <TableCell sx={{ paddingTop: 1, paddingBottom: 1 }}>
                    <Typography variant="body1" color="textSecondary">
                      No payments recorded.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {payments.map((payment) => {
                const paymentDateString = DateTime.fromISO(payment.dateISO).toLocaleString(DateTime.DATE_SHORT);
                return (
                  <Fragment key={idForPaymentDTO(payment)}>
                    <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <>
                        <TableCell
                          sx={{
                            width: '50%',
                            color: theme.palette.primary.dark,
                            paddingLeft: 0,
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                            {getLabelForPayment(payment)}
                          </Box>
                        </TableCell>

                        <TableCell
                          colSpan={2}
                          sx={{
                            textAlign: 'center',
                            wordWrap: 'break-word',
                            paddingRight: 0,
                            paddingTop: 0,
                            fontSize: '12px',
                          }}
                        >
                          {paymentDateString}
                        </TableCell>

                        <TableCell
                          sx={{
                            textAlign: 'right',
                            wordWrap: 'break-word',
                            paddingRight: 0,
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {loading ? (
                              <Skeleton aria-busy="true" width={200} />
                            ) : (
                              <Typography variant="body1">{`$${payment.amountInCents / 100}`}</Typography>
                            )}
                          </Box>
                        </TableCell>
                      </>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          <Button sx={{ marginTop: 2 }} onClick={() => setPaymentDialogOpen(true)} variant="contained" color="primary">
            $ Add Payment
          </Button>
          <Tooltip
            disableHoverListener={receiptDocRefId !== undefined}
            placement="top"
            title="Patient doesn't have any receipt for this encounter"
          >
            <span>
              <Button
                sx={{ mt: 2, ml: 2 }}
                disabled={!receiptDocRefId}
                onClick={() => setSendReceiptByEmailDialogOpen(true)}
                variant="contained"
                color="primary"
              >
                Email receipt
              </Button>
            </span>
          </Tooltip>
        </>
      )}
      {patient && (
        <PaymentDialog
          open={paymentDialogOpen}
          patient={patient}
          appointmentId={appointment?.id}
          handleClose={() => setPaymentDialogOpen(false)}
          isSubmitting={createNewPayment.isPending}
          submitPayment={async (data: CashOrCardPayment) => {
            const postInput: PostPatientPaymentInput = {
              patientId: patient.id ?? '',
              encounterId,
              paymentDetails: data,
            };
            await createNewPayment.mutateAsync(postInput);
          }}
        />
      )}
      <SendReceiptByEmailDialog
        title="Send receipt"
        modalOpen={sendReceiptByEmailDialogOpen}
        handleClose={() => setSendReceiptByEmailDialogOpen(false)}
        onSubmit={sendReceipt}
        submitButtonName="Send Receipt"
        defaultValues={{
          recipientName: responsibleParty?.fullName,
          recipientEmail: responsibleParty?.email,
        }}
      />
      <Snackbar
        // anchorOrigin={{ vertical: snackbarOpen.vertical, horizontal: snackbarOpen.horizontal }}
        open={errorMessage !== null}
        autoHideDuration={6000}
        onClose={() => createNewPayment.reset()}
      >
        <Alert severity="error" onClose={() => createNewPayment.reset()} sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

const StripeErrorAlert: FC = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        backgroundColor: theme.palette.common.white,
        borderColor: theme.palette.error.dark,
        borderWidth: 1,
        borderStyle: 'solid',
        marginTop: 2,
        padding: 2,
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Typography
        sx={{
          color: theme.palette.error.dark,
        }}
      >
        The Stripe customer ID associated with this account does not exist and may have been deleted. Collection of
        payments will be disabled until this issue is resolved. Please report the issue.
      </Typography>
    </Box>
  );
};
