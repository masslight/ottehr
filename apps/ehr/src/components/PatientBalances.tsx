import { otherColors } from '@ehrTheme/colors';
import { Alert, Box, CircularProgress, Paper, Snackbar, Typography } from '@mui/material';
import { QueryObserverResult, RefetchOptions, useMutation } from '@tanstack/react-query';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Fragment, ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  APIError,
  CashOrCardPayment,
  GetPatientBalancesZambdaOutput,
  isApiError,
  PostPatientPaymentInput,
} from 'utils';
import PaymentDialog from './dialogs/PaymentDialog';

export interface PaymentBalancesProps {
  patient: Patient | undefined;
  patientBalances: GetPatientBalancesZambdaOutput | undefined;
  refetchPatientBalances: (
    options?: RefetchOptions | undefined
  ) => Promise<QueryObserverResult<GetPatientBalancesZambdaOutput, Error>>;
}

export default function PatientBalances({
  patient,
  patientBalances,
  refetchPatientBalances,
}: PaymentBalancesProps): ReactElement {
  const { encounters } = patientBalances || { encounters: [] };

  // for payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const { oystehrZambda } = useApiClients();
  const createNewPayment = useMutation({
    mutationFn: async (input: PostPatientPaymentInput) => {
      if (oystehrZambda && input) {
        return oystehrZambda.zambda
          .execute({
            id: 'patient-payments-post',
            ...input,
          })
          .then(async () => {
            await refetchPatientBalances();
            setPaymentDialogOpen(false);
          });
      }
    },
    retry: 0,
  });
  const [selectedEncounter, setSelectedEncounter] = useState<{ appointmentId: string; encounterId: string }>({
    appointmentId: '',
    encounterId: '',
  });

  // for snackbar
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" color="primary.dark">
          Outstanding Balance
        </Typography>
        <Typography variant="h4" color="error.dark">
          ${((patientBalances?.totalBalanceCents ?? 0) / 100).toFixed(2)}
        </Typography>
      </Box>
      {patientBalances ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 2,
            mt: 2,
            alignItems: 'center',
            backgroundColor: 'background.default',
            p: 2,
            borderRadius: 1,
          }}
        >
          {encounters.map((encounter, index) => (
            <Fragment key={encounter.encounterId}>
              <Box sx={{ display: 'contents' }}>
                <Box
                  component={Link}
                  to={`/visit/${encounter.appointmentId}`}
                  target="_blank"
                  sx={{ color: 'primary.main', textDecoration: 'none' }}
                >
                  {encounter.appointmentId}
                </Box>
                <Box sx={{ color: 'text.primary' }}>
                  {DateTime.fromISO(encounter.encounterDate).toFormat('MM/dd/yyyy')}
                </Box>
                <Box
                  sx={{
                    color: 'text.primary',
                    fontWeight: 'bold',
                    textAlign: 'right',
                  }}
                >{`$${(encounter.patientBalanceCents / 100).toFixed(2)}`}</Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <RoundedButton
                    onClick={() => {
                      setPaymentDialogOpen(true);
                      setSelectedEncounter({
                        appointmentId: encounter.appointmentId,
                        encounterId: encounter.encounterId,
                      });
                    }}
                  >
                    Pay for visit
                  </RoundedButton>
                </Box>
                {index !== encounters.length - 1 && (
                  <Box
                    sx={{
                      gridColumn: '1 / -1',
                      borderBottom: `1px solid ${otherColors.dottedLine}`,
                    }}
                  />
                )}
              </Box>
            </Fragment>
          ))}
        </Box>
      ) : (
        <CircularProgress />
      )}
      {patient && (
        <PaymentDialog
          open={paymentDialogOpen}
          patient={patient}
          appointmentId={selectedEncounter.appointmentId}
          handleClose={() => setPaymentDialogOpen(false)}
          isSubmitting={createNewPayment.isPending}
          submitPayment={async (data: CashOrCardPayment) => {
            const postInput: PostPatientPaymentInput = {
              patientId: patient.id ?? '',
              encounterId: selectedEncounter.encounterId,
              paymentDetails: data,
            };
            await createNewPayment.mutateAsync(postInput);
          }}
        />
      )}
      <Snackbar open={errorMessage !== null} autoHideDuration={6000} onClose={() => createNewPayment.reset()}>
        <Alert severity="error" onClose={() => createNewPayment.reset()} sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
