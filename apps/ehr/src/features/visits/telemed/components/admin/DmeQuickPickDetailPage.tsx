import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Chip, CircularProgress, IconButton, Stack, Typography, useTheme } from '@mui/material';
import React, { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row } from 'src/components/layout/Row';
import { Section } from 'src/components/layout/Section';
import {
  DME_LATERALITY_LABELS,
  DME_MODIFIER_LABELS,
  formatDmeBillingCode,
  formatDmeDuration,
} from 'utils/lib/types/api/dme.types';
import { useDmeQuickPicksQuery } from './admin.queries';

function ValueDisplay({ value }: { value: string | undefined | null }): ReactElement {
  return (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
      {value || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
    </Typography>
  );
}

function ChipList({ items }: { items: string[] }): ReactElement {
  if (items.length === 0) {
    return <ValueDisplay value={undefined} />;
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {items.map((item) => (
        <Chip key={item} label={item} size="small" variant="outlined" />
      ))}
    </Box>
  );
}

export default function DmeQuickPickDetailPage(): ReactElement {
  const { quickPickId } = useParams<{ quickPickId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const { data: quickPicks = [], isLoading } = useDmeQuickPicksQuery();
  const quickPick = quickPicks.find((qp) => qp.id === quickPickId);

  if (isLoading) {
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

  const { thirdParty } = quickPick;
  const showThirdParty = quickPick.external || !!(thirdParty && Object.values(thirdParty).some(Boolean));

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton
          onClick={() => navigate('/admin/quick-picks/dme')}
          size="small"
          aria-label="Back to DME quick picks"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" color={theme.palette.primary.dark}>
          {quickPick.name}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Section title="DME">
          <Row label="Name">
            <ValueDisplay value={quickPick.itemName} />
          </Row>
          <Row label="CPT / HCPCS Codes">
            <ChipList items={(quickPick.billingCodes ?? []).map(formatDmeBillingCode)} />
          </Row>
        </Section>

        <Section title="Order Details">
          <Row label="Quantity Dispensed">
            <ValueDisplay value={quickPick.quantity?.toString()} />
          </Row>
          <Row label="Laterality">
            <ValueDisplay value={quickPick.laterality && DME_LATERALITY_LABELS[quickPick.laterality]} />
          </Row>
          <Row label="Modifiers">
            <ValueDisplay value={quickPick.modifier && DME_MODIFIER_LABELS[quickPick.modifier]} />
          </Row>
          <Row label="Duration of use">
            <ValueDisplay value={formatDmeDuration(quickPick.duration)} />
          </Row>
          <Row label="Instructions">
            <ValueDisplay value={quickPick.instructions} />
          </Row>
          <Row label="Fulfilled by">
            <ValueDisplay value={quickPick.external ? 'External Site / Third Party' : 'In-house'} />
          </Row>
        </Section>

        {showThirdParty && (
          <Section title="Third Party Information">
            <Row label="Clinic name">
              <ValueDisplay value={thirdParty?.name} />
            </Row>
            <Row label="Address">
              <ValueDisplay value={thirdParty?.address} />
            </Row>
            <Row label="Phone">
              <ValueDisplay value={thirdParty?.phone} />
            </Row>
            <Row label="Fax">
              <ValueDisplay value={thirdParty?.fax} />
            </Row>
          </Section>
        )}
      </Stack>
    </Box>
  );
}
