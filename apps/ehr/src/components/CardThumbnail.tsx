import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { Box, ButtonBase } from '@mui/material';
import { UseMutationResult } from '@tanstack/react-query';
import { Attachment } from 'fhir/r4b';
import React, { ReactNode, useState } from 'react';
import { SavedCardItem } from 'src/hooks/useVisitCards';
import { UpdateVisitFilesInput } from 'utils';
import FloatingCardPreview, { CardPreviewFace } from './FloatingCardPreview';
import ImageUploader from './ImageUploader';

/** Standard aspect ratio for ID and insurance cards. */
const ASPECT_RATIO = 1.57;
/** Width of the clean inline thumbnail image. */
const THUMBNAIL_WIDTH = 100;
/** Width of the compact empty-state Upload/Scan affordance (needs room for the two buttons). */
const UPLOADER_WIDTH = 140;

export interface CardThumbnailProps {
  /** The saved card images (front/back) for one card (a coverage's insurance card or the photo ID). */
  item: SavedCardItem;
  /** e.g. "Primary Insurance Card" or "ID Card" — used for the preview title and accessible labels. */
  title: string;
  appointmentID: string | undefined;
  /** The shared visit-files upload mutation (from useVisitCards). */
  filesMutator: UseMutationResult<void, Error, UpdateVisitFilesInput, unknown>;
  /** fileType currently being uploaded via the shared scanner flow (from useVisitCards). */
  uploadingFileType: UpdateVisitFilesInput['fileType'] | null;
  /** Opens the shared ScannerModal for the given fileType (from useVisitCards). */
  handleOpenScanner: (fileType: UpdateVisitFilesInput['fileType']) => void;
  imagesLoading?: boolean;
  /** fileType used when uploading/scanning into the empty state (the card's FRONT slot). */
  uploadFileType: UpdateVisitFilesInput['fileType'];
  /**
   * Rendered in the floating preview's header for the currently shown face — e.g. the
   * InsuranceCardOrientationHint rotate control, so rotation happens in the enlarged view.
   */
  previewHeaderActions?: (face: CardPreviewFace) => ReactNode;
}

/**
 * A CLEAN, clickable card thumbnail (insurance card or photo ID) rendered inline near its section:
 * just the card's front image at a small size with an OpenInFull affordance. No inline front/back
 * toggle, rotate, or delete — clicking the thumbnail opens the non-modal FloatingCardPreview, which
 * hosts the front/back toggle and (via previewHeaderActions) the rotate control.
 *
 * When the card has no image at all, renders a compact Upload/Scan affordance instead
 * (reusing the shared ImageUploader + scanner flow) so staff can still add one.
 */
const CardThumbnail: React.FC<CardThumbnailProps> = ({
  item,
  title,
  appointmentID,
  filesMutator,
  uploadingFileType,
  handleOpenScanner,
  imagesLoading,
  uploadFileType,
  previewHeaderActions,
}) => {
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  // Prefer the front image; fall back to the back so a back-only card is still reachable.
  const displayFace: CardPreviewFace | null = item.front?.presignedUrl
    ? 'front'
    : item.back?.presignedUrl
    ? 'back'
    : null;

  if (displayFace === null) {
    // No card image yet: compact Upload/Scan affordance into the card's front slot.
    // The uploader needs the appointment id to create the Z3 object; without one there is nothing to offer.
    if (!appointmentID) {
      return null;
    }
    return (
      <Box sx={{ width: UPLOADER_WIDTH }}>
        <ImageUploader
          fileName={uploadFileType}
          appointmentId={appointmentID}
          aspectRatio={ASPECT_RATIO}
          disabled={imagesLoading}
          isUploading={uploadingFileType === uploadFileType}
          onScanClick={() => handleOpenScanner(uploadFileType)}
          submitAttachment={async (attachment: Attachment) => {
            await filesMutator.mutateAsync({
              appointmentId: appointmentID,
              attachment,
              fileType: uploadFileType,
            });
          }}
        />
      </Box>
    );
  }

  const displayUrl = displayFace === 'front' ? item.front?.presignedUrl : item.back?.presignedUrl;

  return (
    <>
      <ButtonBase
        focusRipple
        aria-label={`Enlarge ${title}`}
        onClick={() => setPreviewOpen(true)}
        sx={{
          position: 'relative',
          display: 'block',
          width: THUMBNAIL_WIDTH,
          aspectRatio: String(ASPECT_RATIO),
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'primary.main',
          backgroundColor: 'grey.50',
          cursor: 'pointer',
          '&:hover, &:focus-visible': {
            borderColor: 'primary.dark',
            boxShadow: 2,
          },
        }}
      >
        <img
          src={displayUrl}
          alt={`${title} ${displayFace}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        {/* Click-to-enlarge affordance; pointer-events none so the click lands on the ButtonBase. */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 2,
            right: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: '4px',
            padding: '2px',
            color: 'primary.main',
            pointerEvents: 'none',
          }}
        >
          <OpenInFullIcon sx={{ fontSize: 14 }} />
        </Box>
      </ButtonBase>
      {/* Non-modal enlarged preview: hosts the front/back toggle and the rotate control (headerActions). */}
      <FloatingCardPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        frontUrl={item.front?.presignedUrl}
        backUrl={item.back?.presignedUrl}
        title={title}
        defaultFace={displayFace}
        headerActions={previewHeaderActions}
      />
    </>
  );
};

export default CardThumbnail;
