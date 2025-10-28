import {
  Alert,
  Box,
  Button,
  capitalize,
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
import { DocumentReference, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, Fragment, ReactElement, useEffect, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetEncounter } from 'src/hooks/useEncounter';
import { useGetPatientPaymentsList } from 'src/hooks/useGetPatientPaymentsList';
import {
  APIError,
  APIErrorCode,
  CashOrCardPayment,
  getPaymentVariantFromEncounter,
  isApiError,
  PatientPaymentDTO,
  PaymentVariant,
  PostPatientPaymentInput,
  RECEIPT_CODE,
  SendReceiptByEmailZambdaInput,
  updateEncounterPaymentVariantExtension,
} from 'utils';
import { sendReceiptByEmail } from '../api/api';
import PaymentDialog from './dialogs/PaymentDialog';
import SendReceiptByEmailDialog, { SendReceiptFormData } from './dialogs/SendReceiptByEmailDialog';
import { RefreshableStatusChip } from './RefreshableStatusWidget';

export interface PaymentListProps {
  patient: Patient | undefined;
  encounterId: string;
  loading?: boolean;
  responsibleParty?: {
    fullName?: string;
    email?: string;
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
  encounterId,
  responsibleParty,
}: PaymentListProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
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

  return (
    <Paper
      sx={{
        marginTop: 2,
        padding: 3,
      }}
    >
      <Typography variant="h4" color="primary.dark">
        How would patient like to pay for the visit?
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
        <FormControlLabel
          disabled={updateEncounter.isPending || isEncounterRefetching}
          value={PaymentVariant.insurance}
          control={<Radio />}
          label="Insurance"
        />
        <FormControlLabel
          disabled={updateEncounter.isPending || isEncounterRefetching}
          value={PaymentVariant.selfPay}
          control={<Radio />}
          label="Self-pay"
        />
      </RadioGroup>
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
