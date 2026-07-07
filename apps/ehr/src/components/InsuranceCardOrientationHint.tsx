import RotateRightIcon from '@mui/icons-material/RotateRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Chip, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { rotateInsuranceCardImage } from 'src/api/api';
import {
  CardOrdinal,
  useInsuranceCardExtraction,
} from 'src/features/visits/shared/components/patient/useInsuranceCardExtraction';
import { useApiClients } from 'src/hooks/useAppClients';

export const ROTATE_CARD_BUTTON_LABEL = 'Rotate card 90 degrees clockwise';
export const CARD_MAY_BE_ROTATED_LABEL = 'Card may be rotated';

interface InsuranceCardOrientationHintProps {
  patientId: string | undefined;
  /** Which insurance the displayed card belongs to (primary vs secondary). */
  ordinal: CardOrdinal;
  /**
   * DocumentReference.id of the DISPLAYED front-card image. The hint renders only when the
   * stored OCR orientation verdict belongs to this exact image (guards against a stale verdict
   * from a deleted/replaced card).
   */
  documentReferenceId: string | null;
  /**
   * Called after a successful rotate. The backend re-stores the image bytes at the SAME z3 url,
   * so this must refresh the displayed image — e.g. refetch the visit files so a freshly signed
   * presigned url (a new url string) bypasses the browser cache.
   */
  onRotated: () => Promise<unknown>;
}

/**
 * "Card may be rotated" hint for an insurance-card image the OCR judged not right-side-up
 * (stored extraction `readable === false`; OCR runs on the FRONT image only). Renders a subtle
 * warning chip plus a one-click rotate-90°-clockwise button; a successful rotate refreshes the
 * image and re-reads the extraction, whose `readable` the backend reset to null — clearing the
 * hint. Renders nothing when there is no `readable === false` verdict for the displayed image.
 */
export default function InsuranceCardOrientationHint({
  patientId,
  ordinal,
  documentReferenceId,
  onRotated,
}: InsuranceCardOrientationHintProps): ReactElement | null {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const { frontOrientation } = useInsuranceCardExtraction(patientId);

  const hint = frontOrientation[ordinal];
  const looksRotated =
    documentReferenceId != null && hint != null && hint.docRefId === documentReferenceId && hint.readable === false;
  if (!looksRotated) return null;

  const handleRotate = async (): Promise<void> => {
    if (!oystehrZambda || isRotating) return;
    setIsRotating(true);
    try {
      await rotateInsuranceCardImage(oystehrZambda, { documentReferenceId, rotationDegrees: 90 });
      // The bytes changed in place: refresh the displayed image (onRotated refetches presigned
      // urls — a new signed url string, so no stale browser cache) and re-read the extraction
      // (the backend reset `readable` to null, which clears this hint).
      await Promise.all([
        onRotated(),
        queryClient.invalidateQueries({ queryKey: ['insurance-card-extraction', patientId] }),
      ]);
      enqueueSnackbar('Card image rotated 90° clockwise', { variant: 'success' });
    } catch (error) {
      console.error('Error rotating insurance card image:', error);
      enqueueSnackbar('Failed to rotate the card image. Please try again.', { variant: 'error' });
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, marginTop: 0.5 }}>
      <Tooltip title="The scanned card doesn't look right-side-up. Rotate it until the text reads normally.">
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          icon={<WarningAmberIcon />}
          label={CARD_MAY_BE_ROTATED_LABEL}
          sx={{ fontSize: '0.7rem' }}
        />
      </Tooltip>
      <Tooltip title="Rotate 90° clockwise">
        {/* span keeps the tooltip working while the button is disabled */}
        <span>
          <IconButton
            size="small"
            aria-label={ROTATE_CARD_BUTTON_LABEL}
            disabled={isRotating || !oystehrZambda}
            onClick={() => void handleRotate()}
          >
            {isRotating ? <CircularProgress size={18} /> : <RotateRightIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
