import RotateRightIcon from '@mui/icons-material/RotateRight';
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { rotateInsuranceCardImage } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';

export const ROTATE_CARD_BUTTON_LABEL = 'Rotate card 90 degrees clockwise';

interface RotateCardImageButtonProps {
  /** DocumentReference.id of the DISPLAYED card image (insurance card or photo ID). */
  documentReferenceId: string;
  /**
   * Called after a successful rotate. The backend re-stores the image bytes at the SAME z3 url,
   * so this must refresh the displayed image — e.g. refetch the visit files so a freshly signed
   * presigned url (a new url string) bypasses the browser cache.
   */
  onRotated: () => Promise<unknown>;
}

/**
 * Rotate-90°-clockwise control for a displayed card image (insurance card or photo ID). Bakes the
 * rotation into the stored image via the rotate-insurance-card-image zambda, then calls onRotated
 * to refresh the display. Stays enabled after each rotate so a 180°/270° card can be fixed with
 * repeated clicks.
 */
export default function RotateCardImageButton({
  documentReferenceId,
  onRotated,
}: RotateCardImageButtonProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [isRotating, setIsRotating] = useState<boolean>(false);

  const handleRotate = async (): Promise<void> => {
    if (!oystehrZambda || isRotating) return;
    setIsRotating(true);
    try {
      await rotateInsuranceCardImage(oystehrZambda, { documentReferenceId, rotationDegrees: 90 });
      await onRotated();
      enqueueSnackbar('Card image rotated 90° clockwise', { variant: 'success' });
    } catch (error) {
      console.error('Error rotating card image:', error);
      enqueueSnackbar('Failed to rotate the card image. Please try again.', { variant: 'error' });
    } finally {
      setIsRotating(false);
    }
  };

  return (
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
  );
}
