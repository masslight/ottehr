import { aiIcon } from '@ehrTheme/icons';
import { AddCircleOutline, CheckCircle } from '@mui/icons-material';
import { Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { AiDisclaimerTooltip } from '../AiSection';
import { normalizeForComparison } from './useInsuranceCardExtraction';

interface InsuranceCardAiSuggestionRowProps {
  fieldKey: string;
  /** Human-readable value as printed on the card, shown in the row. */
  suggestedDisplay: string;
  /** Value written to the form on accept; null = informational only (no "+" button). */
  suggestedFormValue: unknown | null;
  /** String compared against the current form value; defaults to suggestedDisplay. */
  suggestedComparable?: string;
  /** Extracts a comparable display string from the live form value; defaults to String coercion. */
  getCurrentComparable?: (formValue: unknown) => string;
  /** Compare ignoring non-alphanumerics (member IDs: "W123-456" matches "W123456"). */
  compareAlphanumericOnly?: boolean;
}

/**
 * Inline "Oystehr AI" suggestion rendered under an insurance form field, sourced from the
 * stored insurance-card OCR extraction. Renders nothing when the extracted value matches
 * the live form value; on "+" it writes the suggested value with shouldDirty so the
 * existing SectionSaveButton commits it, then flips to the accepted (check) state.
 */
export const InsuranceCardAiSuggestionRow: FC<InsuranceCardAiSuggestionRowProps> = ({
  fieldKey,
  suggestedDisplay,
  suggestedFormValue,
  suggestedComparable,
  getCurrentComparable,
  compareAlphanumericOnly,
}) => {
  const theme = useTheme();
  const { watch, setValue } = useFormContext();
  const [accepted, setAccepted] = useState(false);
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
  const matches =
    currentComparable !== '' &&
    currentComparable === normalizeForComparison(suggestedComparable ?? suggestedDisplay, compareAlphanumericOnly);

  // Match without an accept in this session ⇒ nothing to suggest. (A just-accepted match
  // keeps rendering so the green check confirms the write; editing the field to a third
  // value naturally re-renders the row as a fresh suggestion.)
  if (matches && !accepted) {
    return null;
  }
  const showAccepted = matches && accepted;

  const handleAccept = (): void => {
    if (suggestedFormValue == null) return;
    setValue(fieldKey, suggestedFormValue, { shouldDirty: true });
    setAccepted(true);
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
          <img src={aiIcon} alt="" aria-hidden style={{ width: '16px' }} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Oystehr AI
          </Typography>
          <Typography variant="body2">
            On card: <strong>{suggestedDisplay}</strong>
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
          ) : null}
          <AiDisclaimerTooltip />
        </Box>
      </Box>
    </Box>
  );
};
