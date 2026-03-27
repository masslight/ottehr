import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { forwardRef, ReactElement, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  CancelTerminalReaderActionResponse,
  CheckPatientPaymentTerminalStatusResponse,
  chooseJson,
  FinalizePatientPaymentTerminalResponse,
  GetPatientPaymentTerminalConfigResponse,
  InitiatePatientPaymentTerminalResponse,
  TerminalReaderDTO,
} from 'utils';

type PaymentResultState =
  | { status: 'idle' }
  | { status: 'success'; amountInCents: number }
  | { status: 'failure'; reason: string };

interface CardReaderTerminalProps {
  patient: Patient;
  appointmentId: string | undefined;
  selectedCardId: string;
  handleCardSelected: (newVal: string | undefined) => void;
  error?: string;
  encounterId: string;
  onTerminalConfiguredChange?: (isConfigured: boolean) => void;
  onReaderConnectionChange?: (isConnected: boolean) => void;
}

export interface CardReaderTerminalHandle {
  processPayment: (amountInCents: number) => Promise<void>;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000;

const CardReaderTerminal = forwardRef<CardReaderTerminalHandle, CardReaderTerminalProps>(function CardReaderTerminal(
  {
    patient,
    appointmentId: _appointmentId,
    selectedCardId: _selectedCardId,
    handleCardSelected: _handleCardSelected,
    error: _error,
    encounterId,
    onTerminalConfiguredChange,
    onReaderConnectionChange,
  }: CardReaderTerminalProps,
  ref
): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [configLoading, setConfigLoading] = useState(true);
  const [terminalConfigured, setTerminalConfigured] = useState(false);
  const [readers, setReaders] = useState<TerminalReaderDTO[]>([]);
  const [selectedReaderId, setSelectedReaderId] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResultState>({ status: 'idle' });
  const [statusMessage, setStatusMessage] = useState<string>('Loading terminal configuration...');
  const pollAbortRef = useRef<AbortController | null>(null);

  const hasReaderSelected = Boolean(selectedReaderId);
  const isReady = terminalConfigured && hasReaderSelected;

  let terminalBorderColor: string;
  if (terminalConfigured) {
    if (paymentResult.status === 'failure') {
      terminalBorderColor = '#8A1538';
    } else if (isReady) {
      terminalBorderColor = '#4CAF50';
    } else {
      terminalBorderColor = 'grey.300';
    }
  } else {
    terminalBorderColor = '#757575';
  }

  useEffect(() => {
    onReaderConnectionChange?.(isReady);
  }, [isReady, onReaderConnectionChange]);

  // Load terminal config and available readers
  useEffect(() => {
    const getTerminalConfig = async (): Promise<void> => {
      try {
        if (!oystehrZambda) {
          setTerminalConfigured(false);
          onTerminalConfiguredChange?.(false);
          return;
        }

        const result = await oystehrZambda.zambda.execute({
          id: 'patient-payments-terminal-get-config',
          encounterId,
        });
        const response = chooseJson<GetPatientPaymentTerminalConfigResponse>(result);

        const isConfigured = response.terminalConfigured === true;
        setTerminalConfigured(isConfigured);
        onTerminalConfiguredChange?.(isConfigured);

        const discoveredReaders = response.readers ?? [];
        setReaders(discoveredReaders);

        // Auto-select if only one reader
        if (discoveredReaders.length === 1) {
          setSelectedReaderId(discoveredReaders[0].id);
          setStatusMessage(`${discoveredReaders[0].label ?? discoveredReaders[0].id} is ready`);
        } else if (discoveredReaders.length > 1) {
          setStatusMessage('Select a card reader');
        } else if (isConfigured) {
          setStatusMessage('No online readers found at this location');
        } else {
          setStatusMessage('No card reader configured for this office');
        }
      } catch (error) {
        console.error('Failed to load terminal config', error);
        setTerminalConfigured(false);
        onTerminalConfiguredChange?.(false);
        setStatusMessage('Failed to load terminal configuration');
      } finally {
        setConfigLoading(false);
      }
    };

    void getTerminalConfig();
  }, [encounterId, oystehrZambda, onTerminalConfiguredChange]);

  const pollPaymentStatus = useCallback(
    async (
      readerId: string,
      paymentIntentId: string,
      signal: AbortSignal
    ): Promise<CheckPatientPaymentTerminalStatusResponse> => {
      const startTime = Date.now();

      while (!signal.aborted) {
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          throw new Error('Payment timed out waiting for card reader response.');
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (signal.aborted) {
          throw new Error('Payment was cancelled.');
        }

        const result = await oystehrZambda!.zambda.execute({
          id: 'patient-payments-terminal-check-payment-status',
          encounterId,
          readerId,
          paymentIntentId,
        });
        const statusResponse = chooseJson<CheckPatientPaymentTerminalStatusResponse>(result);

        if (statusResponse.actionStatus === 'succeeded') {
          return statusResponse;
        }

        if (statusResponse.actionStatus === 'failed') {
          throw new Error(statusResponse.failureMessage ?? 'Payment failed on the terminal reader.');
        }

        // still in_progress — continue polling
      }

      throw new Error('Payment was cancelled.');
    },
    [oystehrZambda, encounterId]
  );

  useImperativeHandle(
    ref,
    () => ({
      processPayment: async (amountInCents: number): Promise<void> => {
        const patientId = patient.id;

        if (!oystehrZambda || !patientId || !encounterId) {
          throw new Error('Missing required context for terminal payment.');
        }

        if (!selectedReaderId) {
          throw new Error('No terminal reader selected.');
        }

        // Cancel any previous polling
        pollAbortRef.current?.abort();
        const abortController = new AbortController();
        pollAbortRef.current = abortController;

        setIsProcessingPayment(true);
        setPaymentResult({ status: 'idle' });
        setStatusMessage('Initiating payment on reader...');

        try {
          const selectedReader = readers.find((r) => r.id === selectedReaderId);

          // Step 1: Initiate payment — creates PaymentIntent and sends to reader
          const initiateResult = await oystehrZambda.zambda.execute({
            id: 'patient-payments-terminal-initiate-payment',
            patientId,
            encounterId,
            amountInCents,
            readerId: selectedReaderId,
            simulatedReader: selectedReader?.simulated === true,
          });

          const initiateResponse = chooseJson<InitiatePatientPaymentTerminalResponse>(initiateResult);

          setStatusMessage('Waiting for card on reader...');

          // Step 2: Poll for reader action completion
          await pollPaymentStatus(initiateResponse.readerId, initiateResponse.paymentIntentId, abortController.signal);

          setStatusMessage('Finalizing payment...');

          // Step 3: Finalize — create PaymentNotice, set default payment method, etc.
          const finalizeResult = await oystehrZambda.zambda.execute({
            id: 'patient-payments-terminal-finalize-payment',
            patientId,
            encounterId,
            paymentIntentId: initiateResponse.paymentIntentId,
          });

          chooseJson<FinalizePatientPaymentTerminalResponse>(finalizeResult);
          setPaymentResult({ status: 'success', amountInCents });
          setStatusMessage('Payment completed');
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unknown payment error';
          setPaymentResult({ status: 'failure', reason });
          setStatusMessage('Payment failed');

          // Best-effort cancel the reader action so it doesn't remain in a pending state
          try {
            const cancelResult = await oystehrZambda.zambda.execute({
              id: 'patient-payments-terminal-cancel-reader-action',
              encounterId,
              readerId: selectedReaderId,
            });
            chooseJson<CancelTerminalReaderActionResponse>(cancelResult);
          } catch {
            // Ignore cancel errors
          }

          throw error;
        } finally {
          setIsProcessingPayment(false);
          pollAbortRef.current = null;
        }
      },
    }),
    [encounterId, oystehrZambda, patient.id, selectedReaderId, readers, pollPaymentStatus]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  const handleReaderChange = (readerId: string): void => {
    setSelectedReaderId(readerId);
    const reader = readers.find((r) => r.id === readerId);
    if (reader) {
      setStatusMessage(`${reader.label ?? reader.id} is ready`);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '150px',
        backgroundColor: 'grey.300',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 2,
        textAlign: 'left',
        px: 2,
        py: 1.5,
        border: '2px solid',
        borderColor: terminalBorderColor,
      }}
    >
      {configLoading ? null : terminalConfigured ? (
        <>
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <svg width="101" height="101" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="14" y="4" width="28" height="48" rx="5" fill="#D9D9D9" stroke="#90A4AE" strokeWidth="2" />
              <rect x="19" y="10" width="18" height="13" rx="2" fill="#ECEFF1" />
              {paymentResult.status === 'success' ? (
                <path
                  d="M22 17.2L25.4 20.6L33.6 14.4"
                  stroke="#4CAF50"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {paymentResult.status === 'failure' ? (
                <>
                  <path d="M25 13.5L31 19.5" stroke="#8A1538" strokeWidth="2" strokeLinecap="round" />
                  <path d="M31 13.5L25 19.5" stroke="#8A1538" strokeWidth="2" strokeLinecap="round" />
                </>
              ) : null}
              {isProcessingPayment ? (
                <>
                  <circle cx="28" cy="39" r="4" fill="#2196F3">
                    <animate attributeName="r" values="3;6;3" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="28" cy="39" r="2.5" fill="#90CAF9" />
                </>
              ) : paymentResult.status === 'failure' ? (
                <circle cx="28" cy="39" r="7.65" fill="#8A1538" />
              ) : (
                <circle cx="28" cy="39" r="7.65" fill={isReady ? '#4CAF50' : '#B0BEC5'} />
              )}
            </svg>
          </Box>
          <Box
            sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5, flex: 1, minWidth: 0 }}
          >
            <Typography variant="body2" color="text.primary" sx={{ fontSize: '1.2rem', fontWeight: 700 }}>
              Use the terminal to complete the payment
            </Typography>
            {readers.length > 1 && !isProcessingPayment && (
              <FormControl size="small" sx={{ mt: 0.5, mb: 0.5, maxWidth: 300 }}>
                <InputLabel id="reader-select-label">Reader</InputLabel>
                <Select
                  labelId="reader-select-label"
                  value={selectedReaderId}
                  label="Reader"
                  onChange={(e) => handleReaderChange(e.target.value)}
                >
                  {readers.map((reader) => (
                    <MenuItem key={reader.id} value={reader.id}>
                      {reader.label ?? reader.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {paymentResult.status === 'success' ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.14rem' }}>
                Charged{' '}
                <Box component="span" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                  {formatCurrencyFromCents(paymentResult.amountInCents)}
                </Box>{' '}
                successfully!
              </Typography>
            ) : paymentResult.status === 'failure' ? (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4, fontSize: '1.14rem' }}>
                <Box component="span" sx={{ color: '#8A1538', fontWeight: 600 }}>
                  Payment failed
                </Box>
                <br />
                {paymentResult.reason}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.14rem' }}>
                {statusMessage}
              </Typography>
            )}
          </Box>
        </>
      ) : (
        <>
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <svg width="58" height="58" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="12" width="36" height="24" rx="4" stroke="#bbb" strokeWidth="2.5" fill="#e8e8e8" />
              <rect x="6" y="19" width="36" height="7" fill="#bbb" />
              <rect x="10" y="29" width="8" height="3" rx="1" fill="#ccc" />
            </svg>
          </Box>
          <Box
            sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5, flex: 1, minWidth: 0 }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.2rem' }}>
              Record a payment from an external card reader
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.14rem' }}>
              no card reader configured for this office
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
});

CardReaderTerminal.displayName = 'CardReaderTerminal';

export default CardReaderTerminal;

const formatCurrencyFromCents = (amountInCents: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountInCents / 100);
};
