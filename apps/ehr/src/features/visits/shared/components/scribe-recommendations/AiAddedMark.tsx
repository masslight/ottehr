import { aiIcon } from '@ehrTheme/icons';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Avatar, Box, Chip, Tooltip } from '@mui/material';
import { FC, ReactNode, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ProvenanceContent } from './Provenance';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { AI_SURFACE } from './ScribeStage';
import { ScribeRecommendation } from './types';

/** Darker step of the AI tint, for the flash and the panel's avatar ring. */
const AI_SURFACE_STRONG = '#B3E5FC';
const WARNING_SURFACE = 'rgba(237,108,2,0.10)';
/** A mark still flashes if it mounts this soon after the apply, so the refetch cannot outrun it. */
const FLASH_WINDOW_MS = 4000;

interface AiAddedMarkProps {
  recommendation: ScribeRecommendation;
  /** Hug the content instead of taking the row, for items that sit in a wrapping line. */
  inline?: boolean;
  children: ReactNode;
}

/**
 * Wraps a note item the scribe panel wrote, so the provider can tell at a glance what came from
 * the transcript. The tint stays for the sitting; the glyph carries the AI's evidence on hover;
 * and an item that has just landed flashes once so the eye finds it. Nothing to click: the
 * reviewing happened in the panel.
 */
export const AiAddedMark: FC<AiAddedMarkProps> = ({ recommendation, inline, children }) => {
  const appliedAt = useScribeRecommendationsStore((state) => state.itemState[recommendation.id]?.appliedAt);
  // Decided once at mount: a later re-render of the same row must not restart the flash.
  const [flash] = useState(() => appliedAt !== undefined && Date.now() - appliedAt < FLASH_WINDOW_MS);
  const hasWarning = Boolean(recommendation.warning);
  const surface = hasWarning ? WARNING_SURFACE : AI_SURFACE;

  return (
    <Tooltip
      placement="left"
      enterDelay={300}
      title={
        <ProvenanceContent
          note="Added from the transcript by Autochart"
          evidence={recommendation.evidence}
          warning={recommendation.warning}
        />
      }
    >
      <Box
        data-testid={dataTestIds.scribeRecommendations.aiAddedMark(recommendation.id)}
        sx={{
          display: inline ? 'inline-flex' : 'flex',
          alignItems: 'flex-start',
          gap: 0.5,
          backgroundColor: surface,
          borderRadius: '4px',
          px: 0.5,
          mx: -0.5,
          ...(flash && {
            animation: 'scribeAiAddedFlash 2.5s ease-out',
            '@keyframes scribeAiAddedFlash': {
              '0%': { backgroundColor: AI_SURFACE_STRONG, boxShadow: `0 0 0 2px ${AI_SURFACE_STRONG}` },
              '100%': { backgroundColor: surface, boxShadow: '0 0 0 0 transparent' },
            },
          }),
        }}
      >
        <img src={aiIcon} alt="" aria-hidden style={{ width: 14, height: 14, marginTop: 5, flexShrink: 0 }} />
        {hasWarning && (
          <WarningAmberOutlinedIcon sx={{ fontSize: 14, mt: '5px', flexShrink: 0, color: 'warning.main' }} />
        )}
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Box>
    </Tooltip>
  );
};

/** Card-header badge for a section a template filled in one go, where there is no single item to tint. */
export const AiAddedSectionChip: FC<{ templateName: string }> = ({ templateName }) => (
  // Stops the click from reaching the card header, which would open the editor.
  <Box onClick={(event) => event.stopPropagation()} sx={{ display: 'flex', flexShrink: 0, cursor: 'default' }}>
    <Tooltip title="Filled by the template applied from Autochart" placement="left" enterDelay={300}>
      <Chip
        size="small"
        data-testid={dataTestIds.scribeRecommendations.aiAddedSectionChip}
        avatar={
          <Avatar sx={{ backgroundColor: '#FFFFFF' }}>
            <img src={aiIcon} alt="" aria-hidden style={{ width: 14 }} />
          </Avatar>
        }
        label={`From the “${templateName}” template`}
        sx={{ backgroundColor: AI_SURFACE }}
      />
    </Tooltip>
  </Box>
);
