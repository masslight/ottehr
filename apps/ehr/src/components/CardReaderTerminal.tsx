import { Box, Typography } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { forwardRef, ReactElement, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  chooseJson,
  FinalizePatientPaymentTerminalResponse,
  GetPatientPaymentTerminalConfigResponse,
  GetPatientPaymentTerminalConnectionTokenResponse,
  InitiatePatientPaymentTerminalResponse,
} from 'utils';

interface StripeTerminalReader {
  id?: string | null;
  label?: string | null;
  device_type?: string | null;
  location?:
    | {
        display_name?: string | null;
        name?: string | null;
        id?: string | null;
      }
    | string
    | null;
}

interface StripeTerminalError {
  message?: string | null;
}

interface StripeTerminalDiscoverReadersResult {
  discoveredReaders: StripeTerminalReader[];
  error?: StripeTerminalError | null;
}

interface StripeTerminalConnectReaderResult {
  reader?: StripeTerminalReader | null;
  error?: StripeTerminalError | null;
}

interface StripeTerminalInstance {
  discoverReaders: (options: {
    simulated?: boolean;
    location?: string;
  }) => Promise<StripeTerminalDiscoverReadersResult>;
  connectReader: (reader: StripeTerminalReader) => Promise<StripeTerminalConnectReaderResult>;
  collectPaymentMethod: (clientSecret: string) => Promise<StripeTerminalProcessPaymentResult>;
  processPayment: (paymentIntent: StripeTerminalPaymentIntent) => Promise<StripeTerminalProcessPaymentResult>;
}

interface StripeTerminalPaymentIntent {
  id: string;
  status?: string | null;
}

interface StripeTerminalProcessPaymentResult {
  paymentIntent?: StripeTerminalPaymentIntent | null;
  error?: StripeTerminalError | null;
}

type PaymentResultState =
  | { status: 'idle' }
  | { status: 'success'; amountInCents: number }
  | { status: 'failure'; reason: string };

interface StripeTerminalSdk {
  create: (options: {
    onFetchConnectionToken: () => Promise<string>;
    onUnexpectedReaderDisconnect: () => void;
  }) => StripeTerminalInstance;
}

