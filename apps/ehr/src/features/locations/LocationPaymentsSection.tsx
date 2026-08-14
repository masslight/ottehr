import CancelIcon from '@mui/icons-material/Cancel';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorIcon from '@mui/icons-material/Error';
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { TerminalReaderInfo } from 'src/rcm/state/payments/payments.api';
import {
  usePaymentLocationsQuery,
  useSaveTerminalLocationMutation,
  useStripeAccountInfoQuery,
  useTerminalReadersQuery,
} from 'src/rcm/state/payments/payments.queries';

// Ported from the (retired) Payment Locations detail page. This is the one thing that
// page did that Location config didn't: Stripe Connect status + terminal-reader config,
// which live on Stripe/Device resources rather than the Location. Now a section of the
// unified Location config page.

const STRIPE_ACCOUNT_ID_REGEX = /^acct_[a-zA-Z0-9]{8,}$/;
const NO_TERMINAL = '__none__';

/** Legacy values that were once stored as terminal location IDs to indicate simulation mode. */
const LEGACY_SIMULATION_VALUES = new Set(['sim', 'simulated', 'simulation']);
const isLegacySimulationValue = (id: string | undefined): boolean =>
  Boolean(id && LEGACY_SIMULATION_VALUES.has(id.toLowerCase().trim()));

const READER_STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  online: 'success',
  offline: 'default',
};

