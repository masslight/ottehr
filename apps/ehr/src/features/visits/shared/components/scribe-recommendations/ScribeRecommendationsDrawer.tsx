import { aiIcon } from '@ehrTheme/icons';
import { Badge, Box, IconButton, Tooltip, useTheme } from '@mui/material';
import { FC, KeyboardEvent, PointerEvent, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import {
  clampScribePanelWidth,
  SCRIBE_PANEL_DEFAULT_WIDTH,
  SCRIBE_RAIL_WIDTH,
  useScribeRecommendationsStore,
} from './scribeRecommendations.store';
import { ScribeRecommendationsPanel } from './ScribeRecommendationsPanel';

const testIds = dataTestIds.scribeRecommendations;
const KEYBOARD_RESIZE_STEP = 24;

/**
 * Right-hand companion to the visit note. Sits beside the note rather than over it (the provider
 * works in both at once), collapses to a thin rail, and can be dragged wider or narrower.
 */
export const ScribeRecommendationsDrawer: FC = () => {
  const theme = useTheme();
  const { encounter } = useAppointmentData();
  const isOpen = useScribeRecommendationsStore((state) => state.isOpen);
  const storedWidth = useScribeRecommendationsStore((state) => state.width);
  const open = useScribeRecommendationsStore((state) => state.open);
  const close = useScribeRecommendationsStore((state) => state.close);
  const setWidth = useScribeRecommendationsStore((state) => state.setWidth);
  const startSession = useScribeRecommendationsStore((state) => state.startSession);
  const pendingCount = useScribeRecommendationsStore((state) =>
    state.phase === 'ready'
      ? state.recommendations.filter((rec) => {
          const item = state.itemState[rec.id];
          return item?.selected && item.status !== 'applied';
        }).length
      : 0
  );

  // The transcript and its recommendations belong to one visit.
  useEffect(() => {
    startSession(encounter?.id);
  }, [encounter?.id, startSession]);

  // Width while dragging lives here so the store (and localStorage) is only written on release.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = dragWidth ?? storedWidth;

  const onResizeStart = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = storedWidth;
    let latest = startWidth;
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: globalThis.PointerEvent): void => {
      // The panel hugs the right edge, so dragging left makes it wider.
      latest = clampScribePanelWidth(startWidth + (startX - moveEvent.clientX));
      setDragWidth(latest);
    };
    const onEnd = (): void => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      setWidth(latest);
      setDragWidth(null);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  };

  const onResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setWidth(storedWidth + KEYBOARD_RESIZE_STEP);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setWidth(storedWidth - KEYBOARD_RESIZE_STEP);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setWidth(SCRIBE_PANEL_DEFAULT_WIDTH);
    }
  };

  if (!isOpen) {
    return (
      <Box
        data-testid={testIds.rail}
        sx={{
          width: SCRIBE_RAIL_WIDTH,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 0.5,
          borderLeft: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Tooltip title="AI Chart Recommendations" placement="left">
          <IconButton onClick={open} aria-label="Open AI Chart Recommendations" data-testid={testIds.openButton}>
            <Badge badgeContent={pendingCount} color="primary" max={99}>
              <img src={aiIcon} alt="" aria-hidden style={{ width: 22 }} />
            </Badge>
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderLeft: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        // Drop text selection while the handle is being dragged across the page.
        userSelect: dragWidth !== null ? 'none' : undefined,
      }}
    >
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize recommendations panel"
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onResizeStart}
        onDoubleClick={() => setWidth(SCRIBE_PANEL_DEFAULT_WIDTH)}
        onKeyDown={onResizeKeyDown}
        data-testid={testIds.resizeHandle}
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -3,
          width: 7,
          cursor: 'col-resize',
          zIndex: 1,
          touchAction: 'none',
          '&:hover, &:focus-visible, &:active': {
            backgroundColor: theme.palette.primary.main,
            opacity: 0.5,
            outline: 'none',
          },
        }}
      />
      <ScribeRecommendationsPanel onCollapse={close} />
    </Box>
  );
};
