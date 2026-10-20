import { Box } from '@mui/material';
import React from 'react';
import { ShowAs } from '../state/store';

const WIDTHS: Record<ShowAs, number | undefined> = {
  // full width, as on the EHR's Reports page
  reports: undefined,
  // the panel width a visit's Reports section gives a report
  visit: 820,
  // to check small layouts
  narrow: 600,
};

/**
 * Sizes the report the way the EHR shows it. It never touches what the report receives or how it runs, and it is
 * one element for all modes so the report iframe keeps its place (a remount would blank the rendered report).
 */
export function ShowAsFrame({ mode, children }: { mode: ShowAs; children: React.ReactNode }): React.ReactElement {
  return <Box sx={{ width: WIDTHS[mode], maxWidth: '100%' }}>{children}</Box>;
}
