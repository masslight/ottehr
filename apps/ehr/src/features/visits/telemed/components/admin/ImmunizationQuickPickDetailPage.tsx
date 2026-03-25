import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, CircularProgress, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getImmunizationQuickPicks } from 'src/api/api';
import { Row } from 'src/components/layout/Row';
import { Section } from 'src/components/layout/Section';
import { useApiClients } from 'src/hooks/useAppClients';
import { ImmunizationQuickPickData } from 'utils';

function ValueDisplay({ value }: { value: string | undefined | null }): ReactElement {
  return (
    <Typography variant="body2">{value || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}</Typography>
  );
}

export default function ImmunizationQuickPickDetailPage(): ReactElement {
  const { quickPickId } = useParams<{ quickPickId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const [quickPick, setQuickPick] = useState<ImmunizationQuickPickData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuickPick = useCallback(async () => {
    if (!oystehrZambda || !quickPickId) return;
    setLoading(true);
    try {
      const response = await getImmunizationQuickPicks(oystehrZambda);
      const found = response.quickPicks.find((qp) => qp.id === quickPickId);
      if (found) {
        setQuickPick(found);
      } else {
        enqueueSnackbar('Quick pick not found', { variant: 'error' });
        navigate('/admin/quick-picks');
      }
    } catch (error) {
      console.error('Failed to load quick pick:', error);
      enqueueSnackbar('Failed to load quick pick details', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, quickPickId, navigate]);

  useEffect(() => {
    void fetchQuickPick();
  }, [fetchQuickPick]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!quickPick) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Quick pick not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/admin/quick-picks')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" color={theme.palette.primary.dark}>
          {quickPick.name}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Section title="Vaccine Information">
          <Row label="Vaccine">
            <ValueDisplay value={quickPick.vaccine?.name} />
          </Row>
          <Row label="Dose">
            <ValueDisplay value={quickPick.dose} />
          </Row>
          <Row label="Units">
            <ValueDisplay value={quickPick.units} />
          </Row>
          <Row label="Route">
            <ValueDisplay value={quickPick.route} />
          </Row>
          <Row label="Injection Site">
            <ValueDisplay value={quickPick.location?.name} />
          </Row>
          <Row label="Manufacturer">
            <ValueDisplay value={quickPick.manufacturer} />
          </Row>
        </Section>

        <Section title="Codes">
          <Row label="CVX">
            <ValueDisplay value={quickPick.cvx} />
          </Row>
          <Row label="MVX">
            <ValueDisplay value={quickPick.mvx} />
          </Row>
          <Row label="CPT">
            <ValueDisplay value={quickPick.cpt} />
          </Row>
          <Row label="NDC">
            <ValueDisplay value={quickPick.ndc} />
          </Row>
        </Section>

        <Section title="Administration Details">
          <Row label="Lot Number">
            <ValueDisplay value={quickPick.lot} />
          </Row>
          <Row label="Expiration Date">
            <ValueDisplay value={quickPick.expDate} />
          </Row>
          <Row label="Instructions">
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {quickPick.instructions || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
            </Typography>
          </Row>
        </Section>
      </Stack>
    </Box>
  );
}
