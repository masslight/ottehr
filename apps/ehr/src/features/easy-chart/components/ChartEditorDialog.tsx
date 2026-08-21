// Open the REAL editor for a section, in a dialog, instead of re-implementing it.
//
// Exam findings and ROS were previously corrected through an inline search box on the row. That was the
// wrong shape twice over: the search matched against a fuzzy catalogue and returned nothing for most
// partial queries, so the box looked editable and did nothing; and even working, a single-row swap cannot
// express what these sections need — ticking three boxes in one system, adding a comment, clearing a
// template's normals.
//
// ExamTab and RosTab are the pages the provider already knows, take no props, and read their own stores,
// so hosting them here duplicates no logic and cannot drift from the tabs.
//
// The dialog owns nothing about the data. Whatever is changed inside is written by those components
// through their normal save path; this component only tells the page to refetch when it closes, because
// Easy Chart renders from its own chart-data query and would otherwise show the pre-edit note.

import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { FC, ReactNode, useEffect, useRef } from 'react';

export type ChartEditorSection = 'exam' | 'ros';

const TITLE: Record<ChartEditorSection, string> = {
  exam: 'Examination',
  ros: 'Review of Systems',
};

export interface ChartEditorDialogProps {
  section: ChartEditorSection | undefined;
  /**
   * The chart field the provider clicked, scrolled to once the section's table has rendered. Absent when
   * the whole section was opened from its heading, which should land at the top.
   */
  target?: string;
  /** Called on close — backdrop, escape or the ✕. The caller refetches here. */
  onClose: () => void;
  children: ReactNode;
}

export const ChartEditorDialog: FC<ChartEditorDialogProps> = ({ section, target, onClose, children }) => {
  const content = useRef<HTMLDivElement | null>(null);

  // The table is not in the DOM when the dialog opens — ExamTab and RosTab render a spinner until their
  // stores report data — so a single lookup on mount finds nothing. Poll briefly instead of guessing a
  // delay, and give up rather than scroll to the wrong thing: landing at the top is a fine outcome.
  useEffect(() => {
    if (!section || !target) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const root = content.current;
      const row =
        root?.querySelector(`[data-chart-field="${target}"]`) ??
        // Exam rows are addressed through their keyed test ids: exam-component-checkbox-<field> and
        // friends, so match on the suffix rather than listing every variant.
        root?.querySelector(`[data-testid$="-${target}"]`);
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        clearInterval(timer);
      } else if (attempts >= 20) {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [section, target]);

  return (
    <Dialog
      open={Boolean(section)}
      onClose={onClose}
      fullWidth
      // Near-full-height, but capped in width: these tables are read left-to-right and become unreadable
      // stretched across a wide monitor.
      maxWidth={false}
      PaperProps={{ sx: { width: '100%', maxWidth: 1000, height: '90vh', maxHeight: '90vh' } }}
      aria-labelledby="easy-chart-editor-title"
    >
      <DialogTitle id="easy-chart-editor-title" sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" color="primary.dark">
            {section ? TITLE[section] : ''}
          </Typography>
          <IconButton onClick={onClose} aria-label="close" size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      {/* The scroll lives HERE, not on the dialog: the title stays put while a long exam table scrolls. */}
      <DialogContent dividers ref={content} sx={{ overflowY: 'auto' }}>
        <Box sx={{ pb: 2 }}>{children}</Box>
      </DialogContent>
    </Dialog>
  );
};
