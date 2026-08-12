import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { pickFirstValueFromAnswerItem } from 'utils';
import { useSuggestedFieldValue } from './useSuggestedFieldValue';

interface SimpleSuggestionRowProps {
  linkId: string;
  fieldId: string;
  appointmentId: string | undefined;
}

const normalize = (value: string): string => value.trim().toLowerCase();

/**
 * Read-only AI suggestion chip for a plain-text paperwork field, sourced from OCR run on a card
 * image the patient just uploaded (see get-insurance-card-suggestions / get-photo-id-suggestions).
 * Mirrors the EHR's InsuranceCardAiSuggestionRow UX (a chip with a one-click accept, hidden once
 * the field already matches), adapted to intake's {linkId, answer} RHF value shape instead of a
 * flat scalar.
 */
export const SimpleSuggestionRow: FC<SimpleSuggestionRowProps> = ({ linkId, fieldId, appointmentId }) => {
  const suggested = useSuggestedFieldValue(linkId, appointmentId);
  const { watch, setValue } = useFormContext();
  const [accepted, setAccepted] = useState(false);

  const currentRaw = watch(fieldId);
  const current = pickFirstValueFromAnswerItem(currentRaw) ?? '';
  const matches = current !== '' && suggested != null && normalize(current) === normalize(suggested);

  if (!suggested || (matches && !accepted)) {
    return null;
  }

  const handleAccept = (): void => {
    setValue(fieldId, { linkId, answer: [{ valueString: suggested }] }, { shouldDirty: true });
    setAccepted(true);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        backgroundColor: '#E1F5FECC',
        borderRadius: '8px',
        px: 1.5,
        py: 0.5,
        mt: 0.5,
        width: 'fit-content',
      }}
    >
      <Typography variant="body2">
        Suggested: <strong>{suggested}</strong>
      </Typography>
      {matches && accepted ? (
        <CheckCircleIcon fontSize="small" color="success" />
      ) : (
        <Tooltip title="Use value from card">
          <IconButton size="small" onClick={handleAccept} aria-label={`Accept suggested value for ${linkId}`}>
            <AddCircleOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
