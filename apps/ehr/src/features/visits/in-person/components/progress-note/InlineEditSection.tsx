import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, IconButton, Typography } from '@mui/material';
import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';

interface InlineEditSectionProps {
  // kebab-case section identifier used for test ids, e.g. 'allergies'
  sectionName: string;
  editLabel: string;
  // the reused intake screen body; mounted only while the section is open so the
  // Review & Sign page doesn't pay for every section's queries up front
  editContent: ReactNode;
  // render children without any edit affordance (e.g. supervisor approval box)
  disabled?: boolean;
  children: ReactNode;
}

export const InlineEditSection: FC<InlineEditSectionProps> = ({
  sectionName,
  editLabel,
  editContent,
  disabled,
  children,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollBackOnCollapse = useRef(false);

  // The editor is usually much taller than the summary, so after clicking Done at the
  // bottom of a long editor the scroll position can land far below the collapsed
  // section. Bring the section heading back into view (72px clears the sticky navbar).
  useEffect(() => {
    if (isEditing || !scrollBackOnCollapse.current) return;
    scrollBackOnCollapse.current = false;
    const el = rootRef.current;
    if (el && el.getBoundingClientRect().top < 72) {
      el.scrollIntoView?.({ block: 'start' });
    }
  }, [isEditing]);

  const canEdit = FEATURE_FLAGS.INLINE_PROGRESS_NOTE_EDITING_ENABLED && !isAppointmentReadOnly && !disabled;

  if (!canEdit) return <>{children}</>;

  // The editor shows the same information in more detail, so the read-only summary is
  // replaced while editing rather than duplicated above it; the edit label stands in as
  // the section heading so the section keeps its identity.
  if (isEditing) {
    return (
      <Box sx={{ width: '100%' }} data-testid={dataTestIds.progressNotePage.inlineEditSection(sectionName)}>
        <Typography variant="h5" color="primary.dark" sx={{ mb: 1 }}>
          {editLabel}
        </Typography>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {editContent}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <RoundedButton
              variant="contained"
              onClick={() => {
                scrollBackOnCollapse.current = true;
                setIsEditing(false);
              }}
              data-testid={dataTestIds.progressNotePage.inlineEditDoneButton(sectionName)}
            >
              Done
            </RoundedButton>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={rootRef}
      sx={{ width: '100%', scrollMarginTop: '72px' }}
      data-testid={dataTestIds.progressNotePage.inlineEditSection(sectionName)}
    >
      <Box
        onClick={() => setIsEditing(true)}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          cursor: 'pointer',
          borderRadius: 1,
          mx: -1,
          px: 1,
          '&:hover': { backgroundColor: 'action.hover' },
          '&:hover .inline-edit-icon': { opacity: 1 },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
        <IconButton
          className="inline-edit-icon"
          size="small"
          aria-label={editLabel}
          data-testid={dataTestIds.progressNotePage.inlineEditButton(sectionName)}
          sx={{ opacity: 0.5, transition: 'opacity 0.15s', color: 'primary.main' }}
        >
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
};
