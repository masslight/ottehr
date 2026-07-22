import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { Box, ButtonBase, IconButton, Tooltip } from '@mui/material';
import { UseMutationResult } from '@tanstack/react-query';
import { Attachment } from 'fhir/r4b';
import React, { ReactNode, useState } from 'react';
import { SavedCardItem } from 'src/hooks/useVisitCards';
import { UpdateVisitFilesInput } from 'utils';
import { CustomDialog } from './dialogs';
import FloatingCardPreview, { CardPreviewFace } from './FloatingCardPreview';
import ImageUploader from './ImageUploader';

/** Standard aspect ratio for ID and insurance cards. */
const ASPECT_RATIO = 1.57;
/** Width of the clean inline thumbnail image. */
const THUMBNAIL_WIDTH = 100;
/** Width of the compact Upload/Scan affordance (needs room for the two buttons). */
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
  /** fileType used when uploading/scanning/reloading the card's FRONT slot. */
  frontFileType: UpdateVisitFilesInput['fileType'];
  /** fileType used when uploading/scanning/reloading the card's BACK slot. */
  backFileType: UpdateVisitFilesInput['fileType'];
  /**
   * Rendered in the floating preview's header for the currently shown face — e.g. the
   * InsuranceCardOrientationHint rotate control, so rotation happens in the enlarged view.
   */
  previewHeaderActions?: (face: CardPreviewFace) => ReactNode;
  /**
   * Enables remove-and-reload: when provided (from useVisitCards), a delete button appears in the
   * preview header for whichever face is currently shown, and once removed that face's slot in the
   * preview immediately offers an inline Upload/Scan control so staff can reload it without leaving
   * the preview. Omitted entirely disables delete for that card.
   */
  handleDeleteClick?: (id: string | null) => Promise<void>;
  /** DocumentReference.id currently being deleted (from useVisitCards), to disable/spin the button. */
  deletingFileId?: string | null;
}

/**
 * A CLEAN, clickable card thumbnail (insurance card or photo ID) rendered inline near its section:
 * just the card's front image at a small size with an OpenInFull affordance. No inline front/back
 * toggle, rotate, or delete on the collapsed thumbnail itself — clicking it opens the non-modal
 * FloatingCardPreview, which hosts the front/back toggle, the rotate control (previewHeaderActions),
 * and — when handleDeleteClick is provided — a delete button per face plus an inline reload uploader
 * for whichever face was just removed (or never had an image).
 *
 * When the card has NEITHER face at all, renders a compact Upload/Scan affordance instead of a
 * thumbnail (reusing the shared ImageUploader + scanner flow) so staff can still add one.
 */
const CardThumbnail: React.FC<CardThumbnailProps> = ({
  item,
  title,
  appointmentID,
  filesMutator,
  uploadingFileType,
  handleOpenScanner,
  imagesLoading,
  frontFileType,
  backFileType,
  previewHeaderActions,
  handleDeleteClick,
  deletingFileId,
}) => {
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [confirmDeleteFace, setConfirmDeleteFace] = useState<CardPreviewFace | null>(null);

  const faceFileType = (face: CardPreviewFace): UpdateVisitFilesInput['fileType'] =>
    face === 'front' ? frontFileType : backFileType;
  const faceDocRefId = (face: CardPreviewFace): string | null => (face === 'front' ? item.frontId : item.backId);

  // Prefer the front image; fall back to the back so a back-only card is still reachable.
  const displayFace: CardPreviewFace | null = item.front?.presignedUrl
    ? 'front'
    : item.back?.presignedUrl
    ? 'back'
    : null;

  // Reusable Upload/Scan affordance for one face's fileType — used both for the collapsed
  // no-image-at-all state and, once delete is wired, as the in-preview reload slot for a face
  // that was just removed (or never had an image in the first place).
  const uploaderFor = (fileType: UpdateVisitFilesInput['fileType']): ReactNode => {
    if (!appointmentID) return null;
    return (
      <ImageUploader
        fileName={fileType}
        appointmentId={appointmentID}
        aspectRatio={ASPECT_RATIO}
        disabled={imagesLoading}
        isUploading={uploadingFileType === fileType}
        onScanClick={() => handleOpenScanner(fileType)}
        submitAttachment={async (attachment: Attachment) => {
          await filesMutator.mutateAsync({
            appointmentId: appointmentID,
            attachment,
            fileType,
          });
        }}
      />
    );
  };

  if (displayFace === null) {
    // No card image at all yet: compact Upload/Scan affordance into the card's front slot.
    if (!appointmentID) {
      return null;
    }
    return <Box sx={{ width: UPLOADER_WIDTH }}>{uploaderFor(frontFileType)}</Box>;
  }

  const displayUrl = displayFace === 'front' ? item.front?.presignedUrl : item.back?.presignedUrl;

  const combinedHeaderActions = (face: CardPreviewFace): ReactNode => {
    const docRefId = faceDocRefId(face);
    return (
      <>
        {previewHeaderActions?.(face)}
        {handleDeleteClick && docRefId && (
          <Tooltip title={`Remove the ${face} image`}>
            <span>
              <IconButton
                size="small"
                aria-label={`Remove ${title} ${face}`}
                disabled={deletingFileId === docRefId}
                onClick={() => setConfirmDeleteFace(face)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </>
    );
  };

  // Only offered once handleDeleteClick is wired: after a face is removed (or if it was never
  // uploaded), toggling to it in the preview shows this instead of "No image available" so staff
  // can reload it without leaving the preview.
  const emptyStateSlot: ((face: CardPreviewFace) => ReactNode) | undefined = handleDeleteClick
    ? (face) => uploaderFor(faceFileType(face))
    : undefined;

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
      {/* Non-modal enlarged preview: hosts the front/back toggle, the rotate control (headerActions),
          and — when delete is wired — the remove button + reload uploader per face. */}
      <FloatingCardPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        frontUrl={item.front?.presignedUrl}
        backUrl={item.back?.presignedUrl}
        title={title}
        defaultFace={displayFace}
        headerActions={combinedHeaderActions}
        emptyStateSlot={emptyStateSlot}
      />
      {handleDeleteClick && (
        <CustomDialog
          open={confirmDeleteFace !== null}
          handleClose={() => setConfirmDeleteFace(null)}
          title="Remove card image"
          description="Are you sure you want to remove this image?"
          closeButtonText="Cancel"
          confirmText="Remove"
          confirmLoading={confirmDeleteFace !== null && deletingFileId === faceDocRefId(confirmDeleteFace)}
          handleConfirm={async () => {
            if (confirmDeleteFace === null) return;
            await handleDeleteClick(faceDocRefId(confirmDeleteFace));
            setConfirmDeleteFace(null);
          }}
        />
      )}
    </>
  );
};

export default CardThumbnail;
