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
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Fragment, ReactElement, useEffect, useMemo, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetEncounter } from 'src/hooks/useEncounter';
import { useGetPatientPaymentsList } from 'src/hooks/useGetPatientPaymentsList';
import {
  APIError,
  CashOrCardPayment,
  getPaymentVariantFromEncounter,
  isApiError,
  PatientPaymentDTO,
  PaymentVariant,
  PostPatientPaymentInput,
  updateEncounterPaymentVariantExtension,
} from 'utils';
import PaymentDialog from './dialogs/PaymentDialog';
import { RefreshableStatusChip } from './RefreshableStatusWidget';

export interface PaymentListProps {
  patient: Patient;
  encounterId: string;
  loading?: boolean;
  patientSelectSelfPay?: boolean;
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
  patientSelectSelfPay,
}: PaymentListProps): ReactElement {
  const { oystehr } = useApiClients();
  const theme = useTheme();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const {
    data: encounter,
    refetch: refetchEncounter,
    isRefetching: isEncounterRefetching,
  } = useGetEncounter({ encounterId });

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

  const updateEncounter = useMutation({
    mutationFn: async (input: Encounter) => {
      if (oystehr && input && input.id) {
        await oystehr.fhir
          .patch<Encounter>({
            id: input.id,
            resourceType: 'Encounter',
            operations: [
              {
                op: input.extension !== undefined ? 'replace' : 'add',
                path: '/extension',
                value: input.extension,
              },
            ],
          })
          .then(async () => {
            await refetchEncounter();
          });
      }
    },
    retry: 0,
  });

  useEffect(() => {
    // if encounter does not have payment variant extension, adding default value from patient selection
    if (encounter && !isEncounterRefetching) {
      const paymentVariant = getPaymentVariantFromEncounter(encounter);
      if (paymentVariant === undefined) {
        updateEncounter.mutate(
          updateEncounterPaymentVariantExtension(
            encounter,
            patientSelectSelfPay ? PaymentVariant.selfPay : PaymentVariant.insurance
          )
        );
      }
    }
  }, [encounter, isEncounterRefetching, patientSelectSelfPay, updateEncounter]);

  const selfPayRadioButtonValue = useMemo(() => {
    if (encounter && !isEncounterRefetching) {
      return getPaymentVariantFromEncounter(encounter);
    }
    return '' as PaymentVariant;
  }, [encounter, isEncounterRefetching]);

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
        value={selfPayRadioButtonValue}
        onChange={async (e) => {
          if (encounter) {
            updateEncounter.mutate(updateEncounterPaymentVariantExtension(encounter, e.target.value as PaymentVariant));
            await refetchEncounter();
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
      <Typography variant="h5" color="primary.dark" sx={{ mt: 2 }}>
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
