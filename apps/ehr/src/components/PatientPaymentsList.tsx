import {
  Alert,
  Box,
  Button,
  capitalize,
  Paper,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Fragment, ReactElement, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientPaymentsList } from 'src/hooks/useGetPatientPaymentsList';
import { APIError, CashOrCardPayment, isApiError, PatientPaymentDTO, PostPatientPaymentInput } from 'utils';
import PaymentDialog from './dialogs/PaymentDialog';
import { RefreshableStatusChip } from './RefreshableStatusWidget';

export interface PaymentListProps {
  patient: Patient;
  encounterId: string;
  loading?: boolean;
}

const idForPaymentDTO = (payment: PatientPaymentDTO): string => {
  if (payment.paymentMethod === 'card') {
    return payment.fhirPaymentNotificationId;
  } else {
    return payment.fhirPaymentNotificationId ?? 'unknown-payment-id'; //todo: should get something from candid
  }
};

export default function PatientPaymentList({ loading, patient, encounterId }: PaymentListProps): ReactElement {
  const theme = useTheme();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const {
    data: paymentData,
    refetch: refetchPaymentList,
    isRefetching,
  } = useGetPatientPaymentsList({
    patientId: patient.id ?? '',
    encounterId,
    disabled: !encounterId || !patient.id,
  });
  const payments = paymentData?.payments ?? []; // Replace with actual payments when available

  const { oystehrZambda: oystehr } = useApiClients();

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
      if (oystehr && input) {
        return oystehr.zambda
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
        Patient Payments
      </Typography>
      <Table size="small" style={{ tableLayout: 'fixed' }}>
        <TableBody>
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
          createNewPayment.mutate(postInput);
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
