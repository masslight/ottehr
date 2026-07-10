import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { useCardAutofillStore } from '../stores/useCardAutofillStore';

// Same visual language as the EHR's insurance-card AI suggestion chips (#E1F5FE), adapted
// mobile-first for intake.
const AI_CHIP_BG = '#E1F5FECC';

// Patient-facing wording (the EHR's clinician disclaimer doesn't fit an intake audience).
const AI_DISCLAIMER_TEXT =
  'This information was read from your card image automatically by AI and may contain mistakes. ' +
  'Please review it and correct anything that looks wrong.';

const AiDisclaimerInfo: FC = () => (
  <Tooltip enterTouchDelay={0} title={AI_DISCLAIMER_TEXT}>
    <IconButton size="small" aria-label="AI disclaimer" sx={{ padding: '2px' }}>
      <InfoOutlinedIcon sx={{ fontSize: '15px' }} />
    </IconButton>
  </Tooltip>
);

interface AiChipRowProps {
  children: ReactNode;
  testId: string;
  withDisclaimer?: boolean;
}

const AiChipRow: FC<AiChipRowProps> = ({ children, testId, withDisclaimer = true }) => (
  <Box
    data-testid={testId}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 0.5,
      background: AI_CHIP_BG,
      borderRadius: '8px',
      padding: '4px 8px',
      marginTop: '8px',
      maxWidth: '100%',
    }}
  >
    <AutoAwesomeIcon sx={{ fontSize: '16px', color: 'primary.main' }} />
    {children}
    {withDisclaimer && <AiDisclaimerInfo />}
  </Box>
);

/**
 * Status note rendered directly under a card capture (the card FileInputs sit at the top of
 * their pages, above the fields the engine fills):
 * - "Reading your card…" while the OCR poll for a just-uploaded image is in flight
 * - the "we filled these" banner once the engine auto-filled fields from this card (shown as
 *   long as any of those fields still carries its ✨AI badge)
 * - a gentle, non-blocking note when the image was unreadable / not a card — the patient just
 *   fills the fields manually; no retake is forced
 */
export const CardAutofillSlotNote: FC<{ slotLinkId: string }> = ({ slotLinkId }) => {
  const reading = useCardAutofillStore((state) => Boolean(state.reading[slotLinkId]));
  const failed = useCardAutofillStore((state) => Boolean(state.failed[slotLinkId]));
  const filledLinkIds = useCardAutofillStore((state) => state.filledBySlot[slotLinkId]);
  const aiFilled = useCardAutofillStore((state) => state.aiFilled);

  if (reading) {
    return (
      <Box
        data-testid={`card-autofill-reading-${slotLinkId}`}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: '8px' }}
      >
        <CircularProgress size={14} />
        <Typography variant="body2" color="text.secondary">
          Reading your card…
        </Typography>
      </Box>
    );
  }

  const anyStillBadged = (filledLinkIds ?? []).some((linkId) => aiFilled[linkId]);
  if (anyStillBadged) {
    return (
      <AiChipRow testId={`card-autofill-banner-${slotLinkId}`}>
        <Typography variant="body2">We filled these from your card — please check they&apos;re right</Typography>
      </AiChipRow>
    );
  }

  if (failed) {
    return (
      <Typography
        data-testid={`card-autofill-failed-${slotLinkId}`}
        variant="body2"
        color="text.secondary"
        sx={{ marginTop: '8px' }}
      >
        We couldn&apos;t read this card automatically — please fill in the fields below.
      </Typography>
    );
  }

  return null;
};

/**
 * Small ✨AI badge shown between a field's label and its input while the field holds a value
 * the engine auto-filled; the engine clears it as soon as the patient edits the field.
 */
export const AiFilledBadge: FC<{ linkId: string }> = ({ linkId }) => {
  const filled = useCardAutofillStore((state) => Boolean(state.aiFilled[linkId]));
  if (!filled) {
    return null;
  }
  return (
    <Box sx={{ marginBottom: '4px' }}>
      <Tooltip enterTouchDelay={0} title={AI_DISCLAIMER_TEXT}>
        <Box
          data-testid={`card-autofill-badge-${linkId}`}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            background: AI_CHIP_BG,
            borderRadius: '8px',
            padding: '1px 6px',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: '13px', color: 'primary.main' }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Filled from your card</Typography>
        </Box>
      </Tooltip>
    </Box>
  );
};

/**
 * Hint under the carrier field when the OCR'd carrier matched no payer option: surfaces the
 * name from the card and leaves the choice to the patient (never silently picks "Other").
 */
export const CarrierHintNote: FC<{ linkId: string }> = ({ linkId }) => {
  const hint = useCardAutofillStore((state) => state.carrierHint[linkId]);
  if (!hint) {
    return null;
  }
  return (
    <AiChipRow testId={`card-autofill-carrier-hint-${linkId}`}>
      <Typography variant="body2">
        From your card: <strong>{hint}</strong> — choose your insurer
      </Typography>
    </AiChipRow>
  );
};
