import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Alert, Box, CircularProgress, IconButton, Typography } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAddressString } from 'utils/lib/fhir/helpers';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingPayerOption } from 'utils/lib/types/data/billing/billing.types';
import { searchBillingPayers } from '../api/api';
import { ReadOnlySection } from '../components/ReadOnlySection';
import { Row } from '../components/Row';
import { useApiClients } from '../hooks/useAppClients';

export function PayerDetail(): ReactElement {
  const { payerId } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [payer, setPayer] = useState<BillingPayerOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!oystehrZambda || !payerId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setPayer(null);
    const fetchDetail = async (): Promise<void> => {
      try {
        const data = await searchBillingPayers(oystehrZambda, { payerId });
        if (active) setPayer(data.payers[0] ?? null);
      } catch (err) {
        if (active) setError(getApiError({ error: err, defaultError: 'Failed to load payer' }));
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchDetail();
    return () => {
      active = false;
    };
  }, [oystehrZambda, payerId]);

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton
          aria-label="Back to Insurance Organizations"
          onClick={() => navigate('/insurance-organizations')}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary.dark" fontWeight={600}>
          {payer?.name ?? 'Payer Details'}
        </Typography>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      ) : error || !payer ? (
        <Alert severity="error">{error ?? 'Payer not found'}</Alert>
      ) : (
        <ReadOnlySection title="Payer Details">
          <Row label="Payer ID" value={payer.payerId} />
          <Row label="Alternate Names" value={payer.alternateNames?.join(', ') || 'None available'} />
          <Row label="Alternate Payer IDs" value={payer.alternatePayerIds?.join(', ') || 'None available'} />
          <Row
            label="Mailing Address"
            value={payer.addresses?.map(getAddressString).filter(Boolean).join('; ') || 'Not available'}
            hideBorder
          />
        </ReadOnlySection>
      )}
    </Box>
  );
}
