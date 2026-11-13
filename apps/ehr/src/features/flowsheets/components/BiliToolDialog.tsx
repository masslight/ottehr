import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import React, { ReactElement, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { formatGestationalAge } from 'utils/lib/helpers/vitals/birth-history.helper';
import { BirthHistoryDTO } from 'utils/lib/types/api/birth-history.types';
import { BiliToolReading, buildBiliToolUrl, defaultBiliToolReading, formatBiliToolReading } from '../biliTool';

/** BiliTool's neurotoxicity risk factors (AAP 2022), listed so the provider answers the one question it asks. */
const NEUROTOXICITY_RISK_FACTORS = [
  'Isoimmune hemolytic disease, G6PD deficiency or other hemolytic condition',
  'Sepsis or suspected sepsis',
  'Albumin < 3.0 g/dL',
  'Significant clinical instability in the previous 24 hours',
];

interface BiliToolDialogProps {
  open: boolean;
  onClose: () => void;
  birthHistory: BirthHistoryDTO;
  /** Newest first (biliToolReadings). */
  readings: BiliToolReading[];
}

/** Picks the result to send and asks about neurotoxicity risk factors, then opens BiliTool in a new tab. */
export const BiliToolDialog = ({ open, onClose, birthHistory, readings }: BiliToolDialogProps): ReactElement => {
  const [reading, setReading] = useState<BiliToolReading | undefined>(() => defaultBiliToolReading(readings));
  // Nothing pre-selected: the provider must answer before BiliTool opens.
  const [riskFactors, setRiskFactors] = useState<'Yes' | 'No'>();

  const openBiliTool = (): void => {
    if (!reading || riskFactors === undefined || birthHistory.gestationalAgeWeeks === undefined) return;
    const url = buildBiliToolUrl({
      reading,
      readings,
      gestationalWeeks: birthHistory.gestationalAgeWeeks,
      neuroRiskFactors: riskFactors === 'Yes',
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: 'primary.dark', fontWeight: 600 }}>Open in BiliTool</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>
            <Typography component="span" color="text.secondary">
              Gestational age{' '}
            </Typography>
            {formatGestationalAge(birthHistory.gestationalAgeWeeks, birthHistory.gestationalAgeDays)}
          </Typography>
          <div>
            <Typography color="text.secondary">Result to send</Typography>
            <RadioGroup
              value={reading?.time ?? ''}
              onChange={(e) => setReading(readings.find((r) => r.time === e.target.value))}
            >
              {readings.map((r) => (
                <FormControlLabel
                  key={`${r.kind}-${r.time}`}
                  value={r.time}
                  control={<Radio size="small" />}
                  label={formatBiliToolReading(r)}
                />
              ))}
            </RadioGroup>
          </div>
          <div>
            <Typography color="text.secondary">Any neurotoxicity risk factors?</Typography>
            <ul style={{ margin: '4px 0 8px', paddingLeft: 20 }}>
              {NEUROTOXICITY_RISK_FACTORS.map((factor) => (
                <li key={factor}>
                  <Typography variant="body2">{factor}</Typography>
                </li>
              ))}
            </ul>
            <RadioGroup row value={riskFactors ?? ''} onChange={(e) => setRiskFactors(e.target.value as 'Yes' | 'No')}>
              <FormControlLabel value="Yes" control={<Radio size="small" />} label="Yes" />
              <FormControlLabel value="No" control={<Radio size="small" />} label="No" />
            </RadioGroup>
          </div>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button variant="text" onClick={onClose}>
          Cancel
        </Button>
        <RoundedButton
          variant="contained"
          size="small"
          disabled={!reading || riskFactors === undefined}
          onClick={openBiliTool}
        >
          Open BiliTool
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
