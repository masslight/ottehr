import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import { Box, IconButton, Typography } from '@mui/material';
import React, { useState } from 'react';

export interface SectionProps {
  title?: string;
  children: React.ReactNode;
}

// The EHR's section card (src/components/AccordionCard): grey header bar, navy title, a collapse arrow, open by
// default. Its colours are copied here because this file is bundled into the report frame, outside the app theme.
const LINE = '#DFE5E9';
const HEADER = '#F4F6F8';
const NAVY = '#0F347C';
const BLUE = '#2169F5';

/** A titled block of the report — a collapsible card like the EHR's own sections. */
export function Section({ title, children }: SectionProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Box
      sx={{
        mb: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        backgroundColor: LINE,
        border: `1px solid ${LINE}`,
        borderRadius: 1,
      }}
    >
      {title && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            backgroundColor: HEADER,
            py: 0.5,
            px: 2,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            cursor: 'pointer',
          }}
          onClick={() => setCollapsed((c) => !c)}
        >
          <IconButton sx={{ p: 0 }} aria-label={collapsed ? 'expand section' : 'collapse section'}>
            <ArrowDropDownCircleOutlinedIcon fontSize="small" sx={{ color: BLUE, rotate: collapsed ? '' : '180deg' }} />
          </IconButton>
          <Typography variant="h6" component="h2" sx={{ color: NAVY }}>
            {title}
          </Typography>
        </Box>
      )}
      {!collapsed && (
        <Box sx={{ backgroundColor: '#fff', p: 2, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
          {children}
        </Box>
      )}
    </Box>
  );
}
