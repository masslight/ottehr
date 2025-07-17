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
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Fragment, ReactElement, useState } from 'react';
import { useMutation } from 'react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientPaymentsList } from 'src/hooks/useGetPatientPaymentsList';
import { APIError, CashOrCardPayment, isApiError, PatientPaymentDTO, PostPatientPaymentInput } from 'utils';
import PaymentDialog from './dialogs/PaymentDialog';

export interface PaymentListProps {
  patient: Patient;
  encounterId: string;
  loading?: boolean;
}

const idForPaymentDTO = (payment: PatientPaymentDTO): string => {
  if (payment.paymentMethod === 'card') {
    return payment.stripePaymentId;
  } else {
    return payment.fhirPaymentNotificationId ?? 'unknown-payment-id'; //todo: should get something from candid
  }
};

const getLabelForPayment = (payment: PatientPaymentDTO): string => {
  if (payment.paymentMethod === 'card') {
    return `XXXX - XXXX - XXXX - ${payment.cardLast4}`;
  } else {
    return capitalize(payment.paymentMethod);
  }
};

export default function PatientPaymentList({ loading, patient, encounterId }: PaymentListProps): ReactElement {
  const theme = useTheme();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const { data: paymentData, refetch: refetchPaymentList } = useGetPatientPaymentsList({
    patientId: patient.id ?? '',
    encounterId,
    disabled: !encounterId || !patient.id,
  });
  const payments = paymentData?.payments ?? []; // Replace with actual payments when available

  const { oystehrZambda: oystehr } = useApiClients();

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
        isSubmitting={createNewPayment.isLoading}
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
