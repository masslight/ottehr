import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type CardPreviewFace = 'front' | 'back';

export interface FloatingCardPreviewProps {
  open: boolean;
  onClose: () => void;
  frontUrl?: string;
  backUrl?: string;
  title: string;
  defaultFace?: CardPreviewFace;
  /**
   * Optional extra header controls (e.g. a rotate button), rendered between the face toggle and the
   * close button. Pass a function to render controls for the currently SHOWN face (e.g. a rotate
   * control targeting that face's DocumentReference).
   */
  headerActions?: ReactNode | ((face: CardPreviewFace) => ReactNode);
  /**
   * Rendered in place of the body's "No image available" text when the currently shown face has no
   * URL — e.g. an inline Upload/Scan control so a face that was just removed (or never had an image)
   * can be reloaded without leaving the preview. Providing this ALSO keeps the Front/Back toggle
   * visible even when only one face currently has an image, so the empty face stays reachable.
   */
  emptyStateSlot?: (face: CardPreviewFace) => ReactNode;
}

/** Max width of the enlarged card image inside the panel body. */
const IMAGE_MAX_WIDTH = 400;
/** Panel width = image + body padding (16px each side). */
const PANEL_WIDTH = IMAGE_MAX_WIDTH + 32;
/** Minimum gap kept between the panel and the viewport edges while dragging. */
const EDGE_MARGIN = 8;
/** Keep at least this much of the panel (its header) reachable at the bottom of the viewport. */
const MIN_VISIBLE_HEIGHT = 40;

interface PanelPosition {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Default position: offset toward the top-right of the viewport so the panel does not cover the
 * left/center form column the staffer is typing into. Draggable from there.
 */
const defaultPosition = (): PanelPosition => ({
  x: clamp(window.innerWidth - PANEL_WIDTH - 24, EDGE_MARGIN, window.innerWidth),
  y: 96,
});

/**
 * A NON-MODAL floating preview of an insurance/ID card, so staff can compare the enlarged card
 * against the form while they keep typing.
 *
 * Deliberately NOT a MUI Dialog/Modal/Popover: those add a backdrop and/or a focus trap, which
 * would block interaction with the form behind it. Instead this renders via a React portal to
 * document.body as a `position: fixed` Paper panel with a high z-index and no backdrop, leaving
 * the rest of the page fully interactive. It never steals focus from the form (`aria-modal="false"`
 * makes that explicit for assistive tech, rather than leaving it unset/ambiguous). Since it never
 * takes focus, a visually-hidden `aria-live` announcement fires on open so screen-reader users still
 * get a signal that the preview appeared.
 *
 * Draggable by its header bar (clamped to the viewport; drags starting on a button/toggle are
 * ignored). Dismissed via the close button or Escape.
 */
const FloatingCardPreview: React.FC<FloatingCardPreviewProps> = ({
  open,
  onClose,
  frontUrl,
  backUrl,
  title,
  defaultFace = 'front',
  headerActions,
  emptyStateSlot,
}) => {
  const [face, setFace] = useState<CardPreviewFace>(defaultFace);
  // null means "not yet dragged" — the default position is recomputed from the current viewport on each open.
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const prevOpenRef = useRef(false);

  // On each open (closed -> open transition), reset to the requested face and the default position.
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setFace(defaultFace);
      setPosition(null);
    }
    prevOpenRef.current = open;
  }, [open, defaultFace]);

  // Escape dismisses the panel (listener only while open).
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Drag: mousemove/mouseup are window-level so the drag keeps tracking outside the panel.
  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (event: MouseEvent): void => {
      const offsets = dragOffsetRef.current;
      const panel = panelRef.current;
      if (!offsets || !panel) return;
      const width = panel.offsetWidth || PANEL_WIDTH;
      setPosition({
        x: clamp(event.clientX - offsets.offsetX, EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN),
        y: clamp(event.clientY - offsets.offsetY, EDGE_MARGIN, window.innerHeight - MIN_VISIBLE_HEIGHT),
      });
    };
    const handleMouseUp = (): void => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  if (!open) {
    return null;
  }

  const hasBothFaces = Boolean(frontUrl) && Boolean(backUrl);
  // Normally, if only one face exists, always show that one (no toggle) — there's nothing to see on
  // the other side. But when emptyStateSlot is provided, the "empty" side isn't a dead end — it's
  // reachable to reload it — so keep the toggle available even with only one face present.
  const canToggleFace = hasBothFaces || Boolean(emptyStateSlot);
  const shownFace: CardPreviewFace = canToggleFace ? face : frontUrl ? 'front' : 'back';
  const shownUrl = shownFace === 'front' ? frontUrl : backUrl;
  const { x, y } = position ?? defaultPosition();

  const handleDragStart = (event: React.MouseEvent<HTMLElement>): void => {
    // Ignore drags that start on a header control (toggle buttons, close, headerActions buttons).
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffsetRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    setDragging(true);
    // Prevent text selection while dragging; does NOT move focus away from the form.
    event.preventDefault();
  };

  return createPortal(
    <Paper
      ref={panelRef}
      role="dialog"
      aria-label={`${title} preview`}
      // Explicit, not just absent: this panel never traps or steals focus (see the doc comment
      // above), so assistive tech should treat it as non-modal rather than guessing from omission.
      aria-modal="false"
      elevation={8}
      // Inline style (not sx) so dragging doesn't regenerate an emotion class per mousemove frame.
      style={{ left: x, top: y }}
      sx={{
        position: 'fixed',
        zIndex: (theme) => theme.zIndex.modal + 1,
        width: PANEL_WIDTH,
        maxWidth: 'calc(100vw - 16px)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Focus never moves here, so announce the open via a live region instead — the only signal
          a screen-reader user gets that the preview appeared. Visually hidden (clip), not display:none,
          so it stays in the accessibility tree. */}
      <Box
        component="span"
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {`${title} preview opened`}
      </Box>
      <Box
        onMouseDown={handleDragStart}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          backgroundColor: 'grey.100',
          borderBottom: '1px solid',
          borderColor: 'divider',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
          {title}
        </Typography>
        {canToggleFace && (
          <ToggleButtonGroup
            value={shownFace}
            exclusive
            size="small"
            aria-label={`${title} preview side`}
            onChange={(_event, newFace: CardPreviewFace | null) => {
              if (newFace !== null) {
                setFace(newFace);
              }
            }}
          >
            <ToggleButton value="front" aria-label={`Show front of ${title} preview`}>
              Front
            </ToggleButton>
            <ToggleButton value="back" aria-label={`Show back of ${title} preview`}>
              Back
            </ToggleButton>
          </ToggleButtonGroup>
        )}
        {typeof headerActions === 'function' ? headerActions(shownFace) : headerActions}
        <IconButton size="small" aria-label={`Close ${title} preview`} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
        {shownUrl ? (
          <img
            src={shownUrl}
            alt={`${title} ${shownFace}`}
            style={{ maxWidth: IMAGE_MAX_WIDTH, width: '100%', height: 'auto', objectFit: 'contain' }}
          />
        ) : emptyStateSlot ? (
          emptyStateSlot(shownFace)
        ) : (
          <Typography variant="body2" color="text.secondary">
            No image available
          </Typography>
        )}
      </Box>
    </Paper>,
    document.body
  );
};

export default FloatingCardPreview;
