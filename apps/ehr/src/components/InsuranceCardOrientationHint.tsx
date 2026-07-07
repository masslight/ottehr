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
   * Which face of the card is displayed. OCR judges orientation on the FRONT image only, so the
   * "Card may be rotated" chip is considered for front cards only; back cards get just the
   * always-available rotate button.
   */
  face: 'front' | 'back';
  /**
   * DocumentReference.id of the DISPLAYED card image. Renders nothing when null (no image to
   * rotate). The warning chip additionally requires the stored OCR orientation verdict to belong
   * to this exact image (guards against a stale verdict from a deleted/replaced card).
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
 * Always-available rotate-90°-clockwise control for a displayed insurance-card image, plus a
 * conditional "Card may be rotated" warning chip when the OCR judged the FRONT image not
 * right-side-up (stored extraction `readable === false`). The control stays mounted across
 * rotates so a 180°/270° card can be fixed with repeated clicks; each successful rotate
 * refreshes the image and re-reads the extraction.
 *
 * After a successful rotate the chip is also suppressed client-side for that DocumentReference
 * id: the backend resets `readable` to null, but if that reset patch fails, the stale
 * `readable === false` must not re-show the chip and invite an over-rotate.
 */
export default function InsuranceCardOrientationHint({
  patientId,
  ordinal,
  face,
  documentReferenceId,
  onRotated,
}: InsuranceCardOrientationHintProps): ReactElement | null {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [isRotating, setIsRotating] = useState<boolean>(false);
  // DocRef ids successfully rotated in this session: their stale `readable === false` verdicts
  // no longer mean "not upright" (keyed by id so a replaced card image is unaffected).
  const [rotatedDocRefIds, setRotatedDocRefIds] = useState<ReadonlySet<string>>(new Set());
  const { frontOrientation } = useInsuranceCardExtraction(patientId);

  if (documentReferenceId == null) return null;

  const hint = face === 'front' ? frontOrientation[ordinal] : null;
  const looksRotated =
    hint != null &&
    hint.docRefId === documentReferenceId &&
    hint.readable === false &&
    !rotatedDocRefIds.has(documentReferenceId);

  const handleRotate = async (): Promise<void> => {
    if (!oystehrZambda || isRotating) return;
    setIsRotating(true);
    try {
      await rotateInsuranceCardImage(oystehrZambda, { documentReferenceId, rotationDegrees: 90 });
      // The rotate itself succeeded: suppress the warning chip for this image immediately, so a
      // failed backend `readable`-reset (or a failed refresh below) can't leave a stale chip
      // inviting an over-rotate.
      setRotatedDocRefIds((prev) => new Set(prev).add(documentReferenceId));
      // The bytes changed in place: refresh the displayed image (onRotated refetches presigned
      // urls — a new signed url string, so no stale browser cache) and re-read the extraction
      // (the backend reset `readable` to null).
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
      {looksRotated && (
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
      )}
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