function CopyableValue({ label, value }: { label: string; value: string | undefined }): ReactElement {
  const [copied, setCopied] = useState(false);
  const handleCopy = (): void => {
    if (!value) return;
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      {value ? (
        <Tooltip title={copied ? 'Copied!' : 'Click to copy'}>
          <Typography
            variant="body2"
            onClick={handleCopy}
            sx={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
          >
            {value}
            {copied ? (
              <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            )}
          </Typography>
        </Tooltip>
      ) : (
        <Typography variant="body2" color="text.disabled">
          —
        </Typography>
      )}
    </Box>
  );
}

function ReaderStatusChip({ status }: { status: string | null }): ReactElement {
  const label = status || 'unknown';
  const color = READER_STATUS_COLORS[label] ?? 'default';
  return (
    <Chip label={label} size="small" color={color} variant="outlined" sx={{ fontWeight: 500, fontSize: '0.75rem' }} />
  );
}

function ReaderCard({ reader }: { reader: TerminalReaderInfo }): ReactElement {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1, '&:last-child': { mb: 0 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {reader.label || reader.deviceType}
        </Typography>
        <ReaderStatusChip status={reader.status} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Model:
          </Typography>
          <Typography variant="caption">{reader.deviceType}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Serial:
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {reader.serialNumber || '—'}
          </Typography>
        </Box>
        {reader.ipAddress && (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              IP:
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              {reader.ipAddress}
            </Typography>
          </Box>
        )}
        {reader.deviceSwVersion && (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Software:
            </Typography>
            <Typography variant="caption">{reader.deviceSwVersion}</Typography>
          </Box>
        )}
      </Box>
      <Box sx={{ mt: 0.5 }}>
        <CopyableValue label="Reader ID" value={reader.id} />
      </Box>
    </Paper>
  );
}

function SelectedTerminalLocationDetails({
  stripeAccountId,
  terminalLocationId,
  terminalLocations,
  terminalDeviceId,
}: {
  stripeAccountId: string;
  terminalLocationId: string | undefined;
  terminalLocations: { id: string; displayName: string | null; address: Record<string, string | null> | null }[];
  terminalDeviceId: string | undefined;
}): ReactElement | null {
  const isRealLocation = Boolean(terminalLocationId) && !isLegacySimulationValue(terminalLocationId);
  const selectedLoc = isRealLocation ? terminalLocations.find((l) => l.id === terminalLocationId) : null;

  const { data: readersData, isLoading: readersLoading } = useTerminalReadersQuery(
    isRealLocation ? stripeAccountId : undefined,
    isRealLocation ? terminalLocationId : undefined
  );

  if (!terminalLocationId || isLegacySimulationValue(terminalLocationId)) {
    return null;
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      {selectedLoc && (
        <Box sx={{ mb: 1 }}>
          <CopyableValue label="Location ID" value={selectedLoc.id} />
          {terminalDeviceId && <CopyableValue label="Oystehr Device ID" value={terminalDeviceId} />}
          {selectedLoc.address && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
                Address
              </Typography>
              <Typography variant="body2">
                {[
                  selectedLoc.address.line1,
                  selectedLoc.address.line2,
                  selectedLoc.address.city,
                  selectedLoc.address.state,
                  selectedLoc.address.postalCode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Readers
          </Typography>
          {readersLoading && <CircularProgress size={14} />}
          {readersData?.readers && (
            <Typography variant="caption" color="text.secondary">
              ({readersData.readers.length})
            </Typography>
          )}
        </Box>

        {readersData?.error && (
          <Typography variant="body2" color="error.main">
            {readersData.error}
          </Typography>
        )}

        {readersData?.readers && readersData.readers.length === 0 && !readersData.error && (
          <Typography variant="body2" color="text.disabled">
            No readers registered at this location.
          </Typography>
        )}

        {readersData?.readers &&
          readersData.readers.map((reader: TerminalReaderInfo) => <ReaderCard key={reader.id} reader={reader} />)}
      </Box>
    </Box>
  );
}

function StripeConnectSection({
  locationId,
  stripeAccountId,
  stripeTerminalLocationId,
  terminalDeviceId,
}: {
  locationId: string;
  stripeAccountId: string;
  stripeTerminalLocationId: string | undefined;
  terminalDeviceId: string | undefined;
}): ReactElement {
  const isValidFormat = STRIPE_ACCOUNT_ID_REGEX.test(stripeAccountId);
  const { data, isLoading, isError } = useStripeAccountInfoQuery(isValidFormat ? stripeAccountId : undefined);
  const saveMutation = useSaveTerminalLocationMutation();

  const hasError = !isValidFormat || isError || data?.error;
  const isConnected = isValidFormat && data?.accountInfo && !data?.error;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Stripe Connect
        </Typography>
        {isLoading && <CircularProgress size={16} />}
        {isConnected && (
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            label="Stripe Account Connected"
            size="small"
            sx={{
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              fontWeight: 500,
              '& .MuiChip-icon': { color: '#2e7d32' },
            }}
          />
        )}
        {hasError && (
          <Chip
            icon={<ErrorIcon sx={{ fontSize: 16 }} />}
            label={!isValidFormat ? 'Invalid Account ID Format' : data?.error || 'Connection Error'}
            size="small"
            color="error"
            variant="outlined"
            sx={{ fontWeight: 500 }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <CopyableValue label="Account ID" value={stripeAccountId} />
        {!isValidFormat && (
          <Tooltip title="Account ID does not appear to be a valid Stripe account ID">
            <CancelIcon sx={{ fontSize: 16, color: 'error.main', ml: -0.5 }} />
          </Tooltip>
        )}
      </Box>
      <CopyableValue label="Terminal Location ID" value={stripeTerminalLocationId} />

      {isConnected && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          {data.accountInfo?.businessName && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
                Business Name
              </Typography>
              <Typography variant="body2">{data.accountInfo.businessName}</Typography>
            </Box>
          )}
          {data.accountInfo?.dbaName && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
                DBA Name
              </Typography>
              <Typography variant="body2">{data.accountInfo.dbaName}</Typography>
            </Box>
          )}
          {data.accountInfo?.taxId && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
                Tax ID
              </Typography>
              <Typography variant="body2">{data.accountInfo.taxId}</Typography>
            </Box>
          )}
          {data.accountInfo?.address && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
                Address
              </Typography>
              <Typography variant="body2">
                {[
                  data.accountInfo.address.line1,
                  data.accountInfo.address.line2,
                  data.accountInfo.address.city,
                  data.accountInfo.address.state,
                  data.accountInfo.address.postalCode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mt: 1.5,
              pt: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
              Terminal Location
            </Typography>
            <FormControl size="small" sx={{ minWidth: 300 }}>
              <Select
                value={
                  !stripeTerminalLocationId || isLegacySimulationValue(stripeTerminalLocationId)
                    ? NO_TERMINAL
                    : stripeTerminalLocationId
                }
                onChange={(e: SelectChangeEvent) => {
                  const value = e.target.value;
                  saveMutation.mutate({ locationId, terminalLocationId: value === NO_TERMINAL ? null : value });
                }}
                disabled={saveMutation.isPending}
                renderValue={(selected) => {
                  if (selected === NO_TERMINAL) return 'No Terminal Location';
                  const loc = data?.terminalLocations?.find((l) => l.id === selected);
                  return loc?.displayName || 'Unnamed';
                }}
              >
                <MenuItem value={NO_TERMINAL}>
                  <ListItemText primary="No Terminal Location" secondary="Remove terminal location" />
                </MenuItem>
                {data?.terminalLocations?.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    <ListItemText
                      primary={loc.displayName || 'Unnamed'}
                      secondary={
                        loc.address
                          ? [loc.address.line1, loc.address.city, loc.address.state].filter(Boolean).join(', ')
                          : loc.id
                      }
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {saveMutation.isPending && <CircularProgress size={16} />}
          </Box>

          <SelectedTerminalLocationDetails
            stripeAccountId={stripeAccountId}
            terminalLocationId={stripeTerminalLocationId}
            terminalLocations={data?.terminalLocations ?? []}
            terminalDeviceId={terminalDeviceId}
          />
        </Box>
      )}
    </Paper>
  );
}

/**
 * Stripe Connect status + terminal-reader configuration for a Location. `stripeAccountId`
 * is the PERSISTED value (edited via the account-ID field above and saved); terminal
 * data is looked up per-location from the payment-locations query.
 */
export default function LocationPaymentsSection({
  locationId,
  stripeAccountId,
}: {
  locationId: string;
  stripeAccountId: string | undefined;
}): ReactElement {
  const { data: paymentLocations } = usePaymentLocationsQuery();
  const entry = paymentLocations?.find((pl) => pl.location.id === locationId);

  if (!stripeAccountId) {
    return (
      <Typography variant="body2" color="text.disabled">
        Set (and save) a Stripe Account ID above to view connection status and terminal readers.
      </Typography>
    );
  }

  return (
    <StripeConnectSection
      locationId={locationId}
      stripeAccountId={stripeAccountId}
      stripeTerminalLocationId={entry?.stripeTerminalLocationId}
      terminalDeviceId={entry?.terminalDeviceId}
    />
  );
}
