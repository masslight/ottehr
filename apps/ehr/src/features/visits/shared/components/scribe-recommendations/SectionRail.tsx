import { alpha, Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import { FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getVisitBasePath, SCRIBE_SECTIONS } from './scribeSections';
import { ScribeSectionKey } from './types';

/** Wide enough for the rotated label to stay legible, narrow enough not to squeeze the rows. */
const RAIL_WIDTH = 26;
const RAIL_BAR_WIDTH = 3;

/**
 * The section name running down a coloured strip beside its content, rather than in a header row
 * of its own — with several blocks on screen those headers cost more vertical space than the
 * recommendations they introduce. Doubles as the link into that part of the note.
 */
export const SectionRail: FC<{ section: ScribeSectionKey }> = ({ section }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const meta = SCRIBE_SECTIONS[section];

  const goToSection = (): void => {
    const base = getVisitBasePath(pathname);
    if (base) navigate(`${base}/${meta.route}`);
  };

  return (
    <Tooltip title={`Open ${meta.label} in the note`} placement="left">
      <ButtonBase
        onClick={goToSection}
        aria-label={`Open ${meta.label} in the note`}
        data-testid={dataTestIds.scribeRecommendations.goToSectionButton(section)}
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'stretch',
          backgroundColor: alpha(meta.accent, 0.07),
          '&:hover, &:focus-visible': { backgroundColor: alpha(meta.accent, 0.18) },
        }}
      >
        <Box sx={{ width: RAIL_BAR_WIDTH, backgroundColor: meta.accent }} />
        <Box sx={{ width: RAIL_WIDTH, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 0.25 }}>
          <Typography
            component="span"
            sx={{
              // Rotated so the label reads bottom-to-top down the rail.
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              whiteSpace: 'nowrap',
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              color: meta.accent,
            }}
          >
            {meta.shortLabel}
          </Typography>
        </Box>
      </ButtonBase>
    </Tooltip>
  );
};
