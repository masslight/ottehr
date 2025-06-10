import { ReactElement, Fragment, useState } from 'react';
import {
  Button,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
  useTheme,
  Box,
  capitalize,
} from '@mui/material';
import { DateTime } from 'luxon';
import PaymentDialog from './dialogs/PaymentDialog';
import { Patient } from 'fhir/r4b';
import { CashOrCardPayment, PatientPaymentDTO, PostPatientPaymentInput } from 'utils';
import { useGetPatientPaymentsList } from 'src/hooks/useGetPatientPaymentsList';
import { useMutation } from 'react-query';
import { useApiClients } from 'src/hooks/useAppClients';

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
          })
          .catch((error) => {
            console.error('Error creating new payment: ', error);
            // todo: handle error
          });
      }
    },
    retry: 0,
  });

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
        submitPayment={async (data: CashOrCardPayment) => {
          const postInput: PostPatientPaymentInput = {
            patientId: patient.id ?? '',
            encounterId,
            paymentDetails: data,
          };
          createNewPayment.mutate(postInput);
        }}
      />
    </Paper>
  );
}
