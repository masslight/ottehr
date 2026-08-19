import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, IconButton } from '@mui/material';
import { FC, ReactNode, useState } from 'react';
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

  const canEdit = FEATURE_FLAGS.INLINE_PROGRESS_NOTE_EDITING_ENABLED && !isAppointmentReadOnly && !disabled;

  if (!canEdit) return <>{children}</>;

  return (
    <Box sx={{ width: '100%' }} data-testid={dataTestIds.progressNotePage.inlineEditSection(sectionName)}>
      <Box
        onClick={isEditing ? undefined : () => setIsEditing(true)}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          ...(!isEditing && {
            cursor: 'pointer',
            borderRadius: 1,
            mx: -1,
            px: 1,
            '&:hover': { backgroundColor: 'action.hover' },
            '&:hover .inline-edit-icon': { opacity: 1 },
          }),
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
        {!isEditing && (
          <IconButton
            className="inline-edit-icon"
            size="small"
            aria-label={editLabel}
            data-testid={dataTestIds.progressNotePage.inlineEditButton(sectionName)}
            sx={{ opacity: 0.5, transition: 'opacity 0.15s', color: 'primary.main' }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      {isEditing && (
        <Box
          sx={{
            mt: 1,
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
              onClick={() => setIsEditing(false)}
              data-testid={dataTestIds.progressNotePage.inlineEditDoneButton(sectionName)}
            >
              Done
            </RoundedButton>
          </Box>
        </Box>
      )}
    </Box>
  );
};
