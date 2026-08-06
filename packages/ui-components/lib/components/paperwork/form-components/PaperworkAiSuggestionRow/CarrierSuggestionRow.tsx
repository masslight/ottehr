import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, IconButton, List, ListItemButton, ListItemText, Popover, Typography } from '@mui/material';
import { FC, MouseEvent, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { pickFirstValueFromAnswerItem } from 'utils';
import { CarrierCandidate, normalizeForComparison } from './carrierMatching';
import { useCarrierSuggestion } from './useCarrierSuggestion';

interface CarrierSuggestionRowProps {
  linkId: string;
  ordinal: 1 | 2;
  fieldId: string;
  appointmentId: string | undefined;
}

interface CurrentCarrierReference {
  display?: string;
}

/**
 * Read-only AI suggestion for the insurance-carrier reference field. Unlike SimpleSuggestionRow,
 * a carrier match can be ambiguous — this ports the EHR's InsuranceCardAiSuggestionRow picker mode
 * (apps/ehr/.../patient/InsuranceCardAiSuggestionRow.tsx) so a payer name/ID that resolves to more
 * than one directory entry lets the patient pick, instead of guessing or showing nothing.
 */
export const CarrierSuggestionRow: FC<CarrierSuggestionRowProps> = ({ linkId, ordinal, fieldId, appointmentId }) => {
  const suggestion = useCarrierSuggestion(ordinal, fieldId, appointmentId);
  const { watch, setValue } = useFormContext();
  const [acceptedComparable, setAcceptedComparable] = useState<string | null>(null);
  const [pickerAnchorEl, setPickerAnchorEl] = useState<HTMLElement | null>(null);

  const currentRaw = watch(fieldId);
  const currentReference = pickFirstValueFromAnswerItem(currentRaw, 'reference') as CurrentCarrierReference | undefined;
  const currentComparable = normalizeForComparison(currentReference?.display);

  if (!suggestion) {
    return null;
  }

  const effectiveComparable = normalizeForComparison(acceptedComparable ?? suggestion.comparable);
  const matches = currentComparable !== '' && currentComparable === effectiveComparable;
  if (matches && acceptedComparable == null) {
    return null;
  }

  const isPickerMode = suggestion.formValue == null && suggestion.candidates != null;
  const showAccepted = matches && acceptedComparable != null;
  const candidates = suggestion.candidates ?? [];

  const writeCarrier = (valueReference: { reference: string; display: string }, comparable: string): void => {
    setValue(fieldId, { linkId, answer: [{ valueReference }] }, { shouldDirty: true });
    setAcceptedComparable(comparable);
    setPickerAnchorEl(null);
  };

  const handleAccept = (): void => {
    if (!suggestion.formValue) return;
    writeCarrier(suggestion.formValue, suggestion.comparable);
  };

  const handlePickCandidate = (candidate: CarrierCandidate): void => {
    writeCarrier(candidate.formValue, candidate.label);
  };

  const handleOpenPicker = (event: MouseEvent<HTMLElement>): void => setPickerAnchorEl(event.currentTarget);
  const handleClosePicker = (): void => setPickerAnchorEl(null);

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
        Suggested:{' '}
        {isPickerMode ? (
          <Box
            component="span"
            role="button"
            tabIndex={0}
            onClick={handleOpenPicker}
            sx={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}
          >
            {suggestion.display}
          </Box>
        ) : (
          <strong>{suggestion.display}</strong>
        )}
      </Typography>
      {showAccepted ? (
        <CheckCircleIcon fontSize="small" color="success" />
      ) : !isPickerMode ? (
        <IconButton size="small" onClick={handleAccept} aria-label="Accept suggested carrier">
          <AddCircleOutlineIcon fontSize="small" />
        </IconButton>
      ) : null}
      {isPickerMode && (
        <Popover
          open={Boolean(pickerAnchorEl)}
          anchorEl={pickerAnchorEl}
          onClose={handleClosePicker}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ paper: { sx: { maxHeight: 300, minWidth: 280, maxWidth: 400 } } }}
        >
          <Box sx={{ p: 1 }}>
            <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, fontWeight: 700 }}>
              {suggestion.pickerTitle ?? <>Matches for &ldquo;{suggestion.display}&rdquo;</>}
            </Typography>
            {candidates.length === 0 ? (
              <Typography variant="body2" sx={{ px: 1, py: 1, color: 'text.secondary' }}>
                No matches found
              </Typography>
            ) : (
              <List dense disablePadding>
                {candidates.slice(0, 15).map((candidate) => (
                  <ListItemButton
                    key={candidate.label}
                    sx={{ borderRadius: 1 }}
                    onClick={() => handlePickCandidate(candidate)}
                  >
                    <ListItemText primary={candidate.label} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        </Popover>
      )}
    </Box>
  );
};