declare global {
  interface Window {
    StripeTerminal?: StripeTerminalSdk;
  }
}

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
  const [terminalConfigured, setTerminalConfigured] = useState(false);
  const [terminalConfig, setTerminalConfig] = useState<GetPatientPaymentTerminalConfigResponse | null>(null);
  const [terminalInitialized, setTerminalInitialized] = useState(false);
  const [terminalInitializationError, setTerminalInitializationError] = useState<string | null>(null);
  const [terminalReadyStatus, setTerminalReadyStatus] = useState<string>('Initializing terminal...');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResultState>({ status: 'idle' });
  const terminalRef = useRef<StripeTerminalInstance | null>(null);
  const readerConnected = terminalInitialized && !terminalInitializationError;

  useEffect(() => {
    onReaderConnectionChange?.(readerConnected);
  }, [readerConnected, onReaderConnectionChange]);

  useImperativeHandle(
    ref,
    () => ({
      processPayment: async (amountInCents: number): Promise<void> => {
        const patientId = patient.id;

        if (!oystehrZambda || !patientId || !encounterId) {
          throw new Error('Missing required context for terminal payment.');
        }

        if (!terminalRef.current || !readerConnected) {
          throw new Error('Terminal reader is not connected.');
        }

        setIsProcessingPayment(true);
        setPaymentResult({ status: 'idle' });
        setTerminalReadyStatus('Preparing payment...');

        try {
          const initiateResult = await oystehrZambda.zambda.execute({
            id: 'patient-payments-terminal-initiate-payment',
            patientId,
            encounterId,
            amountInCents,
          });

          const initiateResponse = chooseJson<InitiatePatientPaymentTerminalResponse>(initiateResult);
          const paymentIntentClientSecret = initiateResponse.paymentIntentClientSecret;

          const collectResult = await terminalRef.current.collectPaymentMethod(paymentIntentClientSecret);
          if (collectResult.error) {
            throw new Error(collectResult.error.message ?? 'Unable to collect payment method from terminal reader.');
          }

          if (!collectResult.paymentIntent) {
            throw new Error('Terminal did not return a payment intent after collecting payment method.');
          }

          setTerminalReadyStatus('Processing payment...');
          const processResult = await terminalRef.current.processPayment(collectResult.paymentIntent);
          if (processResult.error) {
            throw new Error(processResult.error.message ?? 'Unable to process payment on terminal reader.');
          }

          const processedPaymentIntent = processResult.paymentIntent;
          if (!processedPaymentIntent?.id) {
            throw new Error('Terminal did not return a processed payment intent.');
          }

          if (processedPaymentIntent.status !== 'succeeded') {
            throw new Error(
              `Terminal payment did not succeed (status: ${processedPaymentIntent.status ?? 'unknown'}).`
            );
          }

          const finalizeResult = await oystehrZambda.zambda.execute({
            id: 'patient-payments-terminal-finalize-payment',
            patientId,
            encounterId,
            paymentIntentId: processedPaymentIntent.id,
          });

          chooseJson<FinalizePatientPaymentTerminalResponse>(finalizeResult);
          setPaymentResult({ status: 'success', amountInCents });
          setTerminalReadyStatus('Payment completed');
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unknown payment error';
          setPaymentResult({ status: 'failure', reason });
          setTerminalReadyStatus('Payment failed');
          throw error;
        } finally {
          setIsProcessingPayment(false);
        }
      },
    }),
    [encounterId, oystehrZambda, patient.id, readerConnected]
  );

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
        setTerminalConfig(response);

        const isConfigured = response.terminalConfigured === true;
        setTerminalConfigured(isConfigured);
        onTerminalConfiguredChange?.(isConfigured);
      } catch (error) {
        console.error('Failed to load terminal config', error);
        setTerminalConfig(null);
        setTerminalConfigured(false);
        onTerminalConfiguredChange?.(false);
      }
    };

    void getTerminalConfig();
  }, [encounterId, oystehrZambda, onTerminalConfiguredChange]);

  useEffect(() => {
    const initializeStripeTerminal = async (): Promise<void> => {
      if (!terminalConfigured || terminalRef.current || !oystehrZambda || !terminalConfig) {
        return;
      }

      const patientId = patient.id;
      if (!patientId || !encounterId) {
        setTerminalInitialized(false);
        setTerminalInitializationError('Missing patient or encounter for terminal configuration');
        setTerminalReadyStatus('Unable to initialize terminal');
        return;
      }

      try {
        await loadStripeTerminalSdk();

        if (!window.StripeTerminal) {
          throw new Error('Terminal SDK is unavailable on window object.');
        }

        const terminal = window.StripeTerminal.create({
          onFetchConnectionToken: async (): Promise<string> => {
            const result = await oystehrZambda.zambda.execute({
              id: 'patient-payments-terminal-get-connection-token',
              patientId,
              encounterId,
            });
            const response = chooseJson<GetPatientPaymentTerminalConnectionTokenResponse>(result);
            return response.connectionToken;
          },
          onUnexpectedReaderDisconnect: () => {
            console.warn('Terminal reader unexpectedly disconnected.');
            setTerminalInitialized(false);
            setTerminalReadyStatus('Terminal disconnected');

            if (terminalRef.current) {
              // Best-effort cleanup of the disconnected reader and ref so reinitialization can occur.
              const currentTerminal = terminalRef.current as typeof window.StripeTerminal | null;
              // disconnectReader may not exist on all implementations; guard its usage.
              // Fire-and-forget; errors are logged but do not block state updates.
              const currentTerminal = terminalRef.current;
              // disconnectReader may not exist on all implementations; guard its usage.
              // Fire-and-forget; errors are logged but do not block state updates.
              if ('disconnectReader' in currentTerminal && typeof currentTerminal.disconnectReader === 'function') {
                currentTerminal.disconnectReader().catch((disconnectError: unknown) => {
                  console.error(
                    'Error while disconnecting Stripe Terminal reader after unexpected disconnect:',
                    disconnectError
                  );
                });
              }
              terminalRef.current = null;
            }
          },
        });

        const discoverOptions: { simulated?: boolean; location?: string } = {
          simulated: terminalConfig.terminalSimulatorMode ?? false,
        };

        if (terminalConfig.terminalLocationId) {
          discoverOptions.location = terminalConfig.terminalLocationId;
        }

        const discoveryResult = await terminal.discoverReaders(discoverOptions);
        if (discoveryResult.error) {
          throw new Error(discoveryResult.error.message ?? 'Unable to discover terminal readers.');
        }

        if (!discoveryResult.discoveredReaders.length) {
          throw new Error('No terminal readers were discovered.');
        }

        const selectedReader = discoveryResult.discoveredReaders[0];

        const connectResult = await terminal.connectReader(selectedReader);
        if (connectResult.error) {
          throw new Error(connectResult.error.message ?? 'Unable to connect to Stripe Terminal reader.');
        }

        const connectedReader = connectResult.reader ?? selectedReader;

        terminalRef.current = terminal;
        setTerminalInitialized(true);
        setTerminalInitializationError(null);
        setTerminalReadyStatus(buildTerminalReadyStatus(connectedReader));
      } catch (error) {
        console.error('Failed to initialize Stripe Terminal SDK', error);
        setTerminalInitialized(false);
        setTerminalInitializationError('Unable to initialize card reader terminal');
        setPaymentResult({ status: 'idle' });
        setTerminalReadyStatus('Unable to connect to card reader terminal');
      }
    };

    void initializeStripeTerminal();
  }, [oystehrZambda, terminalConfigured, terminalConfig, patient.id, encounterId]);

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '150px',
        backgroundColor: 'grey.300',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        textAlign: 'center',
        border: terminalConfigured ? '2px solid' : undefined,
        borderColor: terminalConfigured ? (readerConnected ? '#4CAF50' : 'grey.300') : undefined,
      }}
    >
      {terminalConfigured ? (
        <>
          <Typography variant="body2" color="text.primary">
            Use the terminal to complete the payment
          </Typography>
          <svg width="84" height="84" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                <path d="M23 14.5L33 19.5" stroke="#8A1538" strokeWidth="2" strokeLinecap="round" />
                <path d="M33 14.5L23 19.5" stroke="#8A1538" strokeWidth="2" strokeLinecap="round" />
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
              <circle cx="28" cy="39" r="7.65" fill={readerConnected ? '#4CAF50' : '#B0BEC5'} />
            )}
          </svg>
          {paymentResult.status === 'success' ? (
            <Typography variant="caption" color="text.secondary">
              Charged{' '}
              <Box component="span" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                {formatCurrencyFromCents(paymentResult.amountInCents)}
              </Box>{' '}
              successfully!
            </Typography>
          ) : paymentResult.status === 'failure' ? (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              <Box component="span" sx={{ color: '#8A1538', fontWeight: 600 }}>
                Payment failed
              </Box>
              <br />
              {paymentResult.reason}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {terminalInitializationError ?? (terminalInitialized ? terminalReadyStatus : 'initializing terminal...')}
            </Typography>
          )}
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            Record a payment from an external card reader
          </Typography>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="12" width="36" height="24" rx="4" stroke="#bbb" strokeWidth="2.5" fill="#e8e8e8" />
            <rect x="6" y="19" width="36" height="7" fill="#bbb" />
            <rect x="10" y="29" width="8" height="3" rx="1" fill="#ccc" />
          </svg>
          <Typography variant="caption" color="text.secondary">
            no card reader configured for this office
          </Typography>
        </>
      )}
    </Box>
  );
});

CardReaderTerminal.displayName = 'CardReaderTerminal';

export default CardReaderTerminal;

const STRIPE_TERMINAL_SDK_URL = 'https://js.stripe.com/terminal/v1/';

const loadStripeTerminalSdk = async (): Promise<void> => {
  if (window.StripeTerminal) {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-stripe-terminal-sdk="true"]');

  if (existingScript) {
    await waitForTerminalSdk();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = STRIPE_TERMINAL_SDK_URL;
    script.async = true;
    script.dataset.stripeTerminalSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe Terminal SDK script.'));
    document.head.appendChild(script);
  });

  await waitForTerminalSdk();
};

const buildTerminalReadyStatus = (reader: StripeTerminalReader): string => {
  const terminalLabel = reader.label ?? 'unlabeled';
  return `${terminalLabel} is ready`;
};

const waitForTerminalSdk = async (): Promise<void> => {
  const timeoutMs = 5000;
  const intervalMs = 50;
  let elapsed = 0;

  while (!window.StripeTerminal && elapsed < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    elapsed += intervalMs;
  }

  if (!window.StripeTerminal) {
    throw new Error('Stripe Terminal SDK did not become available.');
  }
};

const formatCurrencyFromCents = (amountInCents: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountInCents / 100);
};
