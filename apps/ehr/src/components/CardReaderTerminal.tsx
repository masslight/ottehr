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

        setTerminalReadyStatus('Preparing payment...');

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
          throw new Error(`Terminal payment did not succeed (status: ${processedPaymentIntent.status ?? 'unknown'}).`);
        }

        const finalizeResult = await oystehrZambda.zambda.execute({
          id: 'patient-payments-terminal-finalize-payment',
          patientId,
          encounterId,
          paymentIntentId: processedPaymentIntent.id,
        });

        chooseJson<FinalizePatientPaymentTerminalResponse>(finalizeResult);
        setTerminalReadyStatus('Payment completed');
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
  }, [oystehrZambda, onTerminalConfiguredChange]);

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
          },
        });

        const discoverOptions: { simulated?: boolean; location?: string } = {
          simulated: terminalConfig.terminalSimulatorMode ?? false,
        };

        if (!terminalConfig.terminalReaderId && terminalConfig.terminalLocationId) {
          discoverOptions.location = terminalConfig.terminalLocationId;
        }

        console.log(
          `Discovering terminal readers by ${terminalConfig.terminalReaderId ? 'reader ID' : 'location/default'}`,
          JSON.stringify({ terminalConfig, discoverOptions }, null, 2)
        );
        const discoveryResult = await terminal.discoverReaders(discoverOptions);
        if (discoveryResult.error) {
          throw new Error(discoveryResult.error.message ?? 'Unable to discover terminal readers.');
        }

        console.log('Discovered readers', JSON.stringify(discoveryResult.discoveredReaders, null, 2));
        console.log(
          'Discovered reader location info',
          JSON.stringify(
            discoveryResult.discoveredReaders.map((reader) => ({
              readerId: reader.id,
              readerLabel: reader.label,
              location: reader.location,
            })),
            null,
            2
          )
        );

        if (!discoveryResult.discoveredReaders.length) {
          throw new Error('No terminal readers were discovered.');
        }

        const selectedReader = terminalConfig.terminalReaderId
          ? discoveryResult.discoveredReaders.find((reader) => reader.id === terminalConfig.terminalReaderId)
          : discoveryResult.discoveredReaders[0];

        if (!selectedReader) {
          throw new Error(
            `Configured terminal reader ${terminalConfig.terminalReaderId} was not found during discovery.`
          );
        }

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
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="4" width="28" height="48" rx="5" fill="#D9D9D9" stroke="#90A4AE" strokeWidth="2" />
            <rect x="19" y="11" width="18" height="5" rx="1.5" fill="#B0BEC5" />
            <rect x="19" y="20" width="18" height="10" rx="2" fill="#ECEFF1" />
            <circle cx="28" cy="39" r="5" fill={readerConnected ? '#4CAF50' : '#B0BEC5'} />
            <path d="M21 46h14" stroke="#90A4AE" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <Typography variant="caption" color="text.secondary">
            {terminalInitializationError ?? (terminalInitialized ? terminalReadyStatus : 'initializing terminal...')}
          </Typography>
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
