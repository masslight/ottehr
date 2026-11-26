import { Close as CloseIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';

interface SplitClaimDialogProps {
  open: boolean;
  claim: ClaimDetailResponse;
  onClose: () => void;
  // Splits the given service line sequences off into a new claim.
  onSplit: (itemSequences: number[]) => Promise<void>;
}

const payerLabel = (name: string, id: string, memberId?: string): string =>
  [name || id, id && name ? `(${id})` : '', memberId ? `· Member ${memberId}` : ''].filter(Boolean).join(' ');

export function SplitClaimDialog({ open, claim, onClose, onSplit }: SplitClaimDialogProps): ReactElement {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setError(null);
    }
  }, [open]);

  const lines = claim.serviceLines;
  const diagnosisCode = (pointer: number): string =>
    claim.diagnoses.find((dx) => dx.sequence === pointer)?.code ?? `#${pointer}`;
  const otherInsurance = [
    payerLabel(claim.secondaryPayerName, claim.secondaryPayerId, claim.secondaryMemberId),
    payerLabel(claim.tertiaryPayerName, claim.tertiaryPayerId, claim.tertiaryMemberId),
    payerLabel(claim.quaternaryPayerName, claim.quaternaryPayerId, claim.quaternaryMemberId),
  ].filter(Boolean);

  const allSelected = selected.size === lines.length;
  const canSplit = selected.size > 0 && !allSelected && !splitting;

  const toggle = (sequence: number): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sequence)) next.delete(sequence);
      else next.add(sequence);
      return next;
    });

  const handleSplit = async (): Promise<void> => {
    setSplitting(true);
    setError(null);
    try {
      await onSplit([...selected].sort((a, b) => a - b));
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to split the claim' }));
    } finally {
      setSplitting(false);
    }
  };

  const properties: [string, string][] = [
    ['Patient', claim.patientName],
    ['DOB', claim.patientDob],
    ['Date of service', claim.dos],
    ['Rendering provider', claim.renderingProvider],
    ['Service facility', claim.serviceFacility],
    ['Primary insurance', payerLabel(claim.payerName, claim.payerId, claim.memberId)],
    ['Other insurance', otherInsurance.join('\n')],
  ];

  return (
    <Dialog open={open} onClose={splitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" color="primary.dark">
          Split the Claim
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={splitting} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Selected service lines will be split off into a separate claim, retaining all the attributes of the original
          claim.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            columnGap: 3,
            rowGap: 1.25,
            mb: 2.5,
          }}
        >
          {properties.map(([label, value]) => (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {value || '—'}
              </Typography>
            </Box>
          ))}
        </Box>

        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>CPT</TableCell>
                <TableCell>Modifiers</TableCell>
                <TableCell>Diagnoses</TableCell>
                <TableCell align="right">Units</TableCell>
                <TableCell align="right">Charges</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow
                  key={line.sequence}
                  hover
                  selected={selected.has(line.sequence)}
                  onClick={() => !splitting && toggle(line.sequence)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.has(line.sequence)}
                      disabled={splitting}
                      inputProps={{ 'aria-label': `Split ${line.cptCode}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {line.cptCode}
                    </Typography>
                    {line.description && (
                      <Typography variant="caption" color="text.secondary">
                        {line.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{line.modifiers.join(', ') || '—'}</TableCell>
                  <TableCell>{line.diagnosisPointers.map(diagnosisCode).join(', ') || '—'}</TableCell>
                  <TableCell align="right">{line.units}</TableCell>
                  <TableCell align="right">{formatCurrency(line.charges)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {allSelected && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            At least one service line must stay on the original claim.
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button size="small" variant="outlined" onClick={onClose} disabled={splitting}>
          Cancel
        </Button>
        <Button size="small" variant="contained" onClick={() => void handleSplit()} disabled={!canSplit}>
          {splitting ? 'Splitting...' : 'Split'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
