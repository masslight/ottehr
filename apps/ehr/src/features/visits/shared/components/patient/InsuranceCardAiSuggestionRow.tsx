import { aiIcon } from '@ehrTheme/icons';
import { AddCircleOutline, CheckCircle } from '@mui/icons-material';
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, MouseEvent, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { AiDisclaimerTooltip } from '../AiSection';
import { normalizeForComparison } from './useInsuranceCardExtraction';

interface SuggestionCandidate {
  /** Label shown in the picker; also what the live form value is compared against after a pick. */
  label: string;
  /** Value written to the form when this candidate is picked. */
  formValue: unknown;
}

interface InsuranceCardAiSuggestionRowProps {
  fieldKey: string;
  /** Human-readable value as printed on the card, shown in the row. */
  suggestedDisplay: string;
  /** Value written to the form on accept; null = no one-click accept ("+" button). */
  suggestedFormValue: unknown | null;
  /** String compared against the current form value; defaults to suggestedDisplay. */
  suggestedComparable?: string;
  /**
   * Ranked candidates when the extracted value could not be uniquely resolved. When provided
   * (and there is no one-click formValue), the card value renders as a clickable highlighted
   * term that opens a "Matches for …" picker (mirrors AiSuggestion); picking a candidate
   * writes its formValue. An empty list shows the picker's "No matches found" state.
   */
  candidates?: SuggestionCandidate[];
  /** Picker popover title; defaults to `Matches for "<suggestedDisplay>"`. */
  pickerTitle?: string;
  /** Extracts a comparable display string from the live form value; defaults to String coercion. */
  getCurrentComparable?: (formValue: unknown) => string;
  /** Compare ignoring non-alphanumerics (member IDs: "W123-456" matches "W123456"). */
  compareAlphanumericOnly?: boolean;
}

/**
 * Inline Oystehr-AI suggestion (icon-only badge) rendered under an insurance form field,
 * aligned beneath the field's input (value) column, sourced from the stored insurance-card
 * OCR extraction. Renders nothing when the extracted
 * value matches the live form value. Two accept affordances:
 * - "+" (suggestedFormValue set): writes the suggested value with shouldDirty so the
 *   existing SectionSaveButton commits it, then flips to the accepted (check) state.
 * - candidate picker (candidates set): the highlighted card value — and a matching "+" for
 *   visual consistency with one-click rows — opens a Popover of ranked matches; picking one
 *   writes that candidate's formValue and flips to the accepted state.
 */
export const InsuranceCardAiSuggestionRow: FC<InsuranceCardAiSuggestionRowProps> = ({
  fieldKey,
  suggestedDisplay,
  suggestedFormValue,
  suggestedComparable,
  candidates,
  pickerTitle,
  getCurrentComparable,
  compareAlphanumericOnly,
}) => {
  const theme = useTheme();
  const { watch, setValue } = useFormContext();
  // Comparable of whatever was accepted this session (null = nothing accepted yet). For "+"
  // that is the suggestion itself; for the picker it is the picked candidate's label.
  const [acceptedComparable, setAcceptedComparable] = useState<string | null>(null);
  const [pickerAnchorEl, setPickerAnchorEl] = useState<HTMLElement | null>(null);
  const currentFormValue = watch(fieldKey);

  if (!suggestedDisplay) {
    return null;
  }

  const currentComparable = normalizeForComparison(
    getCurrentComparable
      ? getCurrentComparable(currentFormValue)
      : currentFormValue == null
      ? ''
      : String(currentFormValue),
    compareAlphanumericOnly
  );
  const effectiveComparable = acceptedComparable ?? suggestedComparable ?? suggestedDisplay;
  const matches =
    currentComparable !== '' &&
    currentComparable === normalizeForComparison(effectiveComparable, compareAlphanumericOnly);

  // Match without an accept in this session ⇒ nothing to suggest. (A just-accepted match
  // keeps rendering so the green check confirms the write; editing the field to a third
  // value naturally re-renders the row as a fresh suggestion.)
  if (matches && acceptedComparable == null) {
    return null;
  }
  const showAccepted = matches && acceptedComparable != null;
  const isPickerMode = suggestedFormValue == null && candidates != null;

  const handleAccept = (): void => {
    if (suggestedFormValue == null) return;
    setValue(fieldKey, suggestedFormValue, { shouldDirty: true });
    setAcceptedComparable(suggestedComparable ?? suggestedDisplay);
  };

  const handleOpenPicker = (event: MouseEvent<HTMLElement>): void => {
    setPickerAnchorEl(event.currentTarget);
  };

  const handleClosePicker = (): void => {
    setPickerAnchorEl(null);
  };

  const handlePickCandidate = (candidate: SuggestionCandidate): void => {
    setValue(fieldKey, candidate.formValue, { shouldDirty: true });
    setAcceptedComparable(candidate.label);
    setPickerAnchorEl(null);
  };

  return (
    // Mirror the form's Row layout (30% label / 70% input + 5px gap) so the suggestion
    // aligns under the input column of the field it refers to.
    <Box
      data-testid={`insurance-card-ai-suggestion-${fieldKey}`}
      sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}
    >
      <Box sx={{ flex: '0 1 30%' }} />
      <Box sx={{ flex: '1 1 70%' }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            background: '#E1F5FECC',
            borderRadius: '8px',
            padding: '2px 8px',
          }}
        >
          <img src={aiIcon} alt="Oystehr AI" style={{ width: '16px' }} />
          <Typography variant="body2">
            {isPickerMode && !showAccepted ? (
              <Box
                component="strong"
                role="button"
                tabIndex={0}
                aria-label={`Find matches for ${suggestedDisplay}`}
                data-testid={`insurance-card-ai-suggestion-${fieldKey}-picker`}
                onClick={handleOpenPicker}
                sx={{
                  backgroundColor: 'rgba(25, 118, 210, 0.15)',
                  borderRadius: '3px',
                  padding: '1px 2px',
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.3)' },
                }}
              >
                {suggestedDisplay}
              </Box>
            ) : (
              <strong>{suggestedDisplay}</strong>
            )}
          </Typography>
          {showAccepted ? (
            <CheckCircle
              data-testid={`insurance-card-ai-suggestion-${fieldKey}-accepted`}
              sx={{ fontSize: 16, color: 'success.main', ml: 0.25 }}
            />
          ) : suggestedFormValue != null ? (
            <Tooltip title="Use value from card">
              <IconButton
                size="small"
                aria-label="Use value from card"
                onClick={handleAccept}
                sx={{ padding: '2px', color: theme.palette.primary.main }}
              >
                <AddCircleOutline sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : isPickerMode ? (
            // Picker rows get the same "+" as one-click rows; it opens the matches popover.
            <Tooltip title="Find matches">
              <IconButton
                size="small"
                aria-label="Find matches"
                onClick={handleOpenPicker}
                sx={{ padding: '2px', color: theme.palette.primary.main }}
              >
                <AddCircleOutline sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : null}
          <AiDisclaimerTooltip />
        </Box>
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
                {pickerTitle ?? <>Matches for &ldquo;{suggestedDisplay}&rdquo;</>}
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
    </Box>
  );
};
