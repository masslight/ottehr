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

interface CardPaymentDTO {
  paymentMethod: 'card';
  amountInCents: number;
  dateISO: string;
  maskedCardNumber: string;
  stripePaymentId: string;
  stripePaymentMethodId: string;
  description?: string;
}

interface CashPaymentDTO {
  paymentMethod: 'cash' | 'check';
  amountInCents: number;
  dateISO: string;
  fhirPaymentNotificationId: string;
  description?: string;
}

export type PatientPaymentDTO = CardPaymentDTO | CashPaymentDTO;

export interface PaymentListProps {
  patient: Patient;
  appointmentId: string;
  loading?: boolean;
}

const idForPaymentDTO = (payment: PatientPaymentDTO): string => {
  if (payment.paymentMethod === 'card') {
    return payment.stripePaymentId;
  } else {
    return payment.fhirPaymentNotificationId;
  }
};

const dummyPaymentList: PatientPaymentDTO[] = [
  { paymentMethod: 'cash', amountInCents: 1000, dateISO: '2023-10-01T12:00:00Z', fhirPaymentNotificationId: '1' },
  {
    paymentMethod: 'card',
    amountInCents: 500,
    dateISO: '2023-10-01T12:00:00Z',
    maskedCardNumber: 'xxxx xxxx xxxx 1234',
    stripePaymentId: 'stripe1',
    stripePaymentMethodId: 'pm_1',
  },
  { paymentMethod: 'cash', amountInCents: 3000, dateISO: '2023-10-02T12:00:00Z', fhirPaymentNotificationId: '3' },
  { paymentMethod: 'check', amountInCents: 2500, dateISO: '2023-10-02T12:00:00Z', fhirPaymentNotificationId: '4' },
];

const getLabelForPayment = (payment: PatientPaymentDTO): string => {
  if (payment.paymentMethod === 'card') {
    return payment.maskedCardNumber;
  } else {
    return capitalize(payment.paymentMethod);
  }
};

export default function PatientPaymentList({ loading, patient }: PaymentListProps): ReactElement {
  const theme = useTheme();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const payments = dummyPaymentList; // Replace with actual payments when available

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
      <PaymentDialog open={paymentDialogOpen} patient={patient} handleClose={() => setPaymentDialogOpen(false)} />
    </Paper>
  );
}
